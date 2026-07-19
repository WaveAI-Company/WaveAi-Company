"""Semeia dados **fictícios** de desenvolvimento.

Cria um médico e alguns pacientes com vínculos `ACTIVE`, para exercitar as
telas do médico (#10) sem depender do fluxo de convite/aceite (que é a #20).

Regras rígidas respeitadas:
- **Nenhum dado real de pessoa** (LGPD). Todos os nomes e e-mails são
  inventados e usam o domínio reservado `example.com`.
- Recusa-se a rodar fora de desenvolvimento: semear um banco de produção com
  contas de senha conhecida seria uma porta dos fundos.

Uso:
    cd services/api
    python -m scripts.seed_dev
"""

from __future__ import annotations

import sys

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_engine
from app.models.care_link import CareLinkParty, CareLinkStatus
from app.models.user import UserRole
from app.repositories.care_link import CareLinkRepository
from app.repositories.user import UserRepository
from app.security.password import get_password_hasher
from app.services.care import CareService

#: Senha única dos usuários de teste. Só existe em ambiente de desenvolvimento.
SENHA_DEV = "senha-de-teste-bem-longa"

MEDICO = ("dra.ficticia@example.com", "Dra. Fictícia (teste)")
PACIENTES = [
    ("paciente.um@example.com", "Paciente Um (teste)"),
    ("paciente.dois@example.com", "Paciente Dois (teste)"),
    ("paciente.tres@example.com", "Paciente Três (teste)"),
]


def _garantir_usuario(repo: UserRepository, email: str, nome: str, papel: UserRole):
    existente = repo.get_by_email(email)
    if existente is not None:
        return existente
    return repo.create(email=email, password=SENHA_DEV, role=papel, display_name=nome)


def main() -> int:
    settings = get_settings()
    if settings.app_env != "development":
        print(
            f"Recusado: app_env={settings.app_env!r}. O seed só roda em "
            "desenvolvimento (criaria contas com senha conhecida).",
            file=sys.stderr,
        )
        return 1

    hasher = get_password_hasher(settings)
    with Session(get_engine()) as session:
        users = UserRepository(session, hasher)
        links = CareLinkRepository(session)
        care = CareService(session=session, hasher=hasher)

        medico = _garantir_usuario(users, MEDICO[0], MEDICO[1], UserRole.DOCTOR)

        for email, nome in PACIENTES:
            paciente = _garantir_usuario(users, email, nome, UserRole.PATIENT)
            vinculo = links.get_vivo(doctor_id=medico.id, patient_id=paciente.id)
            if vinculo is None:
                # Simula o caminho legítimo: o paciente inicia o vínculo, o que
                # já constitui o consentimento (ADR-0024) e nasce ACTIVE.
                care.solicitar(solicitante=paciente, email_contraparte=medico.email)

        session.commit()

        ativos = [
            link
            for link in links.listar_do_usuario(medico.id)
            if link.status is CareLinkStatus.ACTIVE
        ]
        print(f"Medico de teste: {MEDICO[0]} / {SENHA_DEV}")
        print(f"Pacientes vinculados (ACTIVE): {len(ativos)}")
        for link in ativos:
            perfil = link.patient.patient_profile
            print(f"  - {perfil.display_name if perfil else link.patient_user_id}")
        print(f"Iniciados pelo paciente: "
              f"{sum(1 for l in ativos if l.initiated_by is CareLinkParty.PATIENT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
