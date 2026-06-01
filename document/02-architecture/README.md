---
doc_id: DOC-IFX-INDEX-20260601-004
title: "02-architecture 目录索引"
category: 02-architecture
doc_type: 目录索引
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["index", "architecture", "design"]
summary: "系统架构设计、运行图、组件交互图等长生命周期架构文档。"
related_docs:
  - "DOC-IFX-INDEX-20260601-001"
related_artifacts: []
---
# 02-architecture 目录索引

## 目录定位

跨多个迭代仍有效的**架构性**文档：整体架构、组件交互、关键运行图、数据流、安全模型。和「单次迭代的方案」（落 `03-development/plan/`）区别开。

## 当前文档与资产

- （无）

## 收录建议

- 文档命名：`<主题>.md`，doc_type=`架构设计`。
- 架构图、运行图（`.drawio`、`.png`、`.svg`）直接放本目录，**必须配 `.meta.md` 侧车**。
- 长期保留性强的文档进本目录；过期或被替代的迁到 `99-archive/02-architecture/<主题>/`。
- 与方案的边界：方案讲「这次改造怎么做」，架构讲「系统长期长什么样」。
