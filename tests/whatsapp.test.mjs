import test from "node:test";
import assert from "node:assert/strict";
import { buildMessage, buildWhatsAppUrl, validateQuote, normalizeBR, formatTime } from "../js/whatsapp.js";

const ok = {
  id: "req-12345678",
  name: "Ana Souza",
  phone: "(63) 99999-0000",
  service: "Casamento",
  eventDate: "2030-05-10",
  eventTime: "16:30"
};

test("mensagem contém cabeçalho oficial e campos esperados", () => {
  const m = buildMessage({ ...ok, location: "Palmas-TO", notes: "Casamento ao pôr do sol" });
  assert.match(m, /Olá! Acabei de enviar um pedido de orçamento pelo site Baphotography\./);
  assert.match(m, /Nome: Ana Souza/);
  assert.match(m, /Serviço: Casamento/);
  assert.match(m, /Data desejada: 10\/05\/2030/);
  assert.match(m, /Horário desejado: 16:30/);
  assert.match(m, /Solicitação: #req-1234/);
  assert.match(m, /Local do evento: Palmas-TO/);
  assert.match(m, /Observações: Casamento ao pôr do sol/);
  assert.match(m, /Aguardo o retorno para confirmar os detalhes\. Obrigado!/);
});

test("formatação de horário", () => {
  assert.equal(formatTime("14:00"), "14:00");
  assert.equal(formatTime("9:30"), "09:30");
  assert.equal(formatTime(""), "A combinar");
});

test("wa.me com número codifica o texto", () => {
  const r = buildWhatsAppUrl({ number: "5563999990000", link: "https://wa.me/message/X" }, "Olá");
  assert.equal(r.prefilled, true);
  assert.equal(r.url, "https://wa.me/5563999990000?text=Ol%C3%A1");
});

test("link oficial wa.me/message recebe texto codificado", () => {
  const r = buildWhatsAppUrl({ number: "", link: "https://wa.me/message/BHVC4OEONZS7A1" }, "Teste");
  assert.equal(r.prefilled, true);
  assert.equal(r.url, "https://wa.me/message/BHVC4OEONZS7A1?text=Teste");
});

test("validação de orçamento", () => {
  assert.deepEqual(validateQuote(ok, "2030-01-01"), {});
  const e = validateQuote({ name: "a", phone: "123", email: "invalido", eventDate: "2020-01-01" }, "2030-01-01");
  assert.ok(e.name && e.phone && e.email && e.service && e.eventDate);
});

test("normalizeBR", () => {
  assert.equal(normalizeBR("(63) 99999-0000"), "5563999990000");
});
