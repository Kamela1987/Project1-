"""USSD webhook compatible with the Africa's Talking USSD gateway.

This is the primary interface for people without smartphones or data bundles —
dial the shortcode, get a menu, no app install needed. Africa's Talking POSTs
form-encoded fields (sessionId, phoneNumber, text, serviceCode) and expects a
plain-text response starting with "CON " (menu continues) or "END " (session over).
`text` accumulates every choice the user has made so far, separated by "*".
"""

from fastapi import APIRouter, Depends, Form
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.prices import get_or_create_commodity
from app import models

router = APIRouter(prefix="/ussd", tags=["ussd"])

MAIN_MENU = (
    "CON Monze Farm & Market Link\n"
    "1. Check maize price\n"
    "2. Check cattle price\n"
    "3. Report a price\n"
    "4. Report animal disease"
)


def latest_average(db: Session, commodity_name: str) -> str:
    commodity = db.query(models.Commodity).filter(models.Commodity.name == commodity_name).first()
    if commodity is None or not commodity.price_reports:
        return f"No {commodity_name} prices reported yet. Be the first — option 3."
    recent = sorted(commodity.price_reports, key=lambda r: r.created_at, reverse=True)[:10]
    avg = sum(r.price_kwacha for r in recent) / len(recent)
    return f"Avg {commodity_name} price (last {len(recent)} reports): K{avg:.2f} per {commodity.unit}"


@router.post("", response_class=PlainTextResponse)
def ussd_handler(
    sessionId: str = Form(...),
    phoneNumber: str = Form(...),
    text: str = Form(""),
    db: Session = Depends(get_db),
):
    parts = text.split("*") if text else []

    if text == "":
        return MAIN_MENU

    choice = parts[0]

    if choice == "1":
        return f"END {latest_average(db, 'maize')}"

    if choice == "2":
        return f"END {latest_average(db, 'cattle')}"

    if choice == "3":
        if len(parts) == 1:
            return "CON Which commodity?\n1. Maize\n2. Cattle\n3. Groundnuts"
        if len(parts) == 2:
            return "CON Enter price in Kwacha (numbers only):"
        commodity_map = {"1": "maize", "2": "cattle", "3": "groundnuts"}
        commodity_name = commodity_map.get(parts[1])
        if commodity_name is None:
            return "END Invalid commodity choice."
        try:
            price = float(parts[2])
        except ValueError:
            return "END Invalid price. Please dial again and enter numbers only."

        commodity = get_or_create_commodity(db, commodity_name)
        db.add(
            models.PriceReport(
                commodity_id=commodity.id,
                price_kwacha=price,
                reporter_phone=phoneNumber,
                source="ussd",
            )
        )
        db.commit()
        return f"END Thanks! Recorded {commodity_name} at K{price:.2f} per {commodity.unit}."

    if choice == "4":
        if len(parts) == 1:
            return "CON Describe the disease/symptom (short):"
        if len(parts) == 2:
            return "CON Which area/village?"
        description = parts[1]
        location = parts[2]
        db.add(
            models.DiseaseAlert(
                disease=description,
                location=location,
                reporter_phone=phoneNumber,
            )
        )
        db.commit()
        return "END Thanks! Your alert has been sent for verification."

    return "END Invalid option. Please try again."
