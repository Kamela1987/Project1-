from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import alerts, dealers, prices, ussd, weather

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Monze Farm & Market Link",
    description=(
        "Price board, agro-dealer locator, rain-based planting advice and livestock "
        "disease alerts for farmers and traders in Monze, Zambia — with a USSD "
        "gateway for people without smartphones."
    ),
    version="0.1.0",
)

app.include_router(prices.router)
app.include_router(dealers.router)
app.include_router(alerts.router)
app.include_router(weather.router)
app.include_router(ussd.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "Monze Farm & Market Link"}


STATIC_DIR = Path(__file__).parent / "static"
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
