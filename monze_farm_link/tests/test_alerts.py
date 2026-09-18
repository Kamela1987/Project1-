def test_report_alert_defaults_to_unverified(client):
    response = client.post(
        "/alerts",
        json={
            "disease": "suspected ECF",
            "location": "Chivuna",
            "reporter_phone": "0977123456",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["verified"] is False
    assert body["created_at"].endswith("Z")


def test_list_alerts_verified_only_filter(client):
    unverified = client.post(
        "/alerts",
        json={"disease": "suspected ECF", "location": "Chivuna", "reporter_phone": "0977000001"},
    ).json()
    verified = client.post(
        "/alerts",
        json={"disease": "foot rot", "location": "Magoye", "reporter_phone": "0977000002"},
    ).json()
    client.patch(f"/alerts/{verified['id']}/verify")

    response = client.get("/alerts", params={"verified_only": True})
    assert response.status_code == 200
    alerts = response.json()
    ids = [a["id"] for a in alerts]
    assert verified["id"] in ids
    assert unverified["id"] not in ids


def test_verify_alert_404_for_unknown_id(client):
    response = client.patch("/alerts/999/verify")
    assert response.status_code == 404
