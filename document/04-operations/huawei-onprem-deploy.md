---
doc_id: DOC-IFX-OPS-20260603-001
title: "IncidentFox 华为内网离线部署指南"
category: 04-operations
doc_type: 运维指南
status: active
created_at: 2026-06-03
updated_at: 2026-06-03
owners: ["Liny777"]
tags: ["huawei", "on-prem", "offline-deploy", "minimax", "docker-compose", "basepath", "pg-schema"]
summary: "把 IncidentFox 离线部署到华为内网三台 EC2(linux amd64)+ 远端共享 PG + 内网 MiniMax LLM 网关的完整指南,含 5 处源码定制、配置改动、打包流程、踩坑排查。"
related_docs: []
related_artifacts:
  - "web_ui/next.config.ts"
  - "web_ui/src/app/layout.tsx"
  - "web_ui/src/app/api/team/agent/stream/route.ts"
  - "config_service/src/db/session.py"
  - "sre-agent/credential-proxy/src/credential_resolver/llm_proxy.py"
---
# IncidentFox 华为内网离线部署指南

> 目标:在公司内网(无外网)三台 EC2(linux/amd64)上跑通 IncidentFox,LLM 走内网 MiniMax 网关,PG 用远端共享实例(schema 隔离)。
> 镜像在能上外网的 Mac 上 `docker buildx` 构建(amd64)后 `docker save` 成 tar,搬到内网 `docker load`。

## 1. 适用场景

- **何时用**:内网无外网、需要把 IncidentFox 整套挪进华为内网部署或后续迭代重新部署时。
- **前置条件**:
  - 一台能上外网的 amd64 或带 buildx 的构建机(Mac M 系列用 QEMU 跨架构,较慢)。
  - 内网三台 EC2,装好 Docker + docker compose,linux/amd64。
  - 内网可达的 LLM 网关(OpenAI Chat Completions 兼容)、共享 PG 实例。
  - 公司域名网关可把外部 HTTPS 转发到 EC2-A:80。

## 2. 拓扑 / 架构

```
                   公司域名网关 (HTTPS, 终结 TLS)
   https://console.his-op-beta.huawei.com/incident/web-ui
                          │ 保留 /incident/web-ui 前缀, 转发到 EC2-A:80
                          ▼
   ┌─────────────────────────────┐
   │ EC2-A 前端机                 │  web_ui(Next.js) + nginx:80
   │ 7.198.155.36                │
   └──────────────┬──────────────┘
                  │ 内网调用 (server-side):8000 /:8080
                  ▼
   ┌─────────────────────────────────────────────┐
   │ EC2-B 核心机 7.198.153.97                     │
   │  sre-agent:8000  config-service:8080          │
   │  envoy:8001(内部)  credential-resolver:8002   │
   └───────┬───────────────────────┬──────────────┘
           │ SQL                    │ LLM 出站(注入 key + 跳 SSL)
           ▼                        ▼
   远端 PG 7.198.147.89:5432    内网 MiniMax 网关
   库 wesee / schema incidentfox   /llm/gateway/v2 (OpenAI 兼容)
```

- **EC2-C(slack-bot)本期不部署**:Socket Mode 出站连 slack.com,内网用 web_ui 入口即可。
- **orchestrator 不部署**:IncidentFox 的**可选编排层**(webhook 路由:GitHub/PagerDuty/Incident.io 等告警源 → 对应 team 的 agent;多团队开通;结果回写 GitHub PR/issue)。仅"多告警源自动触发 + 多团队"场景需要。本部署是工程师在网页手动提问的最小场景,`web_ui → sre-agent` 直连即可,**永不需要**这一层。注意:web_ui 聊天代码默认想连 orchestrator(`AGENT_SERVICE_URL || ORCHESTRATOR_URL`,调 orchestrator 风格端点 `/agents/{name}/run/stream`),我们把 `AGENT_SERVICE_URL` 直指 sre-agent,但端点对不上 → §3.3 已改为调 sre-agent 的 `/investigate`。其他可选服务(`ai_pipeline / k8s_agent / k8s_gateway / ultimate_rag`)同理,本地栈均不启用。
- **关键认知**:EC2-B 不需要公网域名。web_ui 是 server-side 经内网 IP 调 sre-agent/config-service,浏览器只跟 web_ui 通信。

## 3. 五处源码定制(逃不掉,重新部署必带)

> 这些是上游代码对"内网 + 子路径 + 共享 PG + 自定义 LLM 网关"场景的硬假设缺口。`git pull` 上游后需重新确认这 5 处。

### 3.1 web_ui basePath(子路径部署)
- 文件:`web_ui/next.config.ts`
- 改动:加 `basePath` / `assetPrefix = process.env.NEXT_PUBLIC_BASE_PATH || "/incident/web-ui"`。
- 原因:挂在 `/incident/web-ui` 子路径,不设 basePath 则静态资源 404。

### 3.2 web_ui 客户端 fetch 补前缀(修登录 405)
- 文件:`web_ui/src/app/layout.tsx`
- 改动:`<head>` 注入全局 fetch patch,给同源 root-relative `/api/..` 自动补 basePath 前缀。
- 原因:55 处客户端 `fetch('/api/..')` 是相对路径,`next/link` 自动加 basePath 但**原生 fetch 不会**。登录 POST 打到 `console.../api/session/login`(无前缀)→ 网关 405。

### 3.3 web_ui agent/stream 适配 /investigate(修聊天 404)
- 文件:`web_ui/src/app/api/team/agent/stream/route.ts`
- 改动:upstream 从 orchestrator 的 `/agents/{name}/run/stream` 改为 sre-agent 的 `POST /investigate`,并把 SSE 事件翻译成 useAgentStream 期望的格式(thought→message,tool_start→tool_started,tool_end→tool_completed,result→agent_completed,error→agent_completed)。
- 原因:未部署 orchestrator,AGENT_SERVICE_URL 直指 sre-agent(server_simple.py),只有 /investigate。

### 3.4 config-service PG search_path(共享 schema)
- 文件:`config_service/src/db/session.py`
- 改动:`make_engine()` 的 `connect_args.options` 支持追加 `PG_SEARCH_PATH`(env 控制,默认不动)。
- 原因:共享 PG 用 `incidentfox` schema 隔离时,Alembic 走 URL options 建表到该 schema,但运行时/seed 的 `connect_args.options="-c statement_timeout"` 覆盖了 URL 的 search_path → 找不到 `org_nodes` 表。

### 3.5 credential-resolver 自定义 LLM 网关(openai api_base + SSL)
- 文件:`sre-agent/credential-proxy/src/credential_resolver/llm_proxy.py`
- 改动:① `openai` provider 分支读 `creds.api_base`(原本只有 ollama/azure/custom_endpoint 读,openai 不读 → 会调 api.openai.com);② 顶部 `LLM_SSL_VERIFY=false` 时 `litellm.ssl_verify=False`。
- 原因:内网 MiniMax 网关是 OpenAI 兼容但 ① 需指向自定义 base_url ② 用内部 CA。`KNOWN_PROVIDERS` 不含 `custom_endpoint`,故走 `openai` provider + api_base。

### 3.6 附带的 Dockerfile 改动(构建期网络)
- `web_ui/Dockerfile`、`config_service/Dockerfile`:去掉 `apt-get upgrade`(被公司代理 198.18.x 拦 502)。
- `config_service/Dockerfile`:删掉装 nodejs 的步骤(MCP preview 用不上,华为云 nodesource 镜像 404)。
- `sre-agent/Dockerfile.simple`:apt 走 `mirrors.huaweicloud.com`,nodejs 走 `deb.nodesource.com`(实测可达)。

## 4. 配置改动(不进 git,部署时按环境填)

### 4.1 EC2-B `.env` 关键项(密钥用真实值,勿提交)
```ini
DATABASE_URL="postgresql+psycopg2://<user>:<urlenc-pwd>@<pg-host>:5432/wesee?sslmode=disable&options=-c%20search_path%3Dincidentfox%2Cpublic"
TOKEN_PEPPER=<openssl rand -hex 32>
ADMIN_TOKEN=<openssl rand -hex 24>
OPENAI_API_KEY=<内网 LLM 网关 key>
CONFIG_MODE=local            # ★ 必须,否则走 DB 模式用 seed 的 gpt-5.2 默认值
LLM_SSL_VERIFY=false         # ★ 内网网关内部 CA,跳过证书校验
PG_SEARCH_PATH=incidentfox,public
LOG_LEVEL=INFO
```
> 密码含 `@` `#` 等特殊字符**必须 URL-encode**(`@`→`%40`,`#`→`%23`),整个 DATABASE_URL 带引号(含 `&`)。

### 4.2 EC2-B `config/local.yaml`(LLM 指向)
```yaml
ai_model:
  provider: openai            # KNOWN_PROVIDERS 限定,用 openai 不是 custom_endpoint
  model_id: MiniMax-M2.7      # 注意是 MiniMax 不是 MinMax
  base_url: https://console.his-op-beta.huawei.com/llm/gateway/v2
integrations:
  openai:
    api_key: ${OPENAI_API_KEY}
    api_base: https://console.his-op-beta.huawei.com/llm/gateway/v2
```

### 4.3 EC2-A `.env`
```ini
CONFIG_SERVICE_URL=http://7.198.153.97:8080
AGENT_SERVICE_URL=http://7.198.153.97:8000
WEB_UI_COOKIE_SECURE=1
WEB_UI_PUBLIC_BASE_URL=https://console.his-op-beta.huawei.com/incident/web-ui
```

### 4.4 远端 PG 一次性准备(DBA 执行)
```sql
\c wesee
CREATE SCHEMA IF NOT EXISTS incidentfox AUTHORIZATION <user>;
GRANT ALL ON SCHEMA incidentfox TO <user>;
-- ALTER USER ... SET search_path 若被权限系统禁用,改用 DATABASE_URL 的 options 注入(见 4.1)
```

## 5. 步骤

### 5.1 构建(外网构建机)
```bash
cd incidentfox-deploy
bash build/build-and-package.sh        # 产出 ec2-a / ec2-b 镜像 tar + 配置
# 单服务迭代:bash build/rebuild-webui.sh 或 rebuild-resolver.sh
```

### 5.2 部署(内网,先 EC2-B 再 EC2-A)
```bash
# EC2-B
docker load -i ec2-b-core.tar
cd /home/ec2-b-package && docker-compose up -d
# EC2-A
docker load -i ec2-a-web-ui.tar
cd /home/ec2-a-package && docker compose up -d
```

### 5.3 单服务热替换(迭代)
```bash
docker load -i <service>-new.tar
docker-compose up -d --force-recreate <service>
```

## 6. 验证

```bash
# EC2-B 后端
curl http://localhost:8080/health        # config-service
curl http://localhost:8000/health        # sre-agent
# LLM 全链路(应返回中文回复)
curl -N -X POST http://localhost:8000/investigate \
  -H "Content-Type: application/json" -d '{"prompt":"你好,确认你能正常工作"}'
# config 是否读到 local.yaml(integrations 应含 llm + openai)
curl -s http://localhost:8080/api/v1/config/me -H "X-Org-Id: local" -H "X-Team-Node-Id: default" \
  | python3 -m json.tool | grep -A6 integrations
# web_ui
curl http://localhost/incident/web-ui/   # EC2-A,200
```

团队 token(网页跑调查需要,admin token 不行):
```bash
curl -s -X POST http://localhost:8080/api/v1/admin/orgs/local/teams/default/tokens \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | python3 -m json.tool
```

## 7. 故障排查(已踩的坑)

| 症状 | 根因 | 处置 |
| --- | --- | --- |
| config-service 起不来,`could not translate host name "321#@postgres"` | DATABASE_URL 密码含 `@#` 未 URL-encode | `@`→`%40` `#`→`%23`,整串带引号 |
| seed 报 `relation "org_nodes" does not exist` | connect_args.options 覆盖 URL search_path | §3.4 改 session.py + `PG_SEARCH_PATH` env |
| 登录 405,F12 看请求无 `/incident/web-ui` 前缀 | 客户端 fetch 丢 basePath | §3.2 layout.tsx fetch patch |
| effective_config 的 integrations 为空、agents 全是 gpt-5.2 | 没设 `CONFIG_MODE=local`,走 DB seed 默认 | `.env` 加 `CONFIG_MODE=local` 重启 config-service |
| LLM 403 `No credentials found for anthropic` | model 拿不到 fallback 到 claude → 找 anthropic 凭证 | 同上 CONFIG_MODE + §3.5 |
| LLM 404 `No adapter found for model: MinMax-M2.7` | 模型名拼错 | 是 `MiniMax-M2.7`(有 i) |
| LLM `SSL: CERTIFICATE_VERIFY_FAILED` | 内网网关内部 CA | `LLM_SSL_VERIFY=false`(§3.5) |
| LLM 调到 api.openai.com 而非内网网关 | openai provider 不读 api_base | §3.5 改 llm_proxy.py |
| 网页聊天 404 `/api/team/agent/stream` | web_ui 调 orchestrator 端点但只有 sre-agent | §3.3 适配 /investigate |
| sre-agent 容器 `Created` 状态没启动 | 依赖的 config-service 当时不健康 | `docker-compose up -d sre-agent` |
| 构建 OOM `cannot allocate memory` | Docker Desktop 内存不足(QEMU build Next.js) | 释放内存(停占用容器)或调高 Docker 内存 |
| 构建 502 拉包失败 | 公司代理拦 apt/docker hub | §3.6 换镜像源 / 重试 / 断 VPN |

## 8. 升级与上游同步

- `git pull upstream` 后,重点 review 这 5 个文件(§3.1–3.5)是否被上游覆盖,必要时重打。
- 改了 `pyproject.toml`/`package.json` 必须 rebuild 对应镜像(依赖锁在镜像内)。
- 改了 `config/local.yaml` 不用 rebuild,`docker-compose restart config-service`(local 模式热重载)。
- DB schema 变更:config-service 启动自动跑 alembic(建到 incidentfox schema)。
- 长期建议:内网搭 Harbor 私有 registry,替代 save/load tar。
