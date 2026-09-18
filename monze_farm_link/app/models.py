from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Commodity(Base):
    """A tradable item farmers/traders report prices for, e.g. maize, cattle."""

    __tablename__ = "commodities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    unit: Mapped[str] = mapped_column(String(32))  # e.g. "50kg bag", "per head"

    price_reports: Mapped[list["PriceReport"]] = relationship(back_populates="commodity")


class PriceReport(Base):
    """A single price observation submitted by a farmer or trader."""

    __tablename__ = "price_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    commodity_id: Mapped[int] = mapped_column(ForeignKey("commodities.id"), index=True)
    location: Mapped[str] = mapped_column(String(128), default="Monze Market")
    price_kwacha: Mapped[float] = mapped_column(Float)
    reporter_phone: Mapped[str] = mapped_column(String(20), index=True)
    source: Mapped[str] = mapped_column(String(16), default="app")  # app | ussd | sms
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

    commodity: Mapped["Commodity"] = relationship(back_populates="price_reports")


class AgroDealer(Base):
    """Directory entry for an agro-dealer / FISP distribution point."""

    __tablename__ = "agro_dealers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    location: Mapped[str] = mapped_column(String(128))
    phone: Mapped[str] = mapped_column(String(20))
    stock_status: Mapped[str] = mapped_column(Text, default="Unknown")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class DiseaseAlert(Base):
    """Community-reported livestock disease alert, pending moderation."""

    __tablename__ = "disease_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disease: Mapped[str] = mapped_column(String(128))
    location: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text, default="")
    reporter_phone: Mapped[str] = mapped_column(String(20))
    verified: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
