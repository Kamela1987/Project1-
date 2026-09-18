from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
