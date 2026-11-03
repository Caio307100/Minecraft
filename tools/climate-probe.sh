#!/usr/bin/env bash
# Consulta de clima do Minecraft 1.0 (oráculo = código original do jar).
# Uso: tools/climate-probe.sh <seed> <x> <z> [largura altura]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="${MC10_JAR:-$HOME/.sklauncher/versions/1.0/1.0.jar}"
OUT="${TMPDIR:-/tmp}/mc10-climate-probe"

if [ ! -f "$OUT/ClimateProbe.class" ] || [ "$ROOT/tools/ClimateProbe.java" -nt "$OUT/ClimateProbe.class" ]; then
  mkdir -p "$OUT"
  javac -nowarn -cp "$JAR" -d "$OUT" "$ROOT/tools/ClimateProbe.java"
fi

cd "$ROOT"
# O jar imprime "27 achievements / 174 recipes" na inicialização; só linhas de dados passam.
java -cp "$JAR:$OUT" ClimateProbe "$@" | grep -P '^(x\t|-?\d+\t)'
