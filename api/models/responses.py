from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


class ErrorBody(BaseModel):
    code: str
    message: str
    retry_after: Optional[int] = None


class UsageBody(BaseModel):
    calls_today: int
    calls_limit: int
    calls_remaining: int
    reset_at: datetime


class CategoryAnalysis(BaseModel):
    score: float
    summary: str


class ScanData(BaseModel):
    address: str
    chain: str
    depth: str

    score: float
    risk_level: RiskLevel
    flags: List[str] = Field(default_factory=list)

    analysis: Dict[str, CategoryAnalysis] = Field(default_factory=dict)
    bots: Dict[str, Any] = Field(default_factory=dict, description="Raw bot verdicts")

    scanned_at: datetime
    cached: bool = False
    cached_at: Optional[datetime] = None


class SuccessResponse(BaseModel):
    success: bool = True
    data: Any
    usage: Optional[UsageBody] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorBody


class AuthVerifyData(BaseModel):
    valid: bool
    tier: Optional[str] = None
    calls_remaining: Optional[int] = None
