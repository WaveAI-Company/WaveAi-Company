"""Base declarativa do SQLAlchemy.

Fica separada da engine para que as migrations do Alembic possam importar o
metadata sem abrir conexão.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base de todos os modelos do domínio."""
