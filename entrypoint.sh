#!/usr/bin/env bash
set -e

# aplica migrations pendentes antes de subir a API
echo "==> alembic upgrade head"
alembic upgrade head

# popula exercicios principais se o catalogo estiver vazio (idempotente)
echo "==> seed exercicios"
python -m app.seed

echo "==> iniciando API"
exec "$@"
