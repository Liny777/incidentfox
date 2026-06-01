#!/usr/bin/env bash
# IncidentFox 文档元数据校验脚本
# 改写自 openclaw-docker/规则/scripts/validate_docs_metadata.sh
# 用法：bash document/01-rules/scripts/validate_docs_metadata.sh
# 退出码：0=PASS, 1=有 ERROR
set -euo pipefail

# 锁定到仓库根（脚本位于 document/01-rules/scripts/ → ../../.. 是仓库根）
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

TARGET_DIR="document"
REQUIRED_KEYS=(
  doc_id
  title
  category
  doc_type
  status
  created_at
  updated_at
  owners
  tags
  summary
  related_docs
  related_artifacts
)
SIDECAR_FIELDS=(artifact_path artifact_type sensitivity usage)
VALID_CATEGORIES=(
  00-project
  01-rules
  02-architecture
  03-development
  04-operations
  05-knowledge
  06-retrospective
  07-prototype
  99-archive
)

errors=0
warnings=0

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "ERROR: 目录 $TARGET_DIR 不存在，请在仓库根运行此脚本"
  exit 1
fi

# 提取 frontmatter 文本（--- 之间的内容）
extract_fm() {
  awk '
    NR==1 && $0=="---" {in_fm=1; next}
    in_fm && $0=="---" {exit}
    in_fm {print}
  ' "$1"
}

# 提取字段值（去引号、去前后空格）
fm_value() {
  local fm="$1" key="$2"
  grep -E "^${key}:" <<<"$fm" | head -1 | sed -E "s/^${key}:[[:space:]]*//; s/^\"//; s/\"$//; s/^'//; s/'$//"
}

echo "[1/5] 检查 Markdown frontmatter 与必填字段..."
md_files=$(find "$TARGET_DIR" -type f -name "*.md" | sort)
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  first_line="$(head -n 1 "$file" || true)"
  if [[ "$first_line" != "---" ]]; then
    echo "ERROR: 缺少 frontmatter: $file"
    errors=$((errors + 1))
    continue
  fi

  fm="$(extract_fm "$file")"

  for key in "${REQUIRED_KEYS[@]}"; do
    if ! grep -Eq "^${key}:" <<<"$fm"; then
      echo "ERROR: 缺少必填字段 ${key}: $file"
      errors=$((errors + 1))
    fi
  done
done <<<"$md_files"

echo "[2/5] 检查非 Markdown 资产侧车..."
asset_files=$(find "$TARGET_DIR" -type f \
  \( -name "*.html" -o -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \
     -o -name "*.drawio" -o -name "*.svg" -o -name "*.json" -o -name "*.yaml" \
     -o -name "*.yml" -o -name "*.sql" -o -name "*.tf" -o -name "*.sh" \
     -o -name "*.env" -o -name ".env" \) \
  ! -name "*.meta.md" | sort || true)
while IFS= read -r asset; do
  [[ -z "$asset" ]] && continue
  sidecar="${asset}.meta.md"
  if [[ ! -f "$sidecar" ]]; then
    echo "ERROR: 缺少侧车 Meta: $asset (期望: $sidecar)"
    errors=$((errors + 1))
    continue
  fi

  for field in "${SIDECAR_FIELDS[@]}"; do
    if ! grep -q "${field}:" "$sidecar" && ! grep -q "^- ${field}:" "$sidecar"; then
      echo "ERROR: 侧车缺少字段 ${field}: $sidecar"
      errors=$((errors + 1))
    fi
  done
done <<<"$asset_files"

echo "[3/5] 检查 doc_id 全局唯一性..."
declare -a all_ids=()
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  fm="$(extract_fm "$file")"
  doc_id="$(fm_value "$fm" doc_id)"
  if [[ -n "$doc_id" ]]; then
    all_ids+=("$doc_id|$file")
  fi
done <<<"$md_files"

# 重复检测
duplicates=$(printf '%s\n' "${all_ids[@]}" | awk -F'|' '{print $1}' | sort | uniq -d || true)
if [[ -n "$duplicates" ]]; then
  while IFS= read -r dup_id; do
    [[ -z "$dup_id" ]] && continue
    echo "ERROR: doc_id 重复: $dup_id"
    printf '%s\n' "${all_ids[@]}" | grep "^${dup_id}|" | awk -F'|' '{print "  → " $2}'
    errors=$((errors + 1))
  done <<<"$duplicates"
fi

echo "[4/5] 检查 category 字段与文件路径一致..."
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  fm="$(extract_fm "$file")"
  category="$(fm_value "$fm" category)"
  [[ -z "$category" ]] && continue

  # 校验 category 在合法集合内
  in_set=0
  for valid in "${VALID_CATEGORIES[@]}"; do
    [[ "$category" == "$valid" ]] && in_set=1 && break
  done
  if [[ "$in_set" -eq 0 ]]; then
    echo "ERROR: category 值 '$category' 不在合法集合: $file"
    errors=$((errors + 1))
    continue
  fi

  # 根 document/README.md 是项目入口索引，按惯例归 00-project，跳过路径目录比对
  if [[ "$file" == "document/README.md" ]]; then
    continue
  fi

  # 实际路径目录应匹配 category
  path_category="$(echo "$file" | awk -F'/' '{print $2}')"
  if [[ "$path_category" != "$category" ]]; then
    echo "ERROR: category=$category 与路径目录 document/$path_category 不一致: $file"
    errors=$((errors + 1))
  fi
done <<<"$md_files"

echo "[5/5] 统计覆盖率..."
md_count="$(echo "$md_files" | grep -c '.' || echo 0)"
if [[ -z "$asset_files" ]]; then
  asset_count=0
else
  asset_count="$(echo "$asset_files" | grep -c '.' || echo 0)"
fi
meta_count="$(find "$TARGET_DIR" -type f -name "*.meta.md" 2>/dev/null | wc -l | tr -d ' ')"
echo "  Markdown 总数: $md_count"
echo "  非 Markdown 资产总数: $asset_count"
echo "  侧车 Meta 总数: $meta_count"

# related_docs 引用一致性（仅 warning，不 fail）
echo "[bonus] 检查 related_docs 引用一致性（warning only）..."
all_ids_only=$(printf '%s\n' "${all_ids[@]}" | awk -F'|' '{print $1}' | sort -u)
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  fm="$(extract_fm "$file")"
  # 提取 related_docs 块下面的所有 - "DOC-IFX-..." 项
  refs=$(awk '
    /^related_docs:/ {flag=1; next}
    flag && /^[a-zA-Z_]+:/ {flag=0}
    flag && /DOC-IFX-/ {print}
  ' <<<"$fm" | grep -oE 'DOC-IFX-[A-Z]+-[0-9]+-[0-9]+' || true)
  while IFS= read -r ref; do
    [[ -z "$ref" ]] && continue
    if ! grep -qx "$ref" <<<"$all_ids_only"; then
      echo "WARN: related_docs 引用未找到: $ref （来自 $file）"
      warnings=$((warnings + 1))
    fi
  done <<<"$refs"
done <<<"$md_files"

echo ""
if [[ "$errors" -gt 0 ]]; then
  echo "FAILED: 共 $errors 个 ERROR，$warnings 个 WARN"
  exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
  echo "PASS（带 $warnings 个 WARN）: 所有 ERROR 检查通过"
else
  echo "PASS: 所有检查通过"
fi
