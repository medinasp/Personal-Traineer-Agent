#!/usr/bin/env bash
# Backup logico do Postgres (pg_dump formato custom, comprimido e restauravel).
# Guarda em backups/ FORA do volume Docker. Mantem os 14 mais recentes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/backups"
mkdir -p "$OUT"

TS="$(date +%Y%m%d_%H%M%S)"
FILE="$OUT/fitness_$TS.dump"

docker exec fitness-db pg_dump -U fit -Fc fitness > "$FILE"
echo "backup ok: $FILE ($(du -h "$FILE" | cut -f1))"

# rotacao: remove tudo alem dos 14 mais recentes
ls -1t "$OUT"/fitness_*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
