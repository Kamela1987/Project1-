from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/alerts", tags=["disease-alerts"])


@router.post("", response_model=schemas.DiseaseAlertOut, status_code=201)
def report_alert(alert: schemas.DiseaseAlertIn, db: Session = Depends(get_db)):
    db_alert = models.DiseaseAlert(**alert.model_dump())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.get("", response_model=list[schemas.DiseaseAlertOut])
def list_alerts(verified_only: bool = False, limit: int = 20, db: Session = Depends(get_db)):
    query = db.query(models.DiseaseAlert)
    if verified_only:
        query = query.filter(models.DiseaseAlert.verified.is_(True))
    return query.order_by(models.DiseaseAlert.created_at.desc()).limit(limit).all()


@router.patch("/{alert_id}/verify", response_model=schemas.DiseaseAlertOut)
def verify_alert(alert_id: int, db: Session = Depends(get_db)):
    """Mark a community-reported alert as verified by a moderator (e.g. a vet or extension officer)."""
    alert = db.get(models.DiseaseAlert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.verified = True
    db.commit()
    db.refresh(alert)
    return alert
