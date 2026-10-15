from tests.conftest import make_exercise, make_workout


def test_create_with_exercises(client):
    e1 = make_exercise(client, "Supino reto")
    e2 = make_exercise(client, "Triceps corda")
    w = make_workout(
        client,
        exercises=[{"exercise_id": e1}, {"exercise_id": e2, "target_sets": 4}],
    )
    assert w["name"] == "Treino A"
    ex = w["exercises"]
    assert len(ex) == 2
    # ordem por position
    assert ex[0]["exercise_id"] == e1 and ex[0]["position"] == 1
    assert ex[0]["target_sets"] == 6            # default
    assert ex[1]["exercise_id"] == e2 and ex[1]["position"] == 2
    assert ex[1]["target_sets"] == 4            # custom
    assert ex[0]["exercise"]["name"] == "Supino reto"   # aninhado


def test_create_with_missing_exercise_404(client):
    r = client.post("/workouts", json={"name": "X", "exercises": [{"exercise_id": 9999}]})
    assert r.status_code == 404


def test_create_with_duplicate_exercise_409(client):
    e1 = make_exercise(client)
    r = client.post(
        "/workouts",
        json={"name": "X", "exercises": [{"exercise_id": e1}, {"exercise_id": e1}]},
    )
    assert r.status_code == 409


def test_update_name(client):
    w = make_workout(client)
    r = client.patch(f"/workouts/{w['id']}", json={"name": "Treino B", "notes": "peito"})
    assert r.status_code == 200
    assert r.json()["name"] == "Treino B"
    assert r.json()["notes"] == "peito"


def test_set_exercises_replaces(client):
    e1 = make_exercise(client, "A")
    e2 = make_exercise(client, "B")
    w = make_workout(client, exercises=[{"exercise_id": e1}])
    r = client.put(
        f"/workouts/{w['id']}/exercises",
        json=[{"exercise_id": e2, "target_sets": 5}],
    )
    assert r.status_code == 200
    ex = r.json()["exercises"]
    assert len(ex) == 1
    assert ex[0]["exercise_id"] == e2
    assert ex[0]["target_sets"] == 5


def test_list_and_archive(client):
    w = make_workout(client)
    assert client.post(f"/workouts/{w['id']}/archive").json()["archived"] is True
    ids = [x["id"] for x in client.get("/workouts").json()]
    assert w["id"] not in ids


def test_get_not_found(client):
    assert client.get("/workouts/9999").status_code == 404


def test_delete_with_sessions_cascades(client):
    e1 = make_exercise(client)
    w = make_workout(client, exercises=[{"exercise_id": e1}])
    sid = client.post("/sessions", json={"workout_id": w["id"]}).json()["id"]
    client.put(
        f"/sessions/{sid}/exercises/{e1}/sets",
        json={"sets": [{"set_number": 1, "reps": 8, "weight_kg": 30}]},
    )
    assert client.delete(f"/workouts/{w['id']}").status_code == 204
    assert client.get(f"/workouts/{w['id']}").status_code == 404
    assert client.get(f"/sessions/{sid}").status_code == 404
