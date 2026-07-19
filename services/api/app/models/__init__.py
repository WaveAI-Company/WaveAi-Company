"""Modelos do domínio."""

from .user import DoctorProfile, PatientProfile, User, UserRole, normalize_email

__all__ = ["User", "UserRole", "PatientProfile", "DoctorProfile", "normalize_email"]
