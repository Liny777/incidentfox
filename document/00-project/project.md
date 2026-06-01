---
doc_id: DOC-IFX-PROJ-20260601-001
title: "IncidentFox 改造仓项目说明"
category: 00-project
doc_type: 项目说明
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["project", "onboarding", "fork", "openclaw-migration", "incidentfox"]
summary: "本仓 Fork 自 incidentfox 官方仓，目标是替代既有的 OpenClaw Docker 平台。项目定位、与上游关系、改造路线、文档治理、新人入门路径。"
related_docs:
  - "DOC-IFX-INDEX-20260601-001"
  - "DOC-IFX-RULE-20260601-001"
  - "DOC-IFX-RULE-20260601-002"
related_artifacts:
  - "README.md"
  - "AGENTS.md"
  - "CLAUDE.md"
  - "Makefile"
  - "charts/incidentfox/values.yaml"
---
# IncidentFox 改造仓项目说明

> 本文档是项目入口。读完本文之后再按 §7 路径深入。

## 1. 项目定位

本仓是 [`incidentfox/incidentfox`](https://github.com/incidentfox/incidentfox) 的 fork，承担两件事：

1. **替代 OpenClaw Docker 平台**：原 `openclaw-docker/`（FastAPI daemon + React 前端 + 用户级 OpenClaw 容器编排，详见 `../../openclaw-docker/project.md`）已支撑 12 子 Agent + Skill 上传 + IAM + 入站 URL 等企业能力，但模型层最近切到 OpenAI 兼容的 MiniMax-M2.7，与上游 Claude Agent SDK 生态有割裂。我们改用 incidentfox 作为基底，结合 IT 公司既有的 K8s + gVisor 能力，重做一套面向企业 SRE 场景的运维 Agent 平台。
2. **基于上游做改造**：保留 incidentfox 原生 K8s + gVisor sandbox-per-investigation 架构、Claude Agent SDK + 45 个 Skills 生态、RAPTOR 知识库；不重写底盘。改造只对准 OpenClaw 已经验证过价值的几个补丁点（详见 §4）。

License：上游 Apache 2.0（核心）+ BSL 1.1（部分企业模块）。`LICENSE` / `LICENSE-ENTERPRISE` / `LICENSING.md` 原样保留，不可修改。

## 2. 与上游关系

```
upstream: https://github.com/incidentfox/incidentfox       (官方原仓)
origin:   https://github.com/Liny777/incidentfox           (本仓，主开发仓)
local:    /Users/liny/Documents/Code/profession-sre-agent/incidentfox-main
```

- 主开发分支：`origin/main`，PR 流程，禁止直推。
- 上游同步周期：1-2 周或上游 release 时，走 `sync/upstream-<date>` 分支。详见 [01-rules/git-workflow.md](../01-rules/git-workflow.md)。

## 3. 当前架构

上游 incidentfox 拓扑（保留不动）：

```
Slack         → slack-bot (Bolt/Socket Mode) ─┐
Web UI        → web_ui (Next.js 16)            ├→ sre-agent (Claude Agent SDK) → gVisor sandbox
Webhook       → orchestrator                  ─┘                     ↕
                                                       credential-proxy (Envoy + LiteLLM)

control plane: config-service (FastAPI + PostgreSQL，多租户配置 + RBAC + 审计)
knowledge:     ultimate_rag (RAPTOR 知识树 + 教学接口)
```

关键架构特点（详见仓库根 [CLAUDE.md](../../CLAUDE.md) 与 [AGENTS.md](../../AGENTS.md)）：

- **sre-agent**：Claude Agent SDK + 45 个 `.claude/skills/`（progressive disclosure，metadata ~100 token、按需加载）+ subagents（log-analyst / k8s-debugger / remediator）+ 沙箱内 Bash/Python 脚本。**无 MCP 工具**。
- **credential-proxy**：Envoy + Python `credential-resolver`。`llm_proxy.py` 已 `import litellm`，识别 `minimax/`、`openai/`、`gemini/` 等 24+ provider 前缀；Claude 模型直通 anthropic API，其他模型走 `anthropic_to_openai_request()` 翻译 → LiteLLM → 反向翻译 → Anthropic SSE 回 SDK。
- **config-service**：Org → Team 两层多租户配置，dict 递归 merge / list 全替换；team config 已支持 `agents.{name}.prompt.system` + `tools.enabled` 字典式 subagent 注册（[`sre-agent/agent.py:632-649`](../../sre-agent/agent.py)）。

## 4. 改造路线（已立项的 4 件事）

> 详见前置架构评估：项目 memory `project-incidentfox-replace-openclaw` 或 `/Users/liny/.claude/plans/users-liny-documents-code-profession-sr-snoopy-nova.md`。

| # | 主题 | 优先级 | 工时 | 目标 |
| --- | --- | --- | --- | --- |
| 1 | **切 MiniMax 模型** | P0 | 0.5-1 人天 | config-service `ai_model.model = "minimax/M2.7"`，验证 tool_calls + SSE + subagent 委派 |
| 2 | **中期记忆（用户跨会话 MEMORY）** | P0 | 3-5 人天 | PVC 挂 `/workspace/MEMORY.md`，利用 Claude SDK `setting_sources=["user","project"]` 自动加载；防污染开关复用 OpenClaw 的 `direct=1` 方案 |
| 3 | **自定义 Agent UI** | P1 | 5-8 人天 | web_ui 加「Agents」面板，对接 config-service 的 `team_config.agents` schema |
| 4 | **Skill 上传** | P1 | 7-12 人天 | 上传 API + S3/MinIO 存储 + sandbox init container 拉取 + 审批 + web_ui |

完成上面 4 项即视为「最小可替代 OpenClaw」（合计 4-5 周）。

后续增量（P2，可分期）：
- 长期 Incident 库：贯通 `ultimate_rag/` 的 `teach_from_incident()`（架构已齐全，落地 2-4 周）
- OpenClaw 风 main+12 子 Agent 委派图：移植 `agent_builder.py` 模式到 sre-agent（1-2 周）

## 5. 文档治理

所有改造过程文档进入 `document/` 单根。规则正本：

- [01-rules/doc-governance.md](../01-rules/doc-governance.md) — 11 字段 frontmatter、13 个 `doc_type`、`DOC-IFX-<TYPE>-<DATE>-<NNN>` 命名
- [01-rules/git-workflow.md](../01-rules/git-workflow.md) — 分支、commit、PR、上游同步规则
- [01-rules/templates/](../01-rules/templates/) — 8 份 frontmatter 模板
- [01-rules/scripts/validate_docs_metadata.sh](../01-rules/scripts/validate_docs_metadata.sh) — 校验脚本

校验：

```bash
bash document/01-rules/scripts/validate_docs_metadata.sh
```

## 6. 部署与本地开发

> 上游原生方案，本仓暂不改。

- **本地全栈**：`make dev` 起 postgres + config-service + credential-resolver + envoy + sre-agent。需要 `.env` 里填 `ANTHROPIC_API_KEY`（或切 MiniMax 后填 `MINIMAX_API_KEY`）。
- **本地 + Slack**：`make dev-slack`，额外配 `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN`。
- **EKS 部署**：Helm chart 在 `charts/incidentfox/`，环境 values 在 `charts/incidentfox/values.staging.yaml` / `values.prod.yaml`。CI 走 `.github/workflows/deploy-eks.yml`（手动触发）。Secrets 通过 ExternalSecrets Operator 从 AWS Secrets Manager 同步到 K8s Secrets。

未来本仓新增的部署变更（如 MEMORY PVC、Skill MinIO bucket）写到 [04-operations/](../04-operations/) 并配 `.meta.md` 侧车。

## 7. 新人阅读路径

1. **本文档**（你正在读的）：建立项目地图。
2. 上游 [README.md](../../README.md)：了解 incidentfox 是什么、能干什么。
3. 上游 [AGENTS.md](../../AGENTS.md) + [CLAUDE.md](../../CLAUDE.md)：架构、关键文件、避坑指南。
4. 上游 [CONTRIBUTING.md](../../CONTRIBUTING.md) + [DEVELOPMENT_KNOWLEDGE.md](../../DEVELOPMENT_KNOWLEDGE.md)：贡献流程与隐藏知识。
5. 本仓 [01-rules/doc-governance.md](../01-rules/doc-governance.md) + [01-rules/git-workflow.md](../01-rules/git-workflow.md)：本仓的文档与协作规则。
6. 本仓 [03-development/](../03-development/)：当前改造工作的方案、评审、实施、验证、问题。
7. 跑一次本地全栈（`make dev`）+ 端到端 investigate 一次，建立感性认识。
8. 选一个 P0/P1 任务（§4 表），按 plan → review → implementation → verify 闭环走。

## 8. 与上游的命名冲突说明

上游 README/AGENTS 提及多个仍残留的「Codex Agent SDK」名词，但实际代码 import 的是 `claude_agent_sdk`（见 `sre-agent/pyproject.toml` 与 `sre-agent/agent.py:38`）。这是上游文档与代码不一致的遗留问题，本仓改造涉及到时统一以代码为准（`claude-agent-sdk==0.1.19`）。
