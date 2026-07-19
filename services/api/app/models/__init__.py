"""Modelos do domínio."""

from .care_link import (
    CareLink,
    CareLinkEvent,
    CareLinkEventType,
    CareLinkParty,
    CareLinkStatus,
)
from .refresh_token import RefreshToken
from .user import DoctorProfile, PatientProfile, User, UserRole, normalize_email

__all__ = [
    "User",
    "UserRole",
    "PatientProfile",
    "DoctorProfile",
    "RefreshToken",
    "CareLink",
    "CareLinkStatus",
    "CareLinkParty",
    "CareLinkEvent",
    "CareLinkEventType",
    "normalize_email",
]
