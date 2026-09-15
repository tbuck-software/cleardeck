#!/usr/bin/env bash
# Builds the public ClearDeck snapshot as a local single-commit repository.
# Never pushes. Usage: scripts/public-snapshot/build.sh [ref] [output-dir]
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
ref="${1:-origin/main}"
out="${2:-$repo/../cleardeck-public-snapshot}"

if [ -e "$out" ] && [ -n "$(ls -A "$out" 2>/dev/null)" ]; then
  echo "Output directory is not empty: $out" >&2
  exit 1
fi

commit="$(git -C "$repo" rev-parse --verify "$ref^{commit}")"
mkdir -p "$out"
out="$(cd "$out" && pwd)"
git -C "$repo" archive "$commit" | tar -x -C "$out"

while IFS= read -r path; do
  case "$path" in ''|'#'*) continue ;; esac
  rm -rf "${out:?}/$path"
done < "$here/exclude.txt"

status=0

patterns="$(grep -v -e '^#' -e '^$' "$here/forbidden.txt" | paste -sd '|' -)"
grep -rInE "$patterns" "$out" | sed "s#^$out/##" | awk -F'\t' '
  NR == FNR { if ($0 !~ /^#/ && NF == 2) { allowPath[++n] = $1; allowText[n] = $2 } next }
  { for (i = 1; i <= n; i++) if (index($0, allowPath[i] ":") == 1 && index($0, allowText[i])) next; print }
' "$here/allow.txt" - > "$out.findings.txt" || true
if [ -s "$out.findings.txt" ]; then
  echo "Forbidden patterns found ($(wc -l < "$out.findings.txt") lines): $out.findings.txt"
  status=1
else
  rm -f "$out.findings.txt"
fi

documents="$(cd "$out" && find . -type f \( -iname '*.xlsx' -o -iname '*.xls' -o -iname '*.docx' -o -iname '*.csv' -o -iname '*.pdf' -o -iname '*.opus' -o -iname '*.m4a' \) | sed 's#^\./##')"
if [ -n "$documents" ]; then
  echo "Office, audio or data files in snapshot:"
  echo "$documents"
  status=1
fi

broken="$(cd "$out" && python3 - <<'EOF'
import os, re
for root, _, names in os.walk('.'):
    if '/node_modules' in root or '/.git' in root:
        continue
    for name in names:
        if not name.endswith('.md'):
            continue
        path = os.path.join(root, name)
        for m in re.finditer(r'(?:\]\(|src="|href=")([^)"\s]+)', open(path, encoding='utf-8').read()):
            target = m.group(1)
            if re.match(r'^[a-z]+:', target) or target.startswith('#'):
                continue
            if not os.path.exists(os.path.join(os.path.dirname(path), target.split('#')[0])):
                print(f'{path[2:]} -> {target}')
EOF
)"
if [ -n "$broken" ]; then
  echo "Broken relative links:"
  echo "$broken"
  status=1
fi

if command -v gitleaks > /dev/null; then
  gitleaks detect --no-git --no-banner -s "$out" || status=1
else
  echo "gitleaks not installed; secret scan relies on forbidden.txt only"
  status=1
fi

git -C "$out" init -q -b main
git -C "$out" add -A
git -C "$out" commit -q -m "ClearDeck"

echo "Snapshot of ${commit:0:7}: $out ($(git -C "$out" ls-files | wc -l | tr -d ' ') files)"
exit "$status"
