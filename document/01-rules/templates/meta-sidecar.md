---
doc_id: DOC-IFX-TPL-20260601-008
title: "资产侧车 Meta 模板"
category: 01-rules
doc_type: 模板
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["template", "meta", "sidecar", "artifact"]
summary: "非 Markdown 资产的 .meta.md 侧车模板，与资产文件同目录命名为 <原文件名>.<扩展名>.meta.md。"
related_docs:
  - "DOC-IFX-RULE-20260601-001"
related_artifacts: []
---
# 资产侧车 Meta 模板

> 复制后改 frontmatter：`doc_id` → `DOC-IFX-META-<YYYYMMDD>-<NNN>`，`doc_type` → `资产侧车`，`category` 与资产所在目录的一级 category 一致。
> 文件名规则：`<原文件名>.<扩展名>.meta.md`（如资产是 `topology.drawio` → 侧车是 `topology.drawio.meta.md`，同目录）。
> `related_artifacts` 必填该资产的相对路径。

## 资产信息（4 字段必填）

- artifact_path: `<相对路径，从仓库根算起>`
- artifact_type: `<json|yaml|drawio|png|svg|html|sql|tf|env|...>`
- sensitivity: `<public|internal|sensitive>`
- usage: `<该资产的用途与使用方式>`

## 维护说明

- owner: `<负责人 github handle>`
- update_rule: `<更新时机、谁批准>`
- generated_by: `<手工 / 脚本，如有脚本附路径>`

## 关联文档

- 设计依据：`<DOC-IFX-...>`
- 实施记录：`<DOC-IFX-...>`
