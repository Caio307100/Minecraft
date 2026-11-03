#!/usr/bin/env bash
# Gera tests/golden/climate.tsv com valores REAIS do Minecraft 1.0 para validar o port em JS.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/tests/golden/climate.tsv"
mkdir -p "$(dirname "$OUT")"

SEEDS=(12345 987654321 -4172144997902289642)
# janelas 16x16: perto da origem, negativa, longe e muito longe
WINDOWS=("0 0" "-200 -200" "3000 -4000" "-20000 15000")

first=1
: > "$OUT"
for seed in "${SEEDS[@]}"; do
  for win in "${WINDOWS[@]}"; do
    set -- $win
    rows="$("$ROOT/tools/climate-probe.sh" "$seed" "$1" "$2" 16 16)"
    if [ "$first" = 1 ]; then
      printf 'seed\t%s\n' "$(echo "$rows" | head -1)" >> "$OUT"
      first=0
    fi
    echo "$rows" | tail -n +2 | awk -v s="$seed" -F'\t' '{print s "\t" $0}' >> "$OUT"
  done
done

echo "OK: $(($(wc -l < "$OUT") - 1)) linhas em $OUT"
