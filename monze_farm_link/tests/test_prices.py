def test_submit_price_creates_commodity_and_report(client):
    response = client.post(
        "/prices",
        json={"commodity": "Maize", "price_kwacha": 350, "reporter_phone": "0977123456"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["commodity"]["name"] == "maize"
    assert body["price_kwacha"] == 350.0
    assert body["source"] == "app"


def test_submit_price_rejects_non_positive_price(client):
    response = client.post(
        "/prices",
        json={"commodity": "maize", "price_kwacha": 0, "reporter_phone": "0977123456"},
    )
    assert response.status_code == 422


def test_list_prices_filters_by_commodity(client):
    client.post("/prices", json={"commodity": "maize", "price_kwacha": 350, "reporter_phone": "0977000001"})
    client.post("/prices", json={"commodity": "cattle", "price_kwacha": 9000, "reporter_phone": "0977000002"})

    response = client.get("/prices", params={"commodity": "maize"})
    assert response.status_code == 200
    reports = response.json()
    assert len(reports) == 1
    assert reports[0]["commodity"]["name"] == "maize"


def test_average_price_computes_mean_over_reports(client):
    client.post("/prices", json={"commodity": "maize", "price_kwacha": 300, "reporter_phone": "0977000001"})
    client.post("/prices", json={"commodity": "maize", "price_kwacha": 400, "reporter_phone": "0977000002"})

    response = client.get("/prices/average/maize")
    assert response.status_code == 200
    body = response.json()
    assert body["average_price_kwacha"] == 350.0
    assert body["sample_size"] == 2


def test_average_price_404_for_unknown_commodity(client):
    response = client.get("/prices/average/unobtainium")
    assert response.status_code == 404
