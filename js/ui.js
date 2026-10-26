import { db, fs, isConfigured, config } from "./firebase.js";
import { buildMessage, buildWhatsAppUrl, validateQuote } from "./whatsapp.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const ICONS = {
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`,
  threads: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.186 24C5.467 24 0 18.675 0 12.122 0 5.57 5.467.245 12.186.245c6.643 0 11.97 5.163 12.062 11.724v.266c-.05 3.328-1.576 6.064-4.305 7.708-2.316 1.396-5.184 1.706-7.868.852a6.792 6.792 0 0 1-4.707-4.838l1.94-.69a4.873 4.873 0 0 0 3.385 3.479c2.015.642 4.179.39 5.946-.673 2.052-1.236 3.2-3.328 3.24-5.903a9.923 9.923 0 0 0-9.693-9.847C6.677 2.32 2.08 6.723 2.08 12.122c0 5.399 4.597 9.803 10.106 9.803 2.656 0 5.138-.99 7.01-2.795l1.458 1.488C18.444 22.756 15.434 24 12.186 24zm-.008-15.674c-2.35 0-4.263 1.905-4.263 4.246 0 2.342 1.913 4.247 4.263 4.247 1.583 0 2.97-.864 3.712-2.155.228-.396.388-.84.468-1.314.07-.406.104-.82.104-1.238v-.07a4.254 4.254 0 0 0-4.284-3.716zm0 2.08c1.2 0 2.18.974 2.18 2.166 0 .23-.036.452-.102.66-.277.867-1.09 1.496-2.078 1.496-1.2 0-2.18-.974-2.18-2.156 0-1.192.98-2.166 2.18-2.166z"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.677.15-.201.301-.778.98-.954 1.18-.175.201-.351.226-.652.075-.301-.15-1.272-.469-2.423-1.496-.895-.799-1.5-1.787-1.676-2.088-.175-.301-.019-.464.132-.614.136-.135.301-.351.451-.527.15-.175.201-.301.301-.501.1-.201.05-.376-.025-.526-.075-.15-.677-1.631-.928-2.233-.244-.586-.493-.506-.677-.516-.175-.01-.376-.01-.577-.01-.201 0-.527.075-.803.376-.276.301-1.053 1.029-1.053 2.509 0 1.48 1.079 2.909 1.229 3.11.15.201 2.122 3.24 5.141 4.544.718.31 1.279.496 1.716.635.722.23 1.38.197 1.9.12.579-.087 1.78-.727 2.032-1.43.251-.703.251-1.305.176-1.43-.076-.126-.276-.201-.577-.351zM12.04 21.785h-.002a9.78 9.78 0 0 1-4.99-1.363l-.358-.212-3.71.973.99-3.618-.233-.371a9.775 9.775 0 0 1-1.503-5.209c0-5.4 4.394-9.794 9.8-9.794a9.73 9.73 0 0 1 6.924 2.873 9.734 9.734 0 0 1 2.87 6.925c0 5.405-4.394 9.796-9.788 9.796zm8.31-18.104A11.768 11.768 0 0 0 12.04 0C5.402 0 .007 5.394.007 12.033a11.737 11.737 0 0 0 1.603 5.962L0 24l6.17-1.618a11.758 11.758 0 0 0 5.865 1.554h.005c6.637 0 12.031-5.394 12.031-12.035a11.745 11.745 0 0 0-3.521-8.52z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
};

export const DEFAULTS = {
  brandName: "Baphotography",
  description: "Fotografia e videografia de casamentos. Histórias reais, emoções verdadeiras.",
  instagram: config.brand.instagram,
  threads: config.brand.threads || "https://www.threads.com/@baphotographyyy",
  whatsappLink: config.brand.whatsappLink,
  whatsappNumber: config.brand.whatsappNumber,
  location: "Palmas, Tocantins — atendemos todo o Brasil",
  heroTitle: "Histórias reais. Emoções que ficam para sempre.",
  heroSubtitle: "Fotografia e videografia de casamento com olhar documental, sofisticado e sensível.",
  heroImage: "",
  aboutPortrait: "",
  storyTitle: "Nossa forma de contar histórias",
  storyText: "Acreditamos que a beleza de um casamento está na espontaneidade dos instantes e na verdade dos sentimentos.",
  aboutStory: "",
  aboutPhilosophy: "",
  aboutStyle: "",
  aboutExperience: "",
  aboutProcess: "",
  aboutArea: "",
  categories: ["Casamentos", "Pré-wedding", "Ensaios de casal", "Making of", "Cerimônias e recepções", "Videografia"],
  retentionDays: 60
};

export const SERVICES = [
  "Casamento",
  "Pré-wedding",
  "Ensaio fotográfico",
  "Fotografia e videografia",
  "Outro evento"
];

let settingsCache = null;

export async function getSettings(force = false) {
  if (settingsCache && !force) return settingsCache;
  let s = {};
  if (isConfigured) {
    try {
      const d = await fs.getDoc(fs.doc(db, "settings", "site"));
      if (d.exists()) s = d.data();
    } catch (e) {
      console.warn("Falha ao ler configurações:", e.code || e.message);
    }
  }
  settingsCache = { ...DEFAULTS, ...s };
  return settingsCache;
}

export function whatsappHref(s) {
  return s.whatsappNumber ? `https://wa.me/${String(s.whatsappNumber).replace(/\D/g, "")}` : s.whatsappLink;
}

export function toast(msg, bad = false) {
  const existing = $(".toast");
  if (existing) existing.remove();
  const t = Object.assign(document.createElement("div"), {
    className: "toast" + (bad ? " bad" : ""),
    textContent: msg
  });
  t.setAttribute("role", bad ? "alert" : "status");
  document.body.append(t);
  setTimeout(() => t.remove(), 4200);
}

export function reveal(root = document) {
  const els = $$(".reveal:not(.in)", root);
  if (!els.length) return;
  if (!("IntersectionObserver" in window)) {
    return els.forEach((e) => e.classList.add("in"));
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((x) => {
      if (x.isIntersecting) {
        x.target.classList.add("in");
        io.unobserve(x.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach((e) => io.observe(e));
}

export function notConfiguredNotice(el) {
  el.innerHTML = `<div class="notice"><p>O Firebase ainda não foi configurado. Preencha <code>js/config.js</code> para conectar o banco de dados.</p></div>`;
}

export function albumCard(a) {
  const img = a.coverThumb || a.coverUrl;
  const meta = [a.category, a.year, a.location].filter(Boolean);
  return `
    <article class="album-card reveal" data-category="${esc(a.category || "")}">
      <a class="cover" href="album.html?id=${encodeURIComponent(a.id)}" aria-label="Abrir álbum ${esc(a.title)}">
        ${img ? `<img src="${esc(img)}" alt="Capa do álbum ${esc(a.title)}" loading="lazy" onerror="this.remove()">` : ""}
      </a>
      <div class="album-card-content">
        <h3><a href="album.html?id=${encodeURIComponent(a.id)}">${esc(a.title)}</a></h3>
        <div class="album-card-meta">
          ${meta.map((m) => `<span>${esc(m)}</span>`).join("")}
          ${a.photoCount ? `<span>${a.photoCount} fotos</span>` : ""}
        </div>
      </div>
    </article>
  `;
}

/**
 * Monta o layout comum: cabeçalho, rodapé, modal de orçamento flutuante e Lightbox.
 */
export async function mountLayout() {
  const s = await getSettings();
  const page = location.pathname.split("/").pop() || "index.html";

  const isHome = page === "" || page === "index.html";
  const pLink = (hash, fallbackPage, title) => {
    const href = isHome ? hash : `${fallbackPage}${hash}`;
    const isCurrent = page === fallbackPage || (isHome && hash === "#main");
    return `<a href="${href}" ${isCurrent ? 'aria-current="page"' : ""}>${title}</a>`;
  };

  // 1. Cabeçalho
  const headerTarget = $("#site-header");
  if (headerTarget) {
    headerTarget.outerHTML = `
      <header class="site-header">
        <div class="wrap">
          <a class="brand" href="index.html" aria-label="${esc(s.brandName)} — Início">
            <span class="brand-monogram">BA</span>
            <span>${esc(s.brandName)}</span>
          </a>
          <nav class="nav" id="nav" aria-label="Navegação principal">
            ${pLink("#main", "index.html", "Início")}
            ${pLink("#portfolio", "portfolio.html", "Portfólio")}
            ${pLink("#sobre", "sobre.html", "Sobre")}
            ${pLink("#avaliacoes", "index.html", "Avaliações")}
            ${pLink("#contato", "orcamento.html", "Contato")}
            <button type="button" class="btn small quote-modal-open">Solicitar orçamento</button>
          </nav>
          <div class="header-actions">
            <div class="social-pills" aria-label="Redes sociais oficiais">
              <a class="btn-icon" href="${esc(s.instagram)}" target="_blank" rel="noopener noreferrer" aria-label="Instagram da Baphotography">${ICONS.instagram}</a>
              <a class="btn-icon" href="${esc(s.threads)}" target="_blank" rel="noopener noreferrer" aria-label="Threads da Baphotography">${ICONS.threads}</a>
              <a class="btn-icon" href="${esc(whatsappHref(s))}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp da Baphotography">${ICONS.whatsapp}</a>
            </div>
            <button class="menu-btn" aria-expanded="false" aria-controls="nav" aria-label="Abrir menu">
              <span>Menu</span>
              <div class="menu-icon" aria-hidden="true"><span></span><span></span><span></span></div>
            </button>
          </div>
        </div>
      </header>
    `;
  }

  // 2. Rodapé
  const footerTarget = $("#site-footer");
  if (footerTarget) {
    footerTarget.outerHTML = `
      <footer>
        <div class="wrap">
          <div>
            <a class="brand" href="index.html" style="margin-bottom:1rem;display:inline-flex">
              <span class="brand-monogram">BA</span>
              <span>${esc(s.brandName)}</span>
            </a>
            <p>${esc(s.description)}</p>
            <p class="muted" style="margin-top:.8rem">${esc(s.location)}</p>
          </div>
          <ul data-title="Navegação">
            <li><a href="index.html">Início</a></li>
            <li><a href="portfolio.html">Portfólio</a></li>
            <li><a href="sobre.html">Sobre o fotógrafo</a></li>
            <li><a href="orcamento.html">Solicitar orçamento</a></li>
            <li><a href="privacidade.html">Política de privacidade</a></li>
          </ul>
          <ul data-title="Redes Oficiais">
            <li><a href="${esc(s.instagram)}" target="_blank" rel="noopener noreferrer">Instagram ↗</a></li>
            <li><a href="${esc(s.threads)}" target="_blank" rel="noopener noreferrer">Threads ↗</a></li>
            <li><a href="${esc(whatsappHref(s))}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a></li>
          </ul>
          <div class="copyright">
            <span>© ${new Date().getFullYear()} ${esc(s.brandName)}. Todos os direitos reservados.</span>
            <span>Histórias reais, emoções verdadeiras. Palmas, Tocantins.</span>
          </div>
        </div>
      </footer>
    `;
  }

  // Comportamento do menu mobile
  const menuBtn = $(".menu-btn"), nav = $("#nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open);
      menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      menuBtn.querySelector("span").textContent = open ? "Fechar" : "Menu";
    });
    nav.addEventListener("click", (e) => {
      if (e.target.tagName === "A" || e.target.classList.contains("quote-modal-open")) {
        nav.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", false);
        menuBtn.setAttribute("aria-label", "Abrir menu");
        menuBtn.querySelector("span").textContent = "Menu";
      }
    });
  }

  // 3. Monta o Modal Flutuante de Orçamento
  setupFloatingQuoteModal(s);

  // 4. Monta o Lightbox Global
  setupGlobalLightbox();

  reveal();
  return s;
}

/**
 * Inicializa o Modal de Orçamento Flutuante NATIVO com campo de Horário Desejado
 */
export function setupFloatingQuoteModal(s) {
  let modal = $("#quote-floating-modal");
  if (!modal) {
    modal = document.createElement("dialog");
    modal.id = "quote-floating-modal";
    modal.className = "quote-modal";
    modal.setAttribute("aria-labelledby", "quote-modal-heading");
    modal.innerHTML = `
      <div class="modal-header">
        <div>
          <p class="eyebrow" style="margin-bottom:.3rem">Baphotography</p>
          <h3 id="quote-modal-heading">Solicitar Orçamento</h3>
        </div>
        <button type="button" class="modal-close-btn" id="quote-modal-close" aria-label="Fechar formulário">${ICONS.close}</button>
      </div>
      <div class="modal-body" id="quote-modal-body">
        <form id="quote-floating-form" class="form" novalidate>
          <div class="modal-grid-2">
            <label>Seu nome completo *<input name="name" autocomplete="name" required minlength="2" maxlength="120" placeholder="Ex.: Mariana & Rafael"><span class="err" data-for="name"></span></label>
            <label>WhatsApp ou telefone *<input name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="(DDD) 99999-9999"><span class="err" data-for="phone"></span></label>
          </div>
          <div class="modal-grid-2">
            <label>E-mail (opcional)<input name="email" type="email" autocomplete="email" placeholder="seuemail@exemplo.com"><span class="err" data-for="email"></span></label>
            <label>Tipo de serviço *
              <select name="service" required>
                <option value="">Selecione um serviço</option>
                ${SERVICES.map((sv) => `<option value="${esc(sv)}">${esc(sv)}</option>`).join("")}
              </select>
              <span class="err" data-for="service"></span>
            </label>
          </div>
          <div class="modal-grid-3">
            <label>Data desejada *<input name="eventDate" type="date" required><span class="err" data-for="eventDate"></span></label>
            <label>Horário desejado (opcional)<input name="eventTime" type="time" placeholder="Ex.: 16:30"><span class="err" data-for="eventTime"></span></label>
            <label>Cidade / Local (opcional)<input name="location" maxlength="160" placeholder="Ex.: Palmas-TO"><span class="err" data-for="location"></span></label>
          </div>
          <label>Observações ou mensagem (opcional)<textarea name="notes" maxlength="1000" placeholder="Conte um pouco sobre vocês, o local planejado e suas expectativas..."></textarea><span class="err" data-for="notes"></span></label>
          <label class="hp" aria-hidden="true">Deixe vazio<input name="website" tabindex="-1" autocomplete="off"></label>
          <label class="consent-row">
            <input type="checkbox" name="consent" required checked>
            <span>Concordo com o registro dos dados para fins exclusivos deste atendimento, respeitando a política de retenção de 60 dias da Baphotography.</span>
          </label>
          <span class="err" data-for="consent"></span>
          <div style="margin-top:.5rem">
            <button type="submit" class="btn" id="quote-floating-submit">Enviar solicitação</button>
          </div>
        </form>
      </div>
    `;
    document.body.append(modal);
  }

  const form = $("#quote-floating-form", modal);
  const body = $("#quote-modal-body", modal);
  const closeBtn = $("#quote-modal-close", modal);
  const submitBtn = $("#quote-floating-submit", modal);

  const closeModal = () => {
    if (modal.open) {
      modal.close();
      document.body.classList.remove("modal-open");
    }
  };

  const openModal = () => {
    if (typeof modal.showModal === "function") {
      document.body.classList.add("modal-open");
      modal.showModal();
      setTimeout(() => form?.querySelector("input[name=name]")?.focus(), 100);
    } else {
      location.href = "orcamento.html";
    }
  };

  $$(".quote-modal-open").forEach((btn) => (btn.onclick = (e) => { e.preventDefault(); openModal(); }));
  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  modal.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  if (form) {
    const dateInput = form.querySelector("[name=eventDate]");
    if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      if (data.website) return;

      const errors = validateQuote(data);
      if (!data.consent) errors.consent = "Por favor, confirme seu consentimento.";

      $$("[data-for]", form).forEach((el) => { el.textContent = errors[el.dataset.for] || ""; });
      $$("input,select,textarea", form).forEach((i) => i.setAttribute("aria-invalid", Boolean(errors[i.name])));

      if (Object.keys(errors).length) {
        form.querySelector("[aria-invalid=true]")?.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Gravando solicitação…";

      let docId = "req-" + Date.now().toString(36);
      let saved = false;

      if (isConfigured) {
        try {
          const docRef = await fs.addDoc(fs.collection(db, "requests"), {
            name: data.name.trim(),
            phone: data.phone.trim(),
            service: data.service,
            eventDate: data.eventDate,
            eventTime: (data.eventTime || "").trim(),
            ...(data.email ? { email: data.email.trim() } : {}),
            ...(data.location ? { location: data.location.trim() } : {}),
            ...(data.notes ? { notes: data.notes.trim() } : {}),
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

      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar solicitação";

      const msg = buildMessage({ ...data, id: docId });
      const wa = buildWhatsAppUrl({ number: s.whatsappNumber, link: s.whatsappLink }, msg);

      // Renderiza confirmação no modal
      body.innerHTML = `
        <div class="modal-success">
          <div class="modal-success-icon">✓</div>
          <h3>Solicitação Recebida com Sucesso!</h3>
          <p class="muted">Obrigado, <strong>${esc(data.name)}</strong>! Seu pedido de orçamento foi registrado sob a referência <strong>#${esc(docId.slice(0, 8))}</strong>.</p>
          <p style="margin-top:1.2rem;font-size:.95rem">Para confirmar os detalhes com o fotógrafo agora mesmo, continue a conversa diretamente no WhatsApp com os dados pré-preenchidos:</p>
          <div style="margin-top:2rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
            <a class="btn gold" id="wa-handoff-btn" href="${esc(wa.url || s.whatsappLink)}" target="_blank" rel="noopener noreferrer">
              Continuar no WhatsApp com mensagem pronta ↗
            </a>
            <button class="btn ghost" id="modal-done-btn" type="button">Fechar janela</button>
          </div>
        </div>
      `;

      $("#wa-handoff-btn")?.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(msg); } catch {}
      });

      $("#modal-done-btn")?.addEventListener("click", closeModal);

      // Tenta abrir suavemente a janela do WhatsApp após confirmação
      try {
        const popup = window.open(wa.url, "_blank", "noopener");
        if (!popup) {
          console.log("Navegador bloqueou popup automático; exibido botão destacado.");
        }
      } catch {}
    };
  }
}

/**
 * Lightbox Global para ampliação de fotos com navegação
 */
let globalPhotos = [];
let globalPhotoIndex = 0;

export function setupGlobalLightbox() {
  let lb = $("#global-lightbox");
  if (!lb) {
    lb = document.createElement("dialog");
    lb.id = "global-lightbox";
    lb.className = "lb";
    lb.setAttribute("aria-label", "Visualização ampliada de fotografia");
    lb.innerHTML = `
      <div class="lb-top-bar">
        <span id="lb-counter" class="eyebrow" style="margin:0;color:#c29853"></span>
        <button type="button" class="btn-icon" id="lb-close" aria-label="Fechar visualização" style="color:#fff;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)">${ICONS.close}</button>
      </div>
      <div class="lb-stage">
        <button type="button" class="lb-nav-btn lb-nav-prev" id="lb-prev" aria-label="Fotografia anterior">←</button>
        <img id="lb-img" src="" alt="Fotografia em alta resolução">
        <button type="button" class="lb-nav-btn lb-nav-next" id="lb-next" aria-label="Próxima fotografia">→</button>
      </div>
      <div class="lb-bottom-bar">
        <span id="lb-title"></span>
        <span class="muted" style="font-size:.75rem">Navegue com as setas ← e → do teclado</span>
      </div>
    `;
    document.body.append(lb);

    const updateDisplay = () => {
      if (!globalPhotos.length) return;
      const p = globalPhotos[globalPhotoIndex];
      const img = $("#lb-img", lb);
      img.src = p.url || p.thumbUrl;
      img.alt = p.alt || p.title || "Fotografia";
      $("#lb-counter", lb).textContent = `${globalPhotoIndex + 1} de ${globalPhotos.length}`;
      $("#lb-title", lb).textContent = p.title || p.alt || "";
    };

    const nextPhoto = () => {
      globalPhotoIndex = (globalPhotoIndex + 1) % globalPhotos.length;
      updateDisplay();
    };

    const prevPhoto = () => {
      globalPhotoIndex = (globalPhotoIndex - 1 + globalPhotos.length) % globalPhotos.length;
      updateDisplay();
    };

    $("#lb-next", lb).onclick = nextPhoto;
    $("#lb-prev", lb).onclick = prevPhoto;
    $("#lb-close", lb).onclick = () => lb.close();
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-stage")) lb.close(); });
    lb.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "ArrowLeft") prevPhoto();
      if (e.key === "Escape") lb.close();
    });

    lb._updateDisplay = updateDisplay;
  }
}

export function openLightbox(photos, startIndex = 0) {
  const lb = $("#global-lightbox");
  if (!lb || !photos.length) return;
  globalPhotos = photos;
  globalPhotoIndex = Math.max(0, Math.min(startIndex, photos.length - 1));
  lb._updateDisplay();
  lb.showModal();
}
