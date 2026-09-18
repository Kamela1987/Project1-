from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/prices", tags=["prices"])


def get_or_create_commodity(db: Session, name: str, unit: str = "50kg bag") -> models.Commodity:
    name = name.strip().lower()
    commodity = db.query(models.Commodity).filter(models.Commodity.name == name).first()
    if commodity is None:
        commodity = models.Commodity(name=name, unit=unit)
        db.add(commodity)
        db.commit()
        db.refresh(commodity)
    return commodity


@router.post("", response_model=schemas.PriceReportOut, status_code=201)
def submit_price(report: schemas.PriceReportIn, db: Session = Depends(get_db)):
    commodity = get_or_create_commodity(db, report.commodity)
    db_report = models.PriceReport(
        commodity_id=commodity.id,
        location=report.location,
        price_kwacha=report.price_kwacha,
        reporter_phone=report.reporter_phone,
        source=report.source,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@router.get("", response_model=list[schemas.PriceReportOut])
def list_prices(commodity: str | None = None, limit: int = 20, db: Session = Depends(get_db)):
    query = db.query(models.PriceReport).join(models.Commodity)
    if commodity:
        query = query.filter(models.Commodity.name == commodity.strip().lower())
    return query.order_by(models.PriceReport.created_at.desc()).limit(limit).all()


@router.get("/average/{commodity}", response_model=schemas.PriceAverageOut)
def average_price(commodity: str, days: int = 7, db: Session = Depends(get_db)):
    name = commodity.strip().lower()
    db_commodity = db.query(models.Commodity).filter(models.Commodity.name == name).first()
    if db_commodity is None:
        raise HTTPException(status_code=404, detail=f"No reports yet for '{commodity}'")

    cutoff = func.datetime("now", f"-{days} days") if db.bind.dialect.name == "sqlite" else None
    query = db.query(func.avg(models.PriceReport.price_kwacha), func.count(models.PriceReport.id)).filter(
        models.PriceReport.commodity_id == db_commodity.id
    )
    if cutoff is not None:
        query = query.filter(models.PriceReport.created_at >= cutoff)
    avg_price, count = query.one()

    if not count:
        raise HTTPException(status_code=404, detail=f"No recent reports for '{commodity}'")

    return schemas.PriceAverageOut(
        commodity=db_commodity.name,
        unit=db_commodity.unit,
        average_price_kwacha=round(avg_price, 2),
        sample_size=count,
        location="Monze Market",
    )
