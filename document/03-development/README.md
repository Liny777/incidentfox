---
doc_id: DOC-IFX-INDEX-20260601-005
title: "03-development 目录索引"
category: 03-development
doc_type: 目录索引
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["index", "development", "process"]
summary: "改造开发过程的统一入口：方案、评审、实施、验证、问题复盘五件套。"
related_docs:
  - "DOC-IFX-INDEX-20260601-001"
  - "DOC-IFX-RULE-20260601-001"
related_artifacts: []
---
# 03-development 目录索引

## 目录定位

每一次改造工作的**完整生命周期文档**。每个主题理想情况下贯穿 5 个子目录：`plan → review → implementation → verify → issue（如出问题）`。

## 二级子目录

| 子目录 | 用途 | 模板 |
| --- | --- | --- |
| [plan/](plan/) | 方案 / 实施方案 | [plan.md](../01-rules/templates/plan.md) |
| [review/](review/) | 方案评审 / 代码评审 | [review.md](../01-rules/templates/review.md) |
| [implementation/](implementation/) | 实施记录 / 变更日志 | [implementation.md](../01-rules/templates/implementation.md) |
| [verify/](verify/) | 测试计划 / 测试报告 | [verify.md](../01-rules/templates/verify.md) |
| [issue/](issue/) | 单一问题复盘 | [postmortem.md](../01-rules/templates/postmortem.md) |

## 命名约定

- 文件名：`YYYY-MM-DD-<主题>-<类型缩写>.md`
- 类型缩写：`plan`、`review`、`impl`、`verify`、`issue`
- 例：
  - `plan/2026-06-03-user-memory-plan.md`
  - `review/2026-06-04-user-memory-review.md`
  - `implementation/2026-06-05-user-memory-impl.md`
  - `verify/2026-06-06-user-memory-verify.md`

## 收录建议

- 一个主题的多份文档通过 `related_docs` 双向关联，形成「方案 ↔ 评审 ↔ 实施 ↔ 验证」闭环。
- 跨主题的复盘（如季度总结）放 `06-retrospective/` 而不是 `issue/`。
- 长期参考价值的设计放 `02-architecture/`。
