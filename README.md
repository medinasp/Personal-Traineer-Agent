# Fitness App

App pessoal de treino. Back em FastAPI + PostgreSQL.

Documentação: [`docs/SPEC-treino.md`](docs/SPEC-treino.md) · [`docs/DER.md`](docs/DER.md)

## Stack

- Python + FastAPI
- SQLAlchemy 2.0 + Alembic
- PostgreSQL 16 (Docker)

## Subir tudo (só Docker)

Pré: Docker. Nada de Python na máquina.

```bash
cp .env.example .env
docker compose up -d --build
```

Sobe dois serviços:
- **db** — Postgres em `localhost:5434` (volume `pgdata`).
- **api** — FastAPI em `localhost:8000`. No boot roda `alembic upgrade head` e sobe uvicorn com `--reload` (o código da máquina é montado no container).

Verificar: `curl localhost:8000/health` → `{"status":"ok"}` · docs em http://localhost:8000/docs

Comandos úteis:

```bash
docker compose logs -f api        # logs da API
docker compose down               # para tudo, mantem dados
docker compose down -v            # para tudo e APAGA o volume (perde dados)
```

## Banco

- Porta host **5433** (evita colidir com Postgres padrão 5432).
- Dados persistem no volume `pgdata`. `docker compose down` mantém; `down -v` apaga.

## Migrations

Rodam dentro do container `api`:

```bash
docker compose exec api alembic revision --autogenerate -m "descricao"  # gera do diff
docker compose exec api alembic upgrade head                            # aplica
docker compose exec api alembic downgrade -1                            # desfaz a ultima
```

O `upgrade head` também roda sozinho no boot da API (ver `entrypoint.sh`).

## Testes

pytest + FastAPI TestClient. Cada teste roda numa transação com rollback
(SAVEPOINT) → **não sujam o banco**.

```bash
docker compose exec api pip install -r requirements-dev.txt   # 1x por container
docker compose exec api python -m pytest
```

Cobrem: CRUD dos 3 domínios, validações (422/404/409), replace de séries e a
query-chave `/last` (mostrar a última vez).

## Estrutura

```
app/
  config.py     settings (DATABASE_URL via .env)
  database.py   engine, session, Base
  models.py     Exercise, Workout, WorkoutExercise, WorkoutSession, SetLog
  main.py       FastAPI (health/root; CRUD entra na Fase 1)
migrations/     Alembic (0001_initial = schema do modulo treino)
docker-compose.yml
```
