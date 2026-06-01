---
doc_id: DOC-IFX-RULE-20260601-001
title: "IncidentFox 文档治理规范（v1）"
category: 01-rules
doc_type: 规范
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["governance", "specification", "rulebook", "documentation"]
summary: "IncidentFox 改造仓的文档治理规范：所有过程文档收敛进 document/，11 字段 frontmatter，12 个 doc_type 枚举，DOC-IFX 命名规则。"
related_docs:
  - "DOC-IFX-RULE-20260601-002"
  - "DOC-IFX-INDEX-20260601-001"
related_artifacts:
  - "document/01-rules/scripts/validate_docs_metadata.sh"
---
# IncidentFox 文档治理规范（v1）

## 1. 目标

让 IncidentFox 改造仓里所有过程文档**可检索、可追溯、可复用**。规则学自 `openclaw-docker/规则/文档治理规范.md`，但做了两点收敛：

- **单根**：所有文档都进 `document/`，仓库根不新增中文分类目录。
- **enum 精简**：`doc_type` 从 OpenClaw 的 39 种降到 12 种核心值。

## 2. 一级目录（写文档时按此选位置）

| 目录 | 用途 | 典型 `doc_type` |
| --- | --- | --- |
| `document/00-project/` | 项目级总览、入门 | 项目说明 |
| `document/01-rules/` | 治理规范、Git 工作流、模板、校验脚本 | 规范、模板 |
| `document/02-architecture/` | 系统设计、架构图、运行图 | 架构设计 |
| `document/03-development/plan/` | 方案/需求/技术方案 | 方案 |
| `document/03-development/review/` | 方案评审、代码评审报告 | 评审 |
| `document/03-development/implementation/` | 实施记录、变更日志 | 实施记录 |
| `document/03-development/verify/` | 测试计划/报告 | 测试报告 |
| `document/03-development/issue/` | 单一问题的复盘 | 复盘 |
| `document/04-operations/` | 部署、配置、运行手册 | 运维指南 |
| `document/05-knowledge/` | 学习笔记、API 摘录、踩坑记 | 知识卡片 |
| `document/06-retrospective/` | 跨主题阶段性复盘 | 复盘 |
| `document/07-prototype/` | UI 稿、Figma、交互原型说明 | 原型说明 |
| `document/99-archive/` | 历史版本、被归并文档 | 任意（`status: archived`）|

仓库根的 `LICENSE` / `AGENTS.md` / `CLAUDE.md` / `README.md` 等上游文件**不动**，不进 `document/` 治理。

## 3. Frontmatter（11 字段必填）

```yaml
---
doc_id: DOC-IFX-<TYPE>-<YYYYMMDD>-<SERIAL>
title: "<人类可读标题>"
category: <00-project|01-rules|02-architecture|03-development|04-operations|05-knowledge|06-retrospective|07-prototype|99-archive>
doc_type: <见 §4 枚举>
status: <draft|active|deprecated|archived>
created_at: <YYYY-MM-DD>
updated_at: <YYYY-MM-DD>
owners: ["<github-handle>"]
tags: ["<kebab-case-tag>"]
summary: "<30-100 字一句话摘要>"
related_docs: []
related_artifacts: []
---
```

### 3.1 字段约束

- `created_at` 首创建日期，后续编辑**不改**；`updated_at` 每次编辑**必须更新**。
- `tags` 一律小写 kebab-case（如 `multi-agent`、`k8s-deploy`、`memory-system`）。
- `status: archived` 只用于 `99-archive/` 下的文档。
- `owners` 至少 1 人，用 GitHub handle。
- `related_docs` 可填其他 `doc_id` 或相对路径；`related_artifacts` 填代码 / 二进制 / 配置文件的仓库相对路径。
- 数组字段即使为空也必须保留（`related_docs: []`），不能省略键。

### 3.2 `doc_id` 命名规则

格式：`DOC-IFX-<TYPE>-<YYYYMMDD>-<SERIAL>`

- `<TYPE>`：从 §4 表的「TYPE 缩写」列取。
- `<YYYYMMDD>`：创建日期，无连字符。
- `<SERIAL>`：当天内同 `TYPE` 自增三位数字（`001`、`002`、`003`...）。

**Claude 必须做的事**：写新文档前，跑 `grep -r "DOC-IFX-<TYPE>-<YYYYMMDD>" document/ | sed 's/.*-\([0-9][0-9][0-9]\).*/\1/' | sort -u | tail -1` 看当天同 TYPE 最大序号，然后 +1。或调用 `bash document/01-rules/scripts/validate_docs_metadata.sh` 看是否报 doc_id 冲突再调整。

**例**：

- `DOC-IFX-PLAN-20260601-001` — 2026-06-01 当天第 1 份方案
- `DOC-IFX-ISSUE-20260603-002` — 2026-06-03 当天第 2 份问题复盘

## 4. `doc_type` 枚举（13 个值，含资产侧车）

| `doc_type` | TYPE 缩写 | 落地目录 | 描述 |
| --- | --- | --- | --- |
| 项目说明 | `PROJ` | `00-project/` | 项目背景、架构概览、入门 |
| 目录索引 | `INDEX` | 任意 `README.md` | 子目录导航 |
| 规范 | `RULE` | `01-rules/` | 治理规则、工作流规则 |
| 模板 | `TPL` | `01-rules/templates/` | frontmatter + 正文骨架模板 |
| 架构设计 | `ARCH` | `02-architecture/` | 系统设计、架构图、运行图说明 |
| 方案 | `PLAN` | `03-development/plan/` | 技术方案、需求方案、实施方案 |
| 评审 | `REVIEW` | `03-development/review/` | 方案评审、代码评审报告 |
| 实施记录 | `IMPL` | `03-development/implementation/` | 落地变更日志 |
| 测试报告 | `VERIFY` | `03-development/verify/` | 测试计划、结果 |
| 复盘 | `ISSUE` | `03-development/issue/` 或 `06-retrospective/` | 问题复盘、跨主题复盘 |
| 运维指南 | `OPS` | `04-operations/` | 部署、配置、运行手册 |
| 知识卡片 | `KNOW` | `05-knowledge/` | 学习笔记、API 摘录、踩坑记 |
| 原型说明 | `PROTO` | `07-prototype/` | UI 稿、Figma、交互稿说明 |
| 资产侧车 | `META` | 与资产同目录 | 非 Markdown 资产的 `.meta.md` |

## 5. 命名规范

### 5.1 文档文件名

- `00-project/`、`02-architecture/`、`05-knowledge/`、`06-retrospective/`、`07-prototype/`：`<主题>.md`（如 `project.md`、`memory-architecture.md`）
- `03-development/{plan,review,implementation,verify,issue}/`：`YYYY-MM-DD-<主题>-<类型>.md`（如 `2026-06-03-user-memory-plan.md`、`2026-06-05-skill-upload-verify.md`）
- `04-operations/`：`<环境或系统>-<主题>.md`（如 `eks-deploy.md`、`envoy-config.md`）
- `99-archive/`：保留原名，按 `99-archive/<分类>/<主题>/` 聚合，参考 §7。
- `01-rules/`：领域名 + 类型（如 `doc-governance.md`、`git-workflow.md`）

### 5.2 目录索引 README

- 每个目录（含 `document/` 根）都需有 `README.md`，`doc_type: 目录索引`。
- 内容：目录定位 + 子目录导航 + 当前文档清单 + 收录建议。
- 新增/迁移文档后，必须同步更新所在目录的 `README.md`。

## 6. 非 Markdown 资产侧车

对每个非 Markdown 资产（`.json`、`.yaml`、`.drawio`、`.png`、`.svg`、`.html`、`.sql`、`.tf` 等），在**同目录**创建 `<原文件名>.<扩展名>.meta.md`：

- 含完整 frontmatter（`doc_type: 资产侧车`，TYPE=`META`）。
- 正文必须含 4 字段：

```markdown
- artifact_path: `<相对路径>`
- artifact_type: `<json|yaml|drawio|png|svg|html|sql|tf|env|...>`
- sensitivity: `<public|internal|sensitive>`
- usage: `<该资产的用途说明>`
```

- 敏感资产（如 `.env`、密钥）只写字段用途，**不能写真实值**。
- `.gitignore` 内的资产（如 `.env`）不进仓，但若已存在的占位/示例资产（如 `.env.example`）需要侧车。

## 7. 归档策略

- 同主题多版本：保留一份主文档（最新、最完整），历史移到 `99-archive/<分类>/<主题>/`。
- 主文档新增「版本演进」段，列出历史版本路径。
- 历史版本 `status: archived`，`category: 99-archive`。
- 结论冲突不强制合并，仅主从关联，标注差异来源。

## 8. 校验流程

每次提交文档前**强制**跑一次：

```bash
bash document/01-rules/scripts/validate_docs_metadata.sh
```

校验 5 项：

1. 所有 `.md` 有 frontmatter 且含 11 必填字段
2. 所有非 `.md` 资产有对应 `.meta.md` 侧车，且侧车含 4 必填字段
3. 全库 `doc_id` 唯一
4. `category` 字段值与文件实际路径一致
5. `related_docs` 引用的 `doc_id` 在仓内存在（仅警告，不 fail）

退出码：通过 `0`，任意 ERROR `1`。

CI 集成：`.github/workflows/docs-validate.yml` 在 PR 触发自动跑（如未启用，本地强制跑）。

## 9. Claude 协作约定（强制）

Claude 在 IncidentFox 仓做改造工作时：

1. **任何过程产物文档先选目录**：按 §2 表选 `document/<XX-category>/<subdir>/`，**禁止写到仓库根目录或散落到 `sre-agent/`、`config_service/` 等代码目录里**（除非是该代码目录原生就有的 README、AGENTS.md 等上游文件）。
2. **frontmatter 必填**：11 字段一个不少，`doc_id` 用 `DOC-IFX-<TYPE>-<YYYYMMDD>-<NNN>` 格式，`<NNN>` 通过 grep 当天同 TYPE 最大序号 +1 推出。
3. **写完跑校验**：执行 `bash document/01-rules/scripts/validate_docs_metadata.sh`，PASS 才视为完成；FAIL 必须修到 PASS 才提交。
4. **更新所在目录的 README.md**：在「当前文档与资产」段添加新文档的链接行。
5. **资产配侧车**：写代码同时如果生成了 `.json`/`.yaml`/`.drawio` 等到 `document/` 下，必须同时写 `.meta.md` 侧车。

仓库根 `AGENTS.md` 末尾有「Documentation Governance」段会反向链回本规范。

## 10. 与上游差异

本规范学自 `openclaw-docker/规则/文档治理规范.md`（DOC-RULE-20260411-004），核心差异：

- 全部收进 `document/` 单根，仓库根不放治理目录。
- 子目录用数字前缀（`00-`、`01-`...），既保序又便于 Claude/工具识别。
- `doc_type` 从 39 种降到 13 种，命名一律中文（与 OpenClaw 对齐）。
- `doc_id` 前缀改为 `DOC-IFX-<TYPE>-...`，避免与 OpenClaw 冲突。
- 校验脚本新增 `doc_id` 唯一性校验和 `category↔路径` 一致性校验。
