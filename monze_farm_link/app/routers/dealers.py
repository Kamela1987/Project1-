from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/dealers", tags=["agro-dealers"])


@router.post("", response_model=schemas.AgroDealerOut, status_code=201)
def add_dealer(dealer: schemas.AgroDealerIn, db: Session = Depends(get_db)):
    db_dealer = models.AgroDealer(**dealer.model_dump())
    db.add(db_dealer)
    db.commit()
    db.refresh(db_dealer)
    return db_dealer


@router.get("", response_model=list[schemas.AgroDealerOut])
def list_dealers(db: Session = Depends(get_db)):
    return db.query(models.AgroDealer).order_by(models.AgroDealer.name).all()


@router.patch("/{dealer_id}/stock", response_model=schemas.AgroDealerOut)
def update_stock(dealer_id: int, stock_status: str, db: Session = Depends(get_db)):
    dealer = db.get(models.AgroDealer, dealer_id)
    if dealer is None:
        raise HTTPException(status_code=404, detail="Dealer not found")
    dealer.stock_status = stock_status
    db.commit()
    db.refresh(dealer)
    return dealer
