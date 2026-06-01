---
doc_id: DOC-IFX-RULE-20260601-002
title: "IncidentFox Git 协作与上游同步工作流"
category: 01-rules
doc_type: 规范
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["git", "workflow", "branching", "upstream-sync", "fork"]
summary: "Liny777/incidentfox fork 仓的分支、commit、PR 与上游 incidentfox 同步规则。"
related_docs:
  - "DOC-IFX-RULE-20260601-001"
related_artifacts:
  - ".gitignore"
  - ".gitleaks.toml"
---
# IncidentFox Git 协作与上游同步工作流

## 1. 仓库关系

```
upstream: https://github.com/incidentfox/incidentfox  (官方原仓)
origin:   https://github.com/Liny777/incidentfox      (本人 fork，主开发仓)
local:    /Users/liny/Documents/Code/profession-sre-agent/incidentfox-main
```

- `origin/main` 是发布分支，受保护，只接受 PR 合入。
- `upstream` 用于定期 sync 上游官方更新。
- License：Apache 2.0（核心）+ BSL 1.1（部分企业模块），LICENSE/LICENSE-ENTERPRISE/LICENSING.md 不能改。

## 2. 分支命名

| 类型 | 命名 | 例 |
| --- | --- | --- |
| 主分支 | `main` | — |
| 改造功能分支 | `feat/<topic>-<short>` | `feat/user-memory-pvc` |
| Bug 修复 | `fix/<topic>-<short>` | `fix/sandbox-init-race` |
| 文档 | `docs/<topic>` | `docs/governance-v1` |
| 上游同步 | `sync/upstream-<YYYYMMDD>` | `sync/upstream-20260615` |
| 重构 | `refactor/<topic>` | `refactor/credential-proxy-split` |

禁止直接 push 到 `main`；所有变更走 PR。

## 3. Commit 规范

格式：`<type>: <短描述>`（参考 Conventional Commits，但不强制 scope）

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | bug 修复 |
| `docs` | 文档变更（含 `document/` 下任何文件） |
| `refactor` | 重构 |
| `chore` | 构建、依赖、CI、licensing |
| `test` | 测试相关 |
| `perf` | 性能优化 |

正文（可选）说明 why；尾部加 `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` 当 Claude 协作产出时。

示范：

```
feat: add user-level MEMORY persistence to sandbox cwd

Mount per-user PVC at /workspace and rely on Claude SDK
setting_sources=["user","project"] to auto-load CLAUDE.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## 4. PR 流程

1. 从 `main` 切 feature 分支，开发。
2. 写完跑：
   - 代码侧：`make dev` 起本地全栈，端到端验证。
   - 文档侧：`bash document/01-rules/scripts/validate_docs_metadata.sh` 必须 PASS。
3. 推 origin：`git push -u origin feat/<topic>-<short>`。
4. 在 GitHub 开 PR，base=`main`，描述含：
   - 「Summary」：1-3 句
   - 「Test plan」：勾选清单
   - 「Linked docs」：`document/` 下的方案/实施记录 `doc_id` 列表
5. Self-review 一遍，merge（squash or merge commit 都可，默认 squash）。

## 5. 上游同步工作流

每 1-2 周或上游有重要 release 时做一次。

```bash
cd /Users/liny/Documents/Code/profession-sre-agent/incidentfox-main

# 拉上游
git fetch upstream

# 切 sync 分支（不直接在 main 上 merge）
DATE=$(date +%Y%m%d)
git checkout -b sync/upstream-$DATE main

# 选 merge 还是 rebase
#   - 主仓 main 的改造历史已 push，且 commit 较多 → 用 merge（保留历史，明确合入点）
#   - 改造很少、纯文档 → 用 rebase（线性历史更整洁）
git merge upstream/main
# 或：git rebase upstream/main

# 解冲突，重点关注：
#   - sre-agent/agent.py（核心 agent 逻辑，会和 user memory 改动冲突）
#   - charts/incidentfox/（Helm values，会和 PVC 配置冲突）
#   - config_service/src/db/models.py（DB schema，可能新增字段）
#   - .gitignore（上游可能新增条目）

# 验证：
#   bash document/01-rules/scripts/validate_docs_metadata.sh
#   make dev   # 端到端跑一次

git push origin sync/upstream-$DATE
# 开 PR 到 main，PR 描述贴上游 commit 链接
```

冲突原则：
- 上游的安全修复、bug fix → 优先保留上游版本。
- 本仓的改造逻辑（user memory、skill upload、custom agent UI 等）→ 优先保留本仓版本，但要适配上游 API 改动。
- 文档（`document/`）→ 本仓独占，不会有冲突（上游没有这个目录）。

## 6. 安全约束

- 严禁提交：`.env`（含真实 key）、`*.tfstate`、`*.tfvars`、`database/local/tmp_secrets/`、任何含真实 ANTHROPIC/OPENAI/MINIMAX key 的文件。`.gitignore` 已配齐；本规范作为冗余防线。
- 推 PR 前可选跑 `gitleaks detect --config .gitleaks.toml` 做 secret 扫描。
- 不要绕过 `pre-commit` / `pre-push` hook（`--no-verify`）。
- 不在 PR 描述、commit message 里写真实密钥或客户 ID。

## 7. 仓库结构基线（首版 baseline 后）

```
Liny777/incidentfox  (origin)
├── main           ← 受保护分支
└── feat/*, fix/*, docs/*, sync/*   ← 工作分支
```

历史：首版 `chore: initial baseline forked from incidentfox upstream`，作为 fork baseline；后续所有变更都建立在它之上。
