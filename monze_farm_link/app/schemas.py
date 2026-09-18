from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def _as_utc_iso(dt: datetime) -> str:
    """Serialize a datetime as an unambiguous UTC ISO8601 string (with "Z").

    SQLite drops timezone info on round-trip, so values read back from the
    database are naive - but every datetime this app stores was produced by
    utcnow(), so a naive value here is always already UTC. Without this, a
    naive ISO string with no offset gets parsed by JS `new Date(...)` as
    local time in the browser, silently shifting "just now" by the
    viewer's UTC offset (e.g. 2 hours off in Zambia).
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class CommodityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    unit: str


class PriceReportIn(BaseModel):
    commodity: str = Field(..., description="Commodity name, e.g. 'maize'")
    price_kwacha: float = Field(..., gt=0)
    location: str = "Monze Market"
    reporter_phone: str
    source: str = "app"


class PriceReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    commodity: CommodityOut
    location: str
    price_kwacha: float
    reporter_phone: str
    source: str
    created_at: datetime

    @field_serializer("created_at")
    def _serialize_created_at(self, dt: datetime) -> str:
        return _as_utc_iso(dt)


class PriceAverageOut(BaseModel):
    commodity: str
    unit: str
    average_price_kwacha: float
    sample_size: int
    location: str


class AgroDealerIn(BaseModel):
    name: str
    location: str
    phone: str
    stock_status: str = "Unknown"


class AgroDealerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    location: str
    phone: str
    stock_status: str
    updated_at: datetime

    @field_serializer("updated_at")
    def _serialize_updated_at(self, dt: datetime) -> str:
        return _as_utc_iso(dt)


class DiseaseAlertIn(BaseModel):
    disease: str
    location: str
    description: str = ""
    reporter_phone: str


class DiseaseAlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    disease: str
    location: str
    description: str
    reporter_phone: str
    verified: bool
    created_at: datetime

    @field_serializer("created_at")
    def _serialize_created_at(self, dt: datetime) -> str:
        return _as_utc_iso(dt)
