"""Modelos do domínio."""

from .annotation import (
    AnnotationAccessAction,
    AnnotationAccessEvent,
    SessionAnnotation,
)
from .care_link import (
    CareLink,
    CareLinkEvent,
    CareLinkEventType,
    CareLinkParty,
    CareLinkStatus,
)
from .live_view import LiveViewAccessEvent
from .refresh_token import RefreshToken
from .result import Result, ResultAccessAction, ResultAccessEvent
from .session import CaptureSession, SessionStatus
from .single_use_token import SingleUseToken, SingleUseTokenPurpose
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
    "SessionAnnotation",
    "AnnotationAccessEvent",
    "AnnotationAccessAction",
    "CareLink",
    "CareLinkStatus",
    "CareLinkParty",
    "CareLinkEvent",
    "CareLinkEventType",
    "LiveViewAccessEvent",
    "SingleUseToken",
    "SingleUseTokenPurpose",
    "normalize_email",
]
