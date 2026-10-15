"""Isolamento: cada teste roda numa transacao com rollback (SAVEPOINT).

Nada persiste no banco. O session da API e o do teste sao o MESMO, ligados a
uma unica conexao cuja transacao externa e' desfeita ao fim de cada teste.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.main import API_V1, app

engine = create_engine(settings.database_url)


class PrefixedClient:
    """Prefixa /api/v1 nas rotas para os testes nao repetirem o prefixo."""

    def __init__(self, client: TestClient) -> None:
        self._c = client

    def _p(self, url: str) -> str:
        return f"{API_V1}{url}" if url.startswith("/") else url

    def get(self, url, **kw):
        return self._c.get(self._p(url), **kw)

    def post(self, url, **kw):
        return self._c.post(self._p(url), **kw)

    def patch(self, url, **kw):
        return self._c.patch(self._p(url), **kw)

    def put(self, url, **kw):
        return self._c.put(self._p(url), **kw)

    def delete(self, url, **kw):
        return self._c.delete(self._p(url), **kw)


@pytest.fixture()
def db_session():
    connection = engine.connect()
    trans = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        trans.rollback()      # desfaz tudo que o teste escreveu
        connection.close()


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield PrefixedClient(c)
    app.dependency_overrides.clear()


# ---- helpers ----
def make_exercise(client, name="Supino reto", muscle_group="Peito") -> int:
    r = client.post("/exercises", json={"name": name, "muscle_group": muscle_group})
    assert r.status_code == 201
    return r.json()["id"]


def make_workout(client, name="Treino A", exercises=None) -> dict:
    r = client.post("/workouts", json={"name": name, "exercises": exercises or []})
    assert r.status_code == 201
    return r.json()
