// Funções puras para manipulação e validação de solicitações e WhatsApp.

export function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

export function formatTime(t) {
  if (!t) return "A combinar";
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t).trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : t;
}

export function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

export function normalizeBR(phone) {
  const d = digits(phone);
  return d.length === 10 || d.length === 11 ? "55" + d : d;
}

export function buildMessage(d) {
  const v = (x) => (x && String(x).trim()) || "A combinar";
  const lines = [
    "Olá! Acabei de enviar um pedido de orçamento pelo site Baphotography.",
    "",
    `Nome: ${v(d.name)}`,
    `Serviço: ${v(d.service)}`,
    `Data desejada: ${v(formatDate(d.eventDate))}`,
    `Horário desejado: ${v(formatTime(d.eventTime))}`
  ];

  if (d.id || d.requestId) {
    lines.push(`Solicitação: #${String(d.id || d.requestId).slice(0, 8)}`);
  }
  if (d.location && String(d.location).trim()) {
    lines.push(`Local do evento: ${String(d.location).trim()}`);
  }
  if (d.notes && String(d.notes).trim()) {
    lines.push(`Observações: ${String(d.notes).trim()}`);
  }

  lines.push("", "Aguardo o retorno para confirmar os detalhes. Obrigado!");
  return lines.join("\n");
}

export function buildWhatsAppUrl({ number, link }, message) {
  const n = digits(number);
  const encodedText = encodeURIComponent(message || "");

  if (n.length >= 10) {
    return {
      url: `https://wa.me/${n}?text=${encodedText}`,
      prefilled: true
    };
  }

  const baseLink = link || "https://wa.me/message/BHVC4OEONZS7A1";
  const sep = baseLink.includes("?") ? "&" : "?";
  return {
    url: `${baseLink}${sep}text=${encodedText}`,
    prefilled: true
  };
}

export function validateQuote(d, today = new Date().toISOString().slice(0, 10)) {
  const e = {};
  if (!d.name || d.name.trim().length < 2) {
    e.name = "Informe seu nome completo.";
  }
  if (digits(d.phone).length < 10) {
    e.phone = "Informe um telefone com DDD válido.";
  }
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) {
    e.email = "Este e-mail parece inválido.";
  }
  if (!d.service) {
    e.service = "Escolha o tipo de serviço pretendido.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.eventDate || "")) {
    e.eventDate = "Informe a data desejada.";
  } else if (d.eventDate < today) {
    e.eventDate = "A data deve ser hoje ou uma data futura.";
  }
  if ((d.notes || "").length > 1000) {
    e.notes = "Use no máximo 1000 caracteres nas observações.";
  }
  return e;
}
