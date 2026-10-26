import test from "node:test";
import assert from "node:assert/strict";

const RETENTION_DAYS = 60;

function isEligibleForRetention(request, nowTimestamp) {
  if (!request || request.status !== "encerrada") return false;
  if (!request.createdAt) return false;
  const createdAtMillis = typeof request.createdAt.toMillis === "function"
    ? request.createdAt.toMillis()
    : new Date(request.createdAt).getTime();

  const cutoff = nowTimestamp - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return createdAtMillis < cutoff;
}

test("política de retenção é exatamente de 60 dias", () => {
  assert.equal(RETENTION_DAYS, 60);
});

test("solicitação encerrada com mais de 60 dias É elegível para exclusão", () => {
  const now = Date.now();
  const oldClosed = {
    status: "encerrada",
    createdAt: new Date(now - 61 * 24 * 60 * 60 * 1000)
  };
  assert.equal(isEligibleForRetention(oldClosed, now), true);
});

test("solicitação encerrada com menos de 60 dias NÃO é elegível para exclusão", () => {
  const now = Date.now();
  const recentClosed = {
    status: "encerrada",
    createdAt: new Date(now - 59 * 24 * 60 * 60 * 1000)
  };
  assert.equal(isEligibleForRetention(recentClosed, now), false);
});

test("solicitações ativas (nova, atendimento, etc.) NUNCA são elegíveis mesmo com mais de 60 dias", () => {
  const now = Date.now();
  const statuses = ["nova", "atendimento", "orcamento", "contratada"];
  for (const st of statuses) {
    const oldActive = {
      status: st,
      createdAt: new Date(now - 120 * 24 * 60 * 60 * 1000)
    };
    assert.equal(isEligibleForRetention(oldActive, now), false, `Status ${st} não pode ser excluído.`);
  }
});
