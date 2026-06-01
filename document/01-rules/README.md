---
doc_id: DOC-IFX-INDEX-20260601-003
title: "01-rules 目录索引"
category: 01-rules
doc_type: 目录索引
status: active
created_at: 2026-06-01
updated_at: 2026-06-01
owners: ["Liny777"]
tags: ["index", "rules", "governance", "templates"]
summary: "治理规范、Git 工作流、frontmatter 模板与校验脚本入口。"
related_docs:
  - "DOC-IFX-INDEX-20260601-001"
related_artifacts: []
---
# 01-rules 目录索引

## 目录定位

文档治理规则、Git 协作规则、写作模板与自动化校验脚本。

## 当前文档与资产

- [doc-governance.md](doc-governance.md) — 文档治理规范 v1（DOC-IFX-RULE-20260601-001）
- [git-workflow.md](git-workflow.md) — Git 协作与上游同步工作流（DOC-IFX-RULE-20260601-002）
- [templates/](templates/) — 8 份 frontmatter 模板
  - [plan.md](templates/plan.md) · [review.md](templates/review.md) · [implementation.md](templates/implementation.md) · [verify.md](templates/verify.md)
  - [postmortem.md](templates/postmortem.md) · [ops-guide.md](templates/ops-guide.md) · [knowledge.md](templates/knowledge.md) · [meta-sidecar.md](templates/meta-sidecar.md)
- [scripts/validate_docs_metadata.sh](scripts/validate_docs_metadata.sh) — 校验脚本（需配 `.meta.md` 侧车）
- [scripts/validate_docs_metadata.sh.meta.md](scripts/validate_docs_metadata.sh.meta.md) — 校验脚本侧车

## 收录建议

- 新增规则文档：`<领域>-<主题>.md`，doc_type=`规范`。
- 新增模板：放 `templates/`，doc_type=`模板`，文件名小写英文。
- 新增脚本：放 `scripts/`，并配套侧车 `<script>.meta.md`。
- 规则变更建议先写 `03-development/plan/` 方案讨论，通过后再落地到本目录。
