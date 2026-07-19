/**
 * Sessões **fictícias** compartilhadas pelas telas.
 *
 * Existem só para dar forma à navegação enquanto o histórico real não existe
 * (depende do relatório por sessão — #15). Toda tela que as exibe precisa
 * mostrar o selo de dados fictícios: nunca apresentar mock como se fosse
 * medição de alguém.
 *
 * Nenhum dado de pessoa real (LGPD).
 */

export type MockSession = {
  id: string;
  date: string;
  duration: string;
};

export const MOCK_SESSIONS: MockSession[] = [
  { id: "s-1", date: "12/07/2026", duration: "8 min" },
  { id: "s-2", date: "09/07/2026", duration: "12 min" },
  { id: "s-3", date: "02/07/2026", duration: "6 min" },
  { id: "s-4", date: "28/06/2026", duration: "10 min" },
];

/** Texto padrão do resultado — nunca insinua um achado clínico. */
export const RESULTADO_INDISPONIVEL = "resultado indisponível nesta fase";
