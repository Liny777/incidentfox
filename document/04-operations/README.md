---
doc_id: DOC-IFX-INDEX-20260601-011
title: "04-operations 目录索引"
category: 04-operations
doc_type: 目录索引
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["index", "operations", "deploy", "runbook"]
summary: "部署、配置、运行手册类文档入口。"
related_docs:
  - "DOC-IFX-INDEX-20260601-001"
related_artifacts: []
---
# 04-operations 目录索引

## 目录定位

实际部署、运维、运行的文档。覆盖 EKS / 本地 dev / 镜像构建 / Envoy 配置 / 数据库迁移等运维侧主题。

## 当前文档与资产

- （无）

## 收录建议

- 文件名：`<环境或系统>-<主题>.md`，例：`eks-deploy.md`、`envoy-credential-proxy.md`、`postgres-migration.md`。
- doc_type=`运维指南`。
- Helm values / Terraform / `.json` / `.yaml` 等运维资产放本目录时**必须配 `.meta.md` 侧车**。
- 模板：[01-rules/templates/ops-guide.md](../01-rules/templates/ops-guide.md)
