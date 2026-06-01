---
doc_id: DOC-IFX-INDEX-20260601-009
title: "03-development/verify 目录索引"
category: 03-development
doc_type: 目录索引
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["index", "verify", "test-report"]
summary: "测试计划 / 测试报告落点。"
related_docs:
  - "DOC-IFX-INDEX-20260601-005"
related_artifacts: []
---
# 03-development/verify 目录索引

## 目录定位

针对一次实施的**端到端验证**：用例、环境、结果、Go/No-Go 决策。

## 模板

- [verify.md](../../01-rules/templates/verify.md)

## 当前文档

- （无）

## 收录建议

- 文件名：`YYYY-MM-DD-<主题>-verify.md`
- doc_type=`测试报告`
- `related_docs` 关联方案与实施记录。
- 出现 FAIL 项时，开 `../issue/` 写问题复盘；阻塞合入。
