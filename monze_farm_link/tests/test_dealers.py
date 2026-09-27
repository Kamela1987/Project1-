def test_add_and_list_dealer(client):
    response = client.post(
        "/dealers",
        json={
            "name": "Monze Farmers Co-op",
            "location": "Monze Boma",
            "phone": "0977888999",
            "stock_status": "Compound D and urea in stock",
        },
    )
    assert response.status_code == 201
    created = response.json()
    dealer_id = created["id"]
    assert created["updated_at"].endswith("Z")

    response = client.get("/dealers")
    assert response.status_code == 200
    dealers = response.json()
    assert len(dealers) == 1
    assert dealers[0]["id"] == dealer_id
    assert dealers[0]["name"] == "Monze Farmers Co-op"


def test_update_dealer_stock(client):
    create = client.post(
        "/dealers",
        json={"name": "Chivuna Agro", "location": "Chivuna", "phone": "0977111222"},
    )
    dealer_id = create.json()["id"]

    response = client.patch(f"/dealers/{dealer_id}/stock", params={"stock_status": "Out of seed"})
    assert response.status_code == 200
    assert response.json()["stock_status"] == "Out of seed"


def test_update_stock_404_for_unknown_dealer(client):
    response = client.patch("/dealers/999/stock", params={"stock_status": "N/A"})
    assert response.status_code == 404
