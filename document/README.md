---
doc_id: DOC-IFX-INDEX-20260601-001
title: "IncidentFox 改造文档根索引"
category: 00-project
doc_type: 目录索引
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["index", "navigation", "documentation"]
summary: "IncidentFox 改造仓所有过程文档的总入口。9 个一级子目录覆盖项目说明、规则、架构、开发、运维、知识、复盘、原型与归档。"
related_docs:
  - "DOC-IFX-RULE-20260601-001"
  - "DOC-IFX-RULE-20260601-002"
related_artifacts: []
---
# IncidentFox 改造文档根索引

> 所有过程文档都进 `document/` 下；仓库根的 `README.md`、`AGENTS.md`、`CLAUDE.md`、`LICENSE*` 是上游 incidentfox 原生文件，不动。

## 1. 一级目录导航

| 目录 | 用途 | 入口 |
| --- | --- | --- |
| [00-project/](00-project/) | 项目级总览与入门 | [项目说明](00-project/project.md) |
| [01-rules/](01-rules/) | 治理规范、Git 工作流、模板、校验脚本 | [文档治理规范](01-rules/doc-governance.md) · [Git 工作流](01-rules/git-workflow.md) |
| [02-architecture/](02-architecture/) | 系统设计、架构图、运行图 | — |
| [03-development/](03-development/) | 方案/评审/实施/验证/问题（5 个二级子目录） | [README](03-development/README.md) |
| [04-operations/](04-operations/) | 部署、配置、运行手册 | — |
| [05-knowledge/](05-knowledge/) | 学习笔记、API 摘录、踩坑记 | — |
| [06-retrospective/](06-retrospective/) | 跨主题阶段性复盘 | — |
| [07-prototype/](07-prototype/) | UI 稿、Figma、交互稿说明 | — |
| [99-archive/](99-archive/) | 历史版本、被归并文档 | — |

## 2. 新人快速路径

1. 读 [00-project/project.md](00-project/project.md) 建立项目地图。
2. 读 [01-rules/doc-governance.md](01-rules/doc-governance.md) 了解文档怎么写。
3. 读 [01-rules/git-workflow.md](01-rules/git-workflow.md) 了解分支、PR、上游同步。
4. 改造任务前，按 03-development 的二级目录约定写方案、评审、实施、验证。

## 3. 写文档前必看

- 模板：[01-rules/templates/](01-rules/templates/) 下 8 份
- 校验：写完跑 `bash document/01-rules/scripts/validate_docs_metadata.sh`
- frontmatter 11 字段必填，`doc_id` 格式 `DOC-IFX-<TYPE>-<YYYYMMDD>-<NNN>`
