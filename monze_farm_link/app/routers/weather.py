import requests
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/weather", tags=["weather"])

# Monze, Southern Province, Zambia
MONZE_LAT = -16.28
MONZE_LON = 27.48

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


@router.get("/forecast")
def planting_forecast():
    """Free, no-key rain forecast for Monze, useful for planting-window decisions."""
    params = {
        "latitude": MONZE_LAT,
        "longitude": MONZE_LON,
        "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min",
        "timezone": "Africa/Lusaka",
        "forecast_days": 7,
    }
    try:
        response = requests.get(OPEN_METEO_URL, params=params, timeout=10)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Weather service unavailable: {exc}") from exc

    data = response.json().get("daily", {})
    days = data.get("time", [])
    rain = data.get("precipitation_sum", [])
    tmax = data.get("temperature_2m_max", [])
    tmin = data.get("temperature_2m_min", [])

    forecast = [
        {
            "date": day,
            "rain_mm": rain[i] if i < len(rain) else None,
            "temp_max_c": tmax[i] if i < len(tmax) else None,
            "temp_min_c": tmin[i] if i < len(tmin) else None,
        }
        for i, day in enumerate(days)
    ]
    total_rain = sum(r for r in rain if r is not None)
    return {
        "location": "Monze, Southern Province, Zambia",
        "total_rain_next_7_days_mm": round(total_rain, 1),
        "planting_advice": (
            "Good rain expected — consider planting if soil moisture is adequate."
            if total_rain >= 15
            else "Low rain expected in the next 7 days — hold off on planting maize."
        ),
        "forecast": forecast,
    }
