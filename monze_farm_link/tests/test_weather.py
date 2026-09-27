from app.routers import weather


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise weather.requests.HTTPError(f"status {self.status_code}")

    def json(self):
        return self._payload


def test_forecast_recommends_planting_with_enough_rain(client, monkeypatch):
    payload = {
        "daily": {
            "time": ["2026-01-01", "2026-01-02"],
            "precipitation_sum": [10.0, 8.0],
            "temperature_2m_max": [30.0, 31.0],
            "temperature_2m_min": [18.0, 19.0],
        }
    }
    monkeypatch.setattr(weather.requests, "get", lambda *a, **k: _FakeResponse(payload))

    response = client.get("/weather/forecast")
    assert response.status_code == 200
    body = response.json()
    assert body["total_rain_next_7_days_mm"] == 18.0
    assert "Good rain expected" in body["planting_advice"]
    assert len(body["forecast"]) == 2


def test_forecast_advises_against_planting_with_little_rain(client, monkeypatch):
    payload = {
        "daily": {
            "time": ["2026-01-01"],
            "precipitation_sum": [1.0],
            "temperature_2m_max": [32.0],
            "temperature_2m_min": [20.0],
        }
    }
    monkeypatch.setattr(weather.requests, "get", lambda *a, **k: _FakeResponse(payload))

    response = client.get("/weather/forecast")
    assert response.status_code == 200
    assert "Low rain expected" in response.json()["planting_advice"]


def test_forecast_returns_502_when_weather_service_unavailable(client, monkeypatch):
    def _raise(*args, **kwargs):
        raise weather.requests.ConnectionError("proxy blocked")

    monkeypatch.setattr(weather.requests, "get", _raise)

    response = client.get("/weather/forecast")
    assert response.status_code == 502
    assert "Weather service unavailable" in response.json()["detail"]
