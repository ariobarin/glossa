#!/usr/bin/env bash
set -euo pipefail

target="${1:-../glossa-stale-prototype}"

if [[ -e "$target" ]]; then
  echo "Refusing to overwrite existing path: $target" >&2
  exit 1
fi

git clone https://github.com/ariobarin/veronica.git "$target"
echo "Stale prototype repository cloned to $target"
echo "Read docs/12-prototype-reference.md before consulting it."
