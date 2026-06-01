---
doc_id: DOC-IFX-INDEX-20260601-015
title: "99-archive 目录索引"
category: 99-archive
doc_type: 目录索引
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["index", "archive"]
summary: "历史版本、被归并文档存放位置。"
related_docs:
  - "DOC-IFX-INDEX-20260601-001"
related_artifacts: []
---
# 99-archive 目录索引

## 目录定位

被取代、被归并的历史文档。**不删，移过来**，保留追溯能力。

## 子结构

```
99-archive/
├── 00-project/<主题>/         # 项目说明的历史版本
├── 02-architecture/<主题>/    # 架构图、架构方案的历史
├── 03-development/<主题>/     # 改造主题的历史方案/评审等
├── 04-operations/<主题>/      # 运维指南的历史版本
├── 05-knowledge/<主题>/       # 已过期的知识卡片
└── 07-prototype/<主题>/       # 旧设计稿
```

## 当前文档与资产

- （无）

## 收录建议

- 归档时 `status: archived`，`category: 99-archive`，原 `doc_id` 不变。
- 主文档（最新版）在「版本演进」段反向链接历史稿。
- 资产同理：移到 `99-archive/<category>/<主题>/` 下，**侧车 `.meta.md` 也一起搬**。
