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

import math
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.consent import CONSENT_TERM_VERSION
from app.db.session import get_engine
from app.models.care_link import CareLinkParty, CareLinkStatus
from app.models.result import Result
from app.models.session import CaptureSession, SessionStatus
from app.models.user import User, UserRole
from app.repositories.care_link import CareLinkRepository
from app.repositories.user import UserRepository
from app.security.crypto import get_metrics_cipher
from app.security.password import get_password_hasher
from app.services.care import CareService
from app.services.results import ResultService

#: Senha única dos usuários de teste. Só existe em ambiente de desenvolvimento.
SENHA_DEV = "senha-de-teste-bem-longa"

MEDICO = ("dra.ficticia@example.com", "Dra. Fictícia (teste)")
PACIENTES = [
    ("paciente.um@example.com", "Paciente Um (teste)"),
    ("paciente.dois@example.com", "Paciente Dois (teste)"),
    ("paciente.tres@example.com", "Paciente Três (teste)"),
]


#: Quantas sessões fictícias por paciente (o bastante para a linha do tempo).
SESSOES_POR_PACIENTE = 6

#: Marca o engine dos dados semeados. Aparece na UI como "Motor de análise",
#: então quem olhar a tela vê na hora que aquilo NÃO veio de captação real.
ENGINE_FICTICIO = "SEED-FICTICIO/0.1.0"


def _garantir_usuario(repo: UserRepository, email: str, nome: str, papel: UserRole):
    existente = repo.get_by_email(email)
    if existente is not None:
        return existente
    return repo.create(email=email, password=SENHA_DEV, role=papel, display_name=nome)


def _metricas_ficticias(indice: int) -> dict:
    """Métricas **inventadas**, com variação suave e determinística.

    Determinístico de propósito: rodar o seed duas vezes não muda os gráficos,
    o que torna a inspeção visual confiável. Nenhum dado de pessoa real (LGPD).
    """
    alpha = 0.24 + 0.05 * math.sin(indice / 1.7)
    beta = 0.18 + 0.03 * math.cos(indice / 2.3)
    theta = 0.20 + 0.02 * math.sin(indice / 3.1)
    delta = 0.30
    gamma = 0.08
    total = alpha + beta + theta + delta + gamma

    rel = {
        "delta": delta / total,
        "theta": theta / total,
        "alpha": alpha / total,
        "beta": beta / total,
        "gamma": gamma / total,
    }
    # Potência "absoluta" fictícia só para o campo existir com forma plausível.
    escala = 120.0 + 8.0 * math.sin(indice)
    powers = {banda: valor * escala for banda, valor in rel.items()}

    return {
        "engine_version": ENGINE_FICTICIO,
        "fs": 512.0,
        "n_samples": int(512 * (300 + 45 * indice)),
        "band_powers": powers,
        "relative_band_powers": rel,
        "rel_alpha": rel["alpha"],
        "quality": {
            "signal_std": 38.0 + 4.0 * math.cos(indice / 1.3),
            "mains_power": 1.2 + 0.3 * math.sin(indice / 2.0),
            "mains_power_ratio": 0.012 + 0.004 * math.sin(indice / 2.0),
        },
        "comparison": None,
    }


def _semear_sessoes(session: Session, results: ResultService, paciente: User) -> int:
    """Cria sessões + Result fictícios para o paciente, espalhados no tempo.

    Idempotente: se o paciente já tem Result, não duplica.
    """
    ja_tem = session.scalar(
        select(func.count()).select_from(Result).where(Result.patient_user_id == paciente.id)
    )
    if ja_tem:
        return 0

    # O gate do ADR-0026 exige consentimento para persistir — o seed simula o
    # titular tendo aceitado o termo vigente, como faria pela tela da #29.
    if paciente.consent_given_at is None:
        paciente.consent_given_at = datetime.now(UTC)
        paciente.consent_version = CONSENT_TERM_VERSION
        session.flush()

    agora = datetime.now(UTC)
    criados = 0
    for i in range(SESSOES_POR_PACIENTE):
        # Da mais antiga para a mais recente, ~5 dias entre sessões.
        quando = agora - timedelta(days=5 * (SESSOES_POR_PACIENTE - 1 - i))
        metricas = _metricas_ficticias(i)

        captura = CaptureSession(
            patient_user_id=paciente.id,
            device="simulador (seed)",
            sample_rate=512,
            status=SessionStatus.COMPLETED,
        )
        session.add(captura)
        session.flush()

        result = results.persistir(
            patient=paciente, session_id=captura.id, metrics=metricas
        )
        if result is not None:
            # `created_at` tem default do banco; sobrescrever é o que espalha
            # as sessões no tempo e dá forma à linha de tendência.
            result.created_at = quando
            criados += 1
    session.flush()
    return criados


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
        results = ResultService(
            session=session, settings=settings, cipher=get_metrics_cipher(settings)
        )

        medico = _garantir_usuario(users, MEDICO[0], MEDICO[1], UserRole.DOCTOR)

        sessoes_criadas = 0
        for email, nome in PACIENTES:
            paciente = _garantir_usuario(users, email, nome, UserRole.PATIENT)
            vinculo = links.get_vivo(doctor_id=medico.id, patient_id=paciente.id)
            if vinculo is None:
                # Simula o caminho legítimo: o paciente inicia o vínculo, o que
                # já constitui o consentimento (ADR-0024) e nasce ACTIVE.
                care.solicitar(solicitante=paciente, email_contraparte=medico.email)
            # Dados para os dashboards da #16.
            sessoes_criadas += _semear_sessoes(session, results, paciente)

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
        print(f"Sessões fictícias criadas: {sessoes_criadas} "
              f"(engine {ENGINE_FICTICIO})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
