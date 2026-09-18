def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_root_serves_mobile_web_app(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Monze Farm" in response.text


def test_manifest_and_service_worker_are_served(client):
    manifest = client.get("/manifest.json")
    assert manifest.status_code == 200
    assert manifest.json()["short_name"] == "Monze Farm"

    sw = client.get("/sw.js")
    assert sw.status_code == 200
