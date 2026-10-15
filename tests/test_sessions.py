from tests.conftest import make_exercise, make_workout


def _setup(client):
    e1 = make_exercise(client, "Supino reto")
    e2 = make_exercise(client, "Triceps corda")
    w = make_workout(client, exercises=[{"exercise_id": e1}, {"exercise_id": e2}])
    return w["id"], e1, e2


def test_create_session(client):
    wid, _, _ = _setup(client)
    r = client.post("/sessions", json={"workout_id": wid})
    assert r.status_code == 201
    assert r.json()["workout_id"] == wid


def test_create_session_invalid_workout_404(client):
    assert client.post("/sessions", json={"workout_id": 9999}).status_code == 404


def test_save_sets_and_detail(client):
    wid, e1, _ = _setup(client)
    sid = client.post("/sessions", json={"workout_id": wid}).json()["id"]
    r = client.put(
        f"/sessions/{sid}/exercises/{e1}/sets",
        json={"sets": [
            {"set_number": 1, "reps": 12, "weight_kg": 40},
            {"set_number": 2, "reps": 10, "weight_kg": 42.5},
        ]},
    )
    assert r.status_code == 200
    assert len(r.json()) == 2

    detail = client.get(f"/sessions/{sid}").json()
    assert len(detail["set_logs"]) == 2


def test_save_sets_replaces(client):
    wid, e1, _ = _setup(client)
    sid = client.post("/sessions", json={"workout_id": wid}).json()["id"]
    client.put(f"/sessions/{sid}/exercises/{e1}/sets",
               json={"sets": [{"set_number": 1, "reps": 12, "weight_kg": 40}]})
    r = client.put(f"/sessions/{sid}/exercises/{e1}/sets",
                   json={"sets": [{"set_number": 1, "reps": 10, "weight_kg": 50}]})
    assert len(r.json()) == 1
    assert r.json()[0]["weight_kg"] == 50.0


def test_save_sets_duplicate_number_409(client):
    wid, e1, _ = _setup(client)
    sid = client.post("/sessions", json={"workout_id": wid}).json()["id"]
    r = client.put(
        f"/sessions/{sid}/exercises/{e1}/sets",
        json={"sets": [
            {"set_number": 1, "reps": 1, "weight_kg": 1},
            {"set_number": 1, "reps": 2, "weight_kg": 2},
        ]},
    )
    assert r.status_code == 409


def test_save_sets_invalid_session_404(client):
    wid, e1, _ = _setup(client)
    r = client.put(f"/sessions/9999/exercises/{e1}/sets",
                   json={"sets": [{"set_number": 1, "reps": 1, "weight_kg": 1}]})
    assert r.status_code == 404


def test_last_returns_previous_session(client):
    """O coracao do app: abrir exercicio mostra a ultima vez."""
    wid, e1, _ = _setup(client)

    # sessao 1 (ontem)
    s1 = client.post("/sessions", json={"workout_id": wid, "performed_at": "2026-08-21T10:00:00Z"}).json()["id"]
    client.put(f"/sessions/{s1}/exercises/{e1}/sets", json={"sets": [
        {"set_number": 1, "reps": 12, "weight_kg": 40},
        {"set_number": 2, "reps": 10, "weight_kg": 42.5},
        {"set_number": 3, "reps": 8, "weight_kg": 45},
    ]})

    # sessao 2 (hoje) -> consulta ultima vez
    s2 = client.post("/sessions", json={"workout_id": wid}).json()["id"]
    last = client.get(f"/sessions/{s2}/exercises/{e1}/last").json()
    assert last["performed_at"].startswith("2026-08-21")
    sets = last["sets"]
    assert [x["weight_kg"] for x in sets] == [40.0, 42.5, 45.0]
    assert [x["reps"] for x in sets] == [12, 10, 8]


def test_last_empty_when_no_history(client):
    wid, e1, _ = _setup(client)
    sid = client.post("/sessions", json={"workout_id": wid}).json()["id"]
    body = client.get(f"/sessions/{sid}/exercises/{e1}/last").json()
    assert body["performed_at"] is None
    assert body["sets"] == []


def test_exercise_history_pagination_and_range(client):
    wid, e1, _ = _setup(client)
    # 3 sessoes em datas distintas
    dates = ["2026-07-05", "2026-07-10", "2026-07-15"]
    for d in dates:
        sid = client.post(
            "/sessions", json={"workout_id": wid, "performed_at": f"{d}T10:00:00Z"}
        ).json()["id"]
        client.put(
            f"/sessions/{sid}/exercises/{e1}/sets",
            json={"sets": [{"set_number": 1, "reps": 10, "weight_kg": 40}]},
        )

    # limit=2 -> as 2 mais recentes primeiro
    page1 = client.get(f"/exercises/{e1}/history?limit=2").json()
    assert [s["performed_at"][:10] for s in page1] == ["2026-07-15", "2026-07-10"]

    # offset=2 -> a 3a
    page2 = client.get(f"/exercises/{e1}/history?limit=2&offset=2").json()
    assert [s["performed_at"][:10] for s in page2] == ["2026-07-05"]

    # intervalo de datas 05..10
    ranged = client.get(
        f"/exercises/{e1}/history?start=2026-07-05T00:00:00Z&end=2026-07-10T23:59:59Z"
    ).json()
    assert [s["performed_at"][:10] for s in ranged] == ["2026-07-10", "2026-07-05"]
    assert ranged[0]["sets"][0]["reps"] == 10


def test_exercise_history_not_found(client):
    assert client.get("/exercises/9999/history").status_code == 404


def test_delete_session(client):
    wid, e1, _ = _setup(client)
    sid = client.post("/sessions", json={"workout_id": wid}).json()["id"]
    client.put(f"/sessions/{sid}/exercises/{e1}/sets",
               json={"sets": [{"set_number": 1, "reps": 1, "weight_kg": 1}]})
    assert client.delete(f"/sessions/{sid}").status_code == 204
    assert client.get(f"/sessions/{sid}").status_code == 404
