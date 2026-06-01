# IncidentFox Agent 架构代码级讲解

本文讲 IncidentFox 里 Agent 相关的核心代码，重点是 `sre-agent` 这条当前活跃路径。目标是把代码读明白，而不是把产品能力讲得很玄。

先说结论：

- 当前真正执行调查的是 `sre-agent`，外面由 Slack、Web UI 或 orchestrator 触发。
- 每次调查会进入一个隔离 sandbox。sandbox 里跑 `ClaudeSDKClient` 长会话。
- ReAct 循环不是项目自己手写的 `while think -> act -> observe`，而是 SDK 托管；项目负责把 SDK 消息翻译成 SSE 事件。
- 当前没有完整的持久化 checkpoint。已有的是 sandbox 生命周期内的内存会话、sandbox 文件系统、JWT 复用和 Slack UI 状态缓存。
- 多 Agent 拓扑在 config-service 里已经有默认定义；当前 `sre-agent` 运行时会注册 subagents，但还没有完整实现 `sub_agents` 图的拓扑排序和按边授权。
- Skill 是主要扩展机制：`.claude/skills/*/SKILL.md` 提供按需加载的知识，脚本负责真实系统集成。

> 说明：仓库文案里有 Codex/Claude 命名混用。本文以当前代码为准：`sre-agent/agent.py` 使用的是 `claude_agent_sdk` 的 `ClaudeSDKClient`。

参考来源：

- 本地代码库：`/Users/liny/Documents/Code/incidentfox-main`
- 公开仓库：[incidentfox/incidentfox](https://github.com/incidentfox/incidentfox)

## 1. 一张图看懂入口

```text
Slack / Web UI / Orchestrator
        |
        v
sre-agent/server.py
  - /investigate
  - /interrupt
  - /answer
        |
        v
sandbox_manager.py
  - 创建或复用 K8s sandbox
  - 通过 sandbox-router 转发请求
        |
        v
sandbox_server.py
  - sandbox 内部 FastAPI
  - 按 thread_id 保存 InteractiveAgentSession
        |
        v
agent.py
  - ClaudeSDKClient
  - Skill / Bash / Read / Task 等工具
  - subagents
        |
        v
.claude/skills/* + scripts/*.py
  - Kubernetes、Grafana、RAPTOR、GitHub、日志、指标等集成
```

对应核心文件：

- `sre-agent/server.py`: 对外入口，负责鉴权、sandbox 复用、SSE 转发。
- `sre-agent/sandbox_manager.py`: K8s sandbox 生命周期管理。
- `sre-agent/sandbox_server.py`: sandbox 内部运行时，维护会话。
- `sre-agent/agent.py`: 真正的 Agent session 包装。
- `sre-agent/events.py`: Agent -> Slack/Web UI 的 SSE 事件协议。

## 2. 外层编排：先把 Agent 放进 sandbox

`sre-agent/server.py` 的 `/investigate` 是外层入口。它做的事很像调度器：

1. 校验 service-to-service token。
2. 生成或读取 `thread_id`。
3. 从请求里拿 `tenant_id`、`team_id`、`team_token`。
4. 调 `sandbox_manager.get_sandbox(thread_id)` 看有没有可复用 sandbox。
5. 没有就创建 sandbox，有就复用，并刷新 TTL。
6. 把请求转成 SSE 流，透传给 Slack 或 Web UI。

关键代码位置：

- `sre-agent/server.py` 的 `investigate()` 和 `_investigate_inner()`。
- `sre-agent/server.py` 的 `create_investigation_stream()`。

简化逻辑：

```python
thread_id = request.thread_id or f"thread-{uuid.uuid4().hex[:8]}"
sandbox_info = sandbox_manager.get_sandbox(thread_id)

if not sandbox_info:
    jwt_token, _ = get_or_create_session_jwt(thread_id, tenant_id, team_id)
    sandbox_info = sandbox_manager.create_sandbox(...)
else:
    sandbox_manager.reset_sandbox_ttl(thread_id)

return StreamingResponse(stream(), media_type="text/event-stream")
```

这里的重点是：外层 server 不直接跑 LLM。它只负责把一次调查放进正确的 sandbox。

### sandbox 如何保证隔离

`sre-agent/sandbox_manager.py` 通过 K8s 自定义资源创建 sandbox：

- sandbox 名称来自 `thread_id`，如 `investigation-thread-abc123`。
- 生产默认使用 gVisor runtime。
- 每个 sandbox 有自己的 Envoy sidecar。
- sandbox 不直接拿真实密钥，出站请求走 credential-proxy。
- sandbox 有 TTL，默认约 2 小时，过期后被删除。

直接创建路径在 `create_sandbox()`。warm pool 路径在 `create_sandbox_from_pool()`，它先创建 `SandboxClaim`，绑定预热 pod，然后调用 sandbox 内的 `/claim` 注入 JWT 和租户上下文。

## 3. 内层编排：sandbox 内保存长会话

进入 sandbox 以后，请求到达 `sre-agent/sandbox_server.py` 的 `/execute`。

它维护了一个进程内字典：

```python
_sessions: Dict[str, InteractiveAgentSession] = {}
```

`get_or_create_session(thread_id)` 的逻辑是：

1. 如果这个 `thread_id` 没有会话，先加载 team config。
2. 调 `create_agent_session(thread_id, _team_config)` 创建 `InteractiveAgentSession`。
3. `await session.start()` 启动 SDK client。
4. 存入 `_sessions`。
5. 后续同一 `thread_id` 复用同一个 session。

这就是短期上下文记忆的核心：只要 sandbox pod 没死、`thread_id` 相同，SDK client 的会话上下文就会继续存在。

## 4. ReAct 循环在哪里

很多 Agent 框架会显式写一个循环：

```text
think -> choose tool -> run tool -> observe result -> think again -> final answer
```

IncidentFox 当前不是这样手写的。实际循环由 Claude Agent SDK 托管，项目代码在 `InteractiveAgentSession.execute()` 里做三件事：

1. 把用户输入送给 SDK。
2. 接收 SDK 流式消息。
3. 把 SDK 消息转换成 IncidentFox 自己的事件协议。

关键代码在 `sre-agent/agent.py`：

```python
await self.client.query(message_generator())

async for message in self.client.receive_response():
    ...
```

这就是实际的 ReAct 驱动点。SDK 内部决定什么时候思考、什么时候调用工具、什么时候继续观察工具结果。

### SDK 消息如何映射成事件

`agent.py` 会把 SDK 消息转成 `events.py` 里的 `StreamEvent`：

| SDK 消息 | IncidentFox 事件 | 含义 |
| --- | --- | --- |
| `AssistantMessage` + `TextBlock` | `thought` | Agent 的可见推理/说明文本 |
| `AssistantMessage` + tool block | `tool_start` | 工具开始执行 |
| `PostToolUse` hook | `tool_end` | 工具执行结束，带输出 |
| `ResultMessage` | `result` | 最终回答 |
| 异常或超时 | `error` | 调查失败 |
| `AskUserQuestion` tool | `question` | Agent 向人提问 |
| 等待回答超时 | `question_timeout` | Agent 放弃等待继续执行 |

事件定义在 `sre-agent/events.py`。

### tool_end 为什么靠 hook

工具开始执行时，SDK 会发出工具调用 block，所以代码能立刻发 `tool_start`。

工具结束时，项目使用 SDK hook：

```python
hooks={"PostToolUse": [HookMatcher(hooks=[capture_tool_output])]}
```

`capture_tool_output()` 把工具输出放到 `_pending_tool_ends` 队列。下一轮 `receive_response()` 读到消息时，再把队列里的内容发成 `tool_end`。

这样 Slack UI 就能看到“哪个工具开始了，哪个工具结束了，输出是什么”。

## 5. 事件流：Agent 怎么把过程显示给用户

`events.py` 定义统一 SSE 事件：

- `thought_event()`
- `tool_start_event()`
- `tool_end_event()`
- `result_event()`
- `error_event()`
- `question_event()`
- `question_timeout_event()`

事件先从 sandbox 内的 `sandbox_server.py` 发出，再被外层 `server.py` 透传。

Slack 侧在 `slack-bot/stream_handler.py` 里消费这些事件：

- `thought`: 新建一个 thought section。
- `tool_start`: 在当前 thought 下挂一个 running tool。
- `tool_end`: 找到对应 tool，标记完成。
- `result`: 保存最终答案。
- `question`: 发一个 Slack 交互表单。

Web UI 则通过 `web_ui/src/lib/useAgentStream.ts` 消费流式事件。不过要注意：Web UI 这条路径同时支持 orchestrator 的旧/新事件格式，所以事件名里会看到 `agent_started`、`tool_started`、`agent_completed` 等兼容逻辑。

## 6. 状态机：从请求到完成

可以把一次调查理解成下面这个状态机：

```text
NEW_REQUEST
    |
    v
AUTH_AND_CONTEXT
    |
    v
FIND_SANDBOX
    |
    +-- exists --> REUSE_SANDBOX --> RESET_TTL
    |
    +-- missing --> CREATE_OR_CLAIM_SANDBOX --> WAIT_READY
    |
    v
SANDBOX_EXECUTE
    |
    v
SESSION_LOOKUP
    |
    +-- missing --> LOAD_TEAM_CONFIG --> START_SDK_SESSION
    |
    +-- exists --> USE_EXISTING_SESSION
    |
    v
SDK_REACT_LOOP
    |
    +-- thought -----> SSE thought
    +-- tool start --> SSE tool_start
    +-- tool end ----> SSE tool_end
    +-- question ----> WAIT_HUMAN_ANSWER
    +-- result -----> SSE result --> DONE
    +-- error ------> SSE error  --> FAILED
```

中断是另一条边：

```text
SDK_REACT_LOOP
    |
    +-- /interrupt --> session.interrupt() --> SSE result(subtype=interrupted)
```

提问也是另一条边：

```text
AskUserQuestion
    |
    v
question event -> Slack form -> /answer -> sandbox /answer -> provide_answer()
```

`agent.py` 里 `can_use_tool_handler()` 对 `AskUserQuestion` 最多等 60 秒。用户回答会通过 `provide_answer()` 唤醒等待中的 async event。

## 7. Checkpoint：当前有什么，缺什么

这里要非常明确：当前 `sre-agent` 没有完整的持久化 checkpoint。

也就是说，如果 sandbox pod 重启或被删除，`ClaudeSDKClient` 的会话上下文不会自动从数据库恢复。

当前已有的“近似 checkpoint”分几类：

### 7.1 sandbox 内存会话

`sandbox_server.py` 的 `_sessions` 保存 `thread_id -> InteractiveAgentSession`。

优点：同一 sandbox、同一 thread 可以多轮对话，支持 interrupt 后继续发新消息。

限制：进程没了就没了。

### 7.2 sandbox 文件系统

同一个 sandbox 生命周期内，`/workspace` 文件还在。Agent 下载的附件、生成的文件、clone 的仓库等能在后续 turn 继续使用。

限制：sandbox TTL 到期后文件系统消失。

### 7.3 JWT 复用

`server.py` 里 `_sessions` 不是 LLM session，而是 `thread_id -> JWT` 的复用缓存。

`get_or_create_session_jwt()` 会在 JWT 还没快过期时复用它。这样 sandbox 重建时可以保持同一调查线程的租户身份连续。

限制：这只是身份连续，不是 LLM 上下文恢复。

### 7.4 Slack UI session cache

Slack bot 的 `MessageState` 会缓存 thought、tool、result 等 UI 状态：

- 内存缓存：`slack-bot/state.py` 的 `_investigation_cache`。
- DB 缓存：`config_service` 的 `slack_session_cache` 表。

用途：用户点 “View Session” 时还能看到过程。

限制：这是展示状态，不是 Agent 可恢复执行的 checkpoint。

### 7.5 未接线的 AgentSession 模型

`config_service/src/db/models.py` 里有 `AgentSession` 模型，注释写的是“把 SDK session 文件同步到 DB，用于容器重启恢复”。

但从当前 `sre-agent` 代码看，它没有被 `agent.py` 或 `sandbox_server.py` 接上。所以文档里只能说：模型存在，运行时尚未使用。

## 8. 多 Agent 协作

IncidentFox 的多 Agent 有两层：配置层和运行层。

### 8.1 配置层：默认 STARSHIP 拓扑

默认配置在 `config_service/src/core/hierarchical_config.py` 的 `get_default_agent_config()`：

```text
planner
  -> investigation
  -> coding
  -> writeup

investigation
  -> github
  -> k8s
  -> aws
  -> metrics
  -> log_analysis
```

同样的模板也在 `config_service/templates/01_slack_incident_triage.json`。

配置中每个 agent 有：

- `enabled`
- `name`
- `description`
- `model`
- `prompt.system`
- `max_turns`
- `tools`
- `sub_agents`
- `handoff_strategy`

默认入口是：

```json
"entrance_agent": "planner"
```

### 8.2 运行层：当前 `sre-agent` 如何注册 subagents

`agent.py` 创建 `InteractiveAgentSession` 时会加载 team config：

```python
root_config = get_root_agent_config(self.team_config)
```

root agent 的选择逻辑在 `sre-agent/config.py`：

1. 优先 `investigator`
2. 其次 `planner`
3. 否则第一个 enabled agent

然后 `agent.py` 会遍历 `team_config.agents`，把除 root 外的 enabled agents 注册成 SDK 的 `AgentDefinition`：

```python
subagents[name] = AgentDefinition(
    description=agent_cfg.prompt.prefix or f"{name} specialist",
    prompt=agent_cfg.prompt.system,
    tools=...
)
```

最后传给 SDK：

```python
ClaudeAgentOptions(..., agents=subagents)
```

### 8.3 当前限制：`sub_agents` 图还没完全生效

配置层有 `sub_agents` 图，但当前 `sre-agent` 运行时代码没有完整读取这个图来做：

- 拓扑排序
- 只给某个 parent agent 暴露它声明的 children
- `agent_as_tool` 的逐边封装
- model alias 分层解析

这些在 `AGENTS.md` 里也被列为剩余工作：“Config-driven subagents: Port `agent_builder.py` pattern ... to sre-agent”。

所以准确说：

- 已实现：从 config-service 加载 agent prompt/tools，把非 root agent 注册为 SDK subagent。
- 未完整实现：按 `sub_agents` 拓扑精确编排多 Agent 图。

## 9. Skill 使用机制

`sre-agent` 的工具扩展主要靠 Skill，而不是 MCP。

Skill 文件在：

```text
sre-agent/.claude/skills/*/SKILL.md
```

每个 `SKILL.md` 通常有：

- frontmatter: `name`、`description`、有时有 `allowed-tools`
- 使用场景
- 调查方法
- 可运行脚本
- 输出格式

例如：

- `investigate`: 5 阶段事故调查方法。
- `infrastructure-kubernetes`: 通过 k8s-gateway 查 pod、events、logs。
- `metrics-analysis`: PromQL 和 Grafana 查询方法。
- `knowledge-raptor`: 查 runbook、历史事故、依赖图，也可以 teach 新知识。
- `remediation`: restart、scale、rollback，强调 dry-run 和确认。

`agent.py` 的默认工具里包含：

```python
DEFAULT_TOOLS = [
    "Skill",
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Glob",
    "Grep",
    "WebSearch",
    "WebFetch",
    "AskUserQuestion",
    "Task",
]
```

关键点：

- `Skill` 负责按需加载 `SKILL.md`，避免一开始把所有知识塞进上下文。
- `Bash` 负责运行 skill 下的 `scripts/*.py`。
- `Task` 负责启动 SDK subagent。
- `AskUserQuestion` 负责向人类补充提问。

### Skill + Script 为什么适合 SRE

SRE 调查需要很多具体系统的查询语法。如果把所有工具说明都塞进系统提示词，上下文会很快膨胀。

现在的做法是：

```text
启动时：只暴露 Skill 元数据
需要时：Agent 读具体 SKILL.md
执行时：Agent 用 Bash 跑脚本
上下文里：只留下脚本输出和结论
```

例如 Kubernetes skill 明确要求：

1. 先跑 `list_clusters.py`
2. 后续脚本必须带 `--cluster-id`
3. 不要直接跑 `kubectl`
4. 先查 events，再查 logs

这类规则适合写在 Skill 里，既清楚，又不污染所有请求的初始上下文。

## 10. credential-proxy：Agent 怎么拿到外部系统权限

生产安全设计是：sandbox 不直接持有真实 API key。

`sandbox_manager.py` 创建 sandbox 时会设置这些环境变量：

- `ANTHROPIC_BASE_URL=http://localhost:8001`
- `ANTHROPIC_API_KEY=placeholder`
- `GRAFANA_BASE_URL`
- `PROMETHEUS_BASE_URL`
- `GITHUB_BASE_URL`
- `SLACK_BASE_URL`
- `CREDENTIAL_RESOLVER_URL`
- `K8S_GATEWAY_URL`
- `RAPTOR_URL`

真正的凭据由 Envoy + credential-resolver 注入。sandbox 通过 JWT 表明自己属于哪个 tenant/team，credential-resolver 再决定注入哪个密钥。

这就是为什么很多 Skill 文档会说“不要检查环境变量里的真实 key，直接跑脚本”。

## 11. 上下文管理

IncidentFox 的上下文可以分成五类。

### 11.1 用户消息上下文

Slack 触发时，`slack-bot/investigation_handler.py` 会构造 thread context。

它会把 Slack thread 里的消息整理成：

```xml
<thread_context>
Full conversation history in this thread:
...
</thread_context>
```

触发消息会标记：

```text
<<< THIS MESSAGE TRIGGERED YOU
```

这样 Agent 不是只看一条告警，而是能看到 thread 里人类已经讨论过什么。

### 11.2 SDK 会话上下文

同一个 `thread_id` 在同一个 sandbox 里复用同一个 `ClaudeSDKClient`。这让后续提问可以接着前面的调查讲。

这是最核心的短期记忆。

### 11.3 文件上下文

附件会被放进 `/workspace/attachments`。Agent 生成的图片或文件如果在最终 Markdown 里引用，`agent.py` 会抽取并随 `result` 事件带回。

相关函数：

- `_extract_images_from_text()`
- `_extract_files_from_text()`

它们都做了路径检查，只允许 `/workspace` 内文件，避免读到 sandbox 外的敏感路径。

### 11.4 subagent 上下文隔离

`Task` 工具启动 subagent 后，SDK 会给 subagent 独立上下文。主 Agent 只拿回结果摘要。

事件层为了 UI 展示，会用 `parent_tool_use_id` 关联 subagent 内部工具：

- `agent.py` 维护 `_tool_parent_map`
- `events.py` 支持 `parent_tool_use_id`
- `slack-bot/stream_handler.py` 把 subagent 的工具挂到对应 Task 下

这让主上下文更干净，也让 UI 能展示“某个 subagent 跑了哪些工具”。

### 11.5 team config 上下文

sandbox 第一次创建 session 时调用 `load_team_config()`：

```python
CONFIG_SERVICE_URL/api/v1/config/me/effective
```

它支持两种鉴权：

1. `TEAM_TOKEN`
2. `INCIDENTFOX_TENANT_ID + INCIDENTFOX_TEAM_ID`

读取到的配置决定：

- root agent 的 system prompt
- allowed tools
- subagents 的 prompt 和 tools
- model 参数，如 temperature、max_tokens、top_p
- max_turns

## 12. 记忆：短期、长期、审计不是一回事

“记忆”在这个仓库里有多个层次，不能混为一谈。

### 12.1 短期记忆：SDK session

位置：`sre-agent/sandbox_server.py` 的 `_sessions`。

用途：同一个调查线程内连续对话。

生命周期：sandbox pod 存活期间。

### 12.2 长期知识：RAPTOR knowledge base

位置：`sre-agent/.claude/skills/knowledge-raptor/SKILL.md` 和相关 scripts。

Agent 可以：

- `search.py`: 搜索知识。
- `search_incident.py`: 根据症状找 runbook 和历史事故。
- `query_graph.py`: 查依赖、owner、blast radius。
- `find_similar.py`: 找类似历史事故。
- `teach.py`: 把新学到的知识写回知识库。

`teach.py` 调用：

```text
POST /api/v1/teach
```

这是 Agent 的长期学习入口之一。

### 12.3 知识教学审批

`config_service/src/db/models.py` 里有 `PendingKnowledgeTeaching`。

它表示 Agent 学到的新知识可以进入审批流：

1. Agent 提出 teaching。
2. 状态为 pending 或 auto_approved。
3. 人类 approve/reject/merge。
4. approve 后写入 RAPTOR。

对应 API 在 `config_service/src/api/routes/teaching.py`。

注意：`knowledge-raptor/scripts/teach.py` 是直接打 RAPTOR 的 teach API；`config_service` 的 teaching 审批流是另一条管理路径。看代码时要分清楚。

### 12.4 审计记忆：AgentRun 和 AgentToolCall

`config_service/src/db/models.py` 里还有：

- `AgentRun`
- `AgentToolCall`
- `AgentFeedback`

这些用于审计和分析：

- 谁触发了 Agent。
- 哪个 Agent 跑了多久。
- 调了多少工具。
- 输出摘要是什么。
- 用户反馈如何。

orchestrator 的 `AuditApiClient` 会记录部分 agent run。但当前 `sre-agent` 自己的 SSE 工具事件没有在 `agent.py` 里直接写入 `AgentToolCall` 表。

## 13. 中断和提问

### 13.1 Interrupt

外层入口：

```text
POST /interrupt
```

流转：

```text
server.py /interrupt
  -> sandbox_manager.interrupt_sandbox()
  -> sandbox_server.py /interrupt
  -> InteractiveAgentSession.interrupt()
  -> self.client.interrupt()
```

`agent.py` 里会返回：

```text
Task interrupted. Send a new message to continue.
```

限制也写在代码注释里：SDK 的 `interrupt()` 不一定杀掉已经启动的长时间 Bash 子进程。

### 13.2 AskUserQuestion

`agent.py` 的 `can_use_tool_handler()` 特殊处理 `AskUserQuestion`：

1. Agent 想提问时，代码发 `question` event。
2. Slack bot 发交互表单。
3. 用户提交后，Slack bot 调外层 `/answer`。
4. 外层 server 转给 sandbox `/answer`。
5. `session.provide_answer()` 唤醒等待中的 callback。

如果 60 秒没人答，代码发 `question_timeout`，然后 deny 这次工具调用，让 Agent 继续。

## 14. 当前代码里的几个容易误解点

### 14.1 `thread_id` 不是 run_id

`thread_id` 是会话复用 key。相同 `thread_id` 会尽量复用 sandbox 和 SDK session。

`correlation_id` 或 `run_id` 更偏审计、追踪一次请求。

orchestrator 的 `AgentApiClient.run_agent()` 里有注释说明：

```text
session_id = stable per thread
correlation_id = unique per request
```

### 14.2 `AgentSession` 不是当前 checkpoint

数据库模型存在，但当前 `sre-agent` 没用它恢复 SDK 会话。

### 14.3 config-service 的 `tools` 不等于 SDK allowed_tools

config-service 默认工具是业务语义工具，如 `list_pods`、`get_cloudwatch_metrics`。

当前 `sre-agent/agent.py` 的 SDK allowed tools 是 Claude SDK 工具名，如 `Skill`、`Bash`、`Task`、`Read`。

`agent.py` 目前会尝试使用 root config 的 `tools.enabled` / `tools.disabled` 结构。但 config-service 默认是 `{tool_id: true}` 字典格式。这也是后续 config-driven agents 需要继续收敛的地方。

### 14.4 Web UI 当前可能走 orchestrator 事件格式

`web_ui/src/app/api/team/agent/stream/route.ts` 默认把请求转到：

```text
/agents/{agent_name}/run/stream
```

而当前 `sre-agent` 对外是：

```text
/investigate
```

所以 Web UI 可能通过 orchestrator 或兼容层接入；不要只看 `useAgentStream.ts` 就判断 `sre-agent` 的原生事件格式。

## 15. 代码索引

### 入口与流式返回

- `sre-agent/server.py`
  - `InvestigateRequest`: 外部请求模型。
  - `investigate()`: `/investigate` 入口。
  - `_investigate_inner()`: 创建/复用 sandbox。
  - `create_investigation_stream()`: 透传 sandbox SSE。
  - `interrupt()`: 外层中断入口。
  - `answer_question()`: 外层人类回答入口。

### sandbox 生命周期

- `sre-agent/sandbox_manager.py`
  - `create_sandbox()`: 直接创建 sandbox。
  - `create_sandbox_from_pool()`: warm pool 创建。
  - `get_sandbox()`: 根据 thread 找 sandbox。
  - `reset_sandbox_ttl()`: follow-up 时延长生命周期。
  - `execute_in_sandbox()`: 通过 sandbox-router 调 sandbox `/execute`。
  - `interrupt_sandbox()`: 转发中断。
  - `send_answer_to_sandbox()`: 转发人类回答。

### sandbox 内运行时

- `sre-agent/sandbox_server.py`
  - `_sessions`: `thread_id -> InteractiveAgentSession`。
  - `get_or_create_session()`: 懒加载 team config 并创建 session。
  - `_download_files_from_proxy()`: 把 Slack 文件下载到 `/workspace/attachments`。
  - `execute()`: sandbox 内执行入口。
  - `interrupt()`: sandbox 内中断入口。
  - `answer_question()`: sandbox 内回答入口。

### Agent session 与 ReAct 映射

- `sre-agent/agent.py`
  - `InteractiveAgentSession.DEFAULT_TOOLS`: 默认 SDK 工具。
  - `__init__()`: 组装 `ClaudeAgentOptions`、subagents、hooks。
  - `start()`: 创建并启动 `ClaudeSDKClient`。
  - `execute()`: 发送用户消息，读取 SDK 消息，转换 SSE。
  - `interrupt()`: 调 SDK interrupt。
  - `provide_answer()`: 唤醒 AskUserQuestion 等待。
  - `_extract_images_from_text()` / `_extract_files_from_text()`: 从最终 Markdown 抽取附件。

### SSE 协议

- `sre-agent/events.py`
  - `StreamEvent`
  - `thought_event`
  - `tool_start_event`
  - `tool_end_event`
  - `result_event`
  - `error_event`
  - `question_event`
  - `question_timeout_event`

### 配置与拓扑

- `config_service/src/core/hierarchical_config.py`
  - `get_default_agent_config()`: 默认 STARSHIP Agent 拓扑。
  - `get_full_default_config()`: 合成默认配置，设置 `entrance_agent = "planner"`。

- `config_service/templates/01_slack_incident_triage.json`
  - 生产质量默认 prompt 和 agent topology 模板。

- `sre-agent/config.py`
  - `load_team_config()`: 从 config-service 拉 effective config。
  - `get_root_agent_config()`: 选择 root agent。

### Skill 与记忆

- `sre-agent/.claude/skills/`
  - 所有内置 skills。

- `sre-agent/.claude/skills/knowledge-raptor/SKILL.md`
  - 长期知识检索与 teach 工作流。

- `config_service/src/db/models.py`
  - `AgentRun`
  - `AgentToolCall`
  - `SlackSessionCache`
  - `AgentSession`
  - `PendingKnowledgeTeaching`

## 16. 一句话总结

IncidentFox 当前 Agent 编排可以理解成：

```text
外层 server 负责安全地找到或创建 sandbox；
sandbox 内部用 thread_id 维护一个 SDK 长会话；
SDK 托管 ReAct 循环；
项目把 SDK 的 thought/tool/result 转成 SSE；
Skill + scripts 负责真实系统调查；
RAPTOR 和审计表负责长期知识与运行记录；
完整持久化 checkpoint 和严格 config-driven subagent 图仍是后续工作。
```
