"""Modelos do domínio."""

from .care_link import (
    CareLink,
    CareLinkEvent,
    CareLinkEventType,
    CareLinkParty,
    CareLinkStatus,
)
from .refresh_token import RefreshToken
from .result import Result, ResultAccessAction, ResultAccessEvent
from .session import CaptureSession, SessionStatus
from .user import DoctorProfile, PatientProfile, User, UserRole, normalize_email

__all__ = [
    "User",
    "UserRole",
    "PatientProfile",
    "DoctorProfile",
    "RefreshToken",
    "CaptureSession",
    "SessionStatus",
    "Result",
    "ResultAccessEvent",
    "ResultAccessAction",
    "CareLink",
    "CareLinkStatus",
    "CareLinkParty",
    "CareLinkEvent",
    "CareLinkEventType",
    "normalize_email",
]
