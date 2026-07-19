"""Modelos do domínio."""

from .refresh_token import RefreshToken
from .user import DoctorProfile, PatientProfile, User, UserRole, normalize_email

__all__ = [
    "User",
    "UserRole",
    "PatientProfile",
    "DoctorProfile",
    "RefreshToken",
    "normalize_email",
]
