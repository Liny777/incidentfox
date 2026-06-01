---
doc_id: DOC-IFX-META-20260601-001
title: "校验脚本 validate_docs_metadata.sh 侧车"
category: 01-rules
doc_type: 资产侧车
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["meta", "sidecar", "script", "validation"]
summary: "document/01-rules/scripts/validate_docs_metadata.sh 的侧车说明。"
related_docs:
  - "DOC-IFX-RULE-20260601-001"
related_artifacts:
  - "document/01-rules/scripts/validate_docs_metadata.sh"
---
# validate_docs_metadata.sh 侧车

## 资产信息

- artifact_path: `document/01-rules/scripts/validate_docs_metadata.sh`
- artifact_type: `sh`
- sensitivity: `public`
- usage: 扫描 `document/` 全树校验 frontmatter 完整性、侧车覆盖、doc_id 唯一性、category↔路径一致性。退出码 0=PASS、1=任意 ERROR。

## 维护说明

- owner: `Liny777`
- update_rule: 校验项变动时改脚本并同步 `doc-governance.md` 第 8 节；新增 `doc_type` 或 `category` 时同步 `VALID_CATEGORIES` / `REQUIRED_KEYS`。
- generated_by: 手工编写，改写自 [openclaw-docker/规则/scripts/validate_docs_metadata.sh](../../../../openclaw-docker/规则/scripts/validate_docs_metadata.sh)（DOC-RULE-20260411-004 配套）。

## 运行方式

```bash
cd /Users/liny/Documents/Code/profession-sre-agent/incidentfox-main
bash document/01-rules/scripts/validate_docs_metadata.sh
```

退出码 0 才视为文档合规。CI（`.github/workflows/docs-validate.yml`，未来添加）会在 PR 上自动跑。

## 关联文档

- 设计依据：[DOC-IFX-RULE-20260601-001](../doc-governance.md)
