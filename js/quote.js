import { db, fs, isConfigured } from "./firebase.js";
import { $, $$, esc, mountLayout, SERVICES } from "./ui.js";
import { buildMessage, buildWhatsAppUrl, validateQuote } from "./whatsapp.js";

const s = await mountLayout();
const form = $("#q"), out = $("#result"), btn = $("#send");
const serviceSelect = $("[name=service]");

if (serviceSelect) {
  serviceSelect.insertAdjacentHTML("beforeend", SERVICES.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join(""));
}

const dateInput = $("[name=eventDate]");
if (dateInput) {
  dateInput.min = new Date().toISOString().slice(0, 10);
}

const val = () => Object.fromEntries(new FormData(form));

function showErrors(e) {
  $$("[data-for]", form).forEach((el) => { el.textContent = e[el.dataset.for] || ""; });
  $$("input,select,textarea", form).forEach((i) => i.setAttribute("aria-invalid", Boolean(e[i.name])));
  const first = form.querySelector("[aria-invalid=true]");
  first?.focus();
}

form?.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const d = val();
  if (d.website) return; // honeypot anti-spam

  const e = validateQuote(d);
  if (!d.consent) e.consent = "Por favor, aceite os termos de privacidade para continuar.";
  showErrors(e);
  if (Object.keys(e).length) return;

  btn.disabled = true;
  btn.textContent = "Gravando solicitação…";

  let docId = "req-" + Date.now().toString(36);
  let saved = false;

  if (isConfigured) {
    try {
      const docRef = await fs.addDoc(fs.collection(db, "requests"), {
        name: d.name.trim(),
        phone: d.phone.trim(),
        service: d.service,
        eventDate: d.eventDate,
        eventTime: (d.eventTime || "").trim(),
        ...(d.email ? { email: d.email.trim() } : {}),
        ...(d.location ? { location: d.location.trim() } : {}),
        ...(d.notes ? { notes: d.notes.trim() } : {}),
        status: "novo",
        consent: true,
        createdAt: fs.serverTimestamp()
      });
      docId = docRef.id;
      saved = true;
    } catch (err) {
      console.warn("Falha ao salvar no Firestore:", err.code || err.message);
    }
  }

  btn.disabled = false;
  btn.textContent = "Enviar solicitação";

  const msg = buildMessage({ ...d, id: docId });
  const wa = buildWhatsAppUrl({ number: s.whatsappNumber, link: s.whatsappLink }, msg);

  out.innerHTML = `
    <div class="notice" style="border-color:var(--gold);background:var(--surface)">
      <h3 style="font-size:1.5rem;color:var(--gold);margin-bottom:.4rem">Solicitação registrada com sucesso!</h3>
      <p class="muted">Recebemos seus dados (Referência: <strong>#${esc(docId.slice(0, 8))}</strong>). Clique no botão abaixo para abrir o WhatsApp oficial com todos os detalhes já preenchidos:</p>
      <div style="margin-top:1.5rem">
        <a class="btn gold" id="wa-btn" href="${esc(wa.url || s.whatsappLink)}" target="_blank" rel="noopener noreferrer">
          Continuar no WhatsApp com mensagem pronta ↗
        </a>
      </div>
      <p class="muted" style="font-size:.78rem;margin-top:1.2rem">Caso o texto não carregue automaticamente no WhatsApp, ele foi copiado para a área de transferência.</p>
    </div>
  `;

  $("#wa-btn")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(msg); } catch {}
  });

  // Tenta abrir janela do WhatsApp automaticamente
  try {
    window.open(wa.url, "_blank", "noopener");
  } catch {}
});
