from tests.conftest import make_exercise


def test_create_and_get(client):
    eid = make_exercise(client, "Puxador", "Costas")
    r = client.get(f"/exercises/{eid}")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Puxador"
    assert body["muscle_group"] == "Costas"
    assert body["archived"] is False


def test_list_excludes_archived_by_default(client):
    keep = make_exercise(client, "Rosca direta")
    gone = make_exercise(client, "Exercicio velho")
    client.post(f"/exercises/{gone}/archive")

    names = [e["id"] for e in client.get("/exercises").json()]
    assert keep in names
    assert gone not in names

    all_ids = [e["id"] for e in client.get("/exercises?include_archived=true").json()]
    assert gone in all_ids


def test_update(client):
    eid = make_exercise(client, "Supino")
    r = client.patch(f"/exercises/{eid}", json={"name": "Supino reto", "equipment": "Barra"})
    assert r.status_code == 200
    assert r.json()["name"] == "Supino reto"
    assert r.json()["equipment"] == "Barra"


def test_archive(client):
    eid = make_exercise(client)
    r = client.post(f"/exercises/{eid}/archive")
    assert r.status_code == 200
    assert r.json()["archived"] is True


def test_get_not_found(client):
    assert client.get("/exercises/9999").status_code == 404


def test_delete(client):
    eid = make_exercise(client, "Para deletar")
    assert client.delete(f"/exercises/{eid}").status_code == 204
    assert client.get(f"/exercises/{eid}").status_code == 404


def test_delete_with_history_cascades(client):
    """Deletar exercicio usado em treino/sessao remove os vinculos e series."""
    eid = make_exercise(client, "Usado")
    w = client.post(
        "/workouts", json={"name": "T", "exercises": [{"exercise_id": eid}]}
    ).json()
    sid = client.post("/sessions", json={"workout_id": w["id"]}).json()["id"]
    client.put(
        f"/sessions/{sid}/exercises/{eid}/sets",
        json={"sets": [{"set_number": 1, "reps": 10, "weight_kg": 40}]},
    )
    # nao deve falhar por FK
    assert client.delete(f"/exercises/{eid}").status_code == 204
    assert client.get(f"/exercises/{eid}").status_code == 404
    # o treino perdeu o exercicio
    assert client.get(f"/workouts/{w['id']}").json()["exercises"] == []


def test_create_invalid_empty_name(client):
    assert client.post("/exercises", json={"name": ""}).status_code == 422
