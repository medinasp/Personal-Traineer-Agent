#!/usr/bin/env bash
# Restaura o banco a partir de um arquivo .dump gerado pelo backup.sh
# Uso: scripts/restore.sh backups/fitness_YYYYmmdd_HHMMSS.dump
set -euo pipefail

FILE="${1:?uso: restore.sh <arquivo.dump>}"
[ -f "$FILE" ] || { echo "arquivo nao encontrado: $FILE" >&2; exit 1; }

echo "Restaurando de: $FILE"
echo "ATENCAO: isso substitui os dados atuais do banco 'fitness'."
docker exec -i fitness-db pg_restore -U fit -d fitness --clean --if-exists < "$FILE"
echo "restaurado com sucesso."
