---
doc_id: DOC-IFX-TPL-20260601-004
title: "验证 / 测试报告模板"
category: 01-rules
doc_type: 模板
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["template", "verify", "test-report"]
summary: "测试计划 / 测试报告写作骨架，落 03-development/verify/ 时复制此文件。"
related_docs:
  - "DOC-IFX-RULE-20260601-001"
related_artifacts: []
---
# <测试报告标题>

> 复制后改 frontmatter：`doc_id` → `DOC-IFX-VERIFY-<YYYYMMDD>-<NNN>`，`doc_type` → `测试报告`，`category` → `03-development`。
> `related_docs` 关联对应的 `DOC-IFX-PLAN-...` / `DOC-IFX-IMPL-...`。

## 1. 测试目标

- 验证对象：
- 验证依据：`DOC-IFX-PLAN-...`、`DOC-IFX-IMPL-...`

## 2. 环境

- 本地 / staging / production：
- 关键依赖版本：

## 3. 测试用例

| # | 用例 | 期望 | 实际 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | | | | PASS / FAIL |

## 4. 关键发现

- 发现 1：
- 发现 2：

## 5. Go / No-Go 决策

- 决策：Go / No-Go
- 理由：
- 触发回滚的 NO-GO 条件：

## 6. Follow-up

- [ ] 修复 FAIL 项后回归
