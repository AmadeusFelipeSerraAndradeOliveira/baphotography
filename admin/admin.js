import { db, storage, auth, fs, st, au, isConfigured, uploadToStorage } from "../js/firebase.js";
import { DEFAULTS, SERVICES, esc, toast, $, $$ } from "../js/ui.js";
import { normalizeBR, formatDate, formatTime } from "../js/whatsapp.js";

const app = $("#app");

// 3 Status estritos obrigatórios conforme Requisito 4
const STATUS = {
  novo: "Novo",
  atendimento: "Em atendimento",
  cancelado: "Cancelado"
};

const PAYMENT_METHODS = [
  "Pix",
  "Dinheiro",
  "Cartão de crédito",
  "Cartão de débito",
  "Transferência bancária",
  "Outra forma de pagamento"
];

const MAX_FILES = 40;
const MAX_BYTES = 35 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

let settings = { ...DEFAULTS };
let view = "dash";
let editing = null;

if (!isConfigured) {
  app.innerHTML = `<main class="wrap" style="padding-block:4rem"><div class="notice bad"><p>Configure o Firebase em <code>js/config.js</code> para acessar o painel administrativo.</p></div></main>`;
} else {
  au.onAuthStateChanged(auth, async (u) => (u ? start(u) : login()));
}

/* ==========================================================================
   AUTENTICAÇÃO & INICIALIZAÇÃO DO PAINEL
   ========================================================================== */
function login(msg = "") {
  app.innerHTML = `
    <main class="wrap admin-login" style="max-width:520px;padding-block:clamp(3rem,8vh,6rem)">
      <div style="background:var(--surface);border:1px solid var(--line);padding:clamp(2rem,5vw,3.5rem);border-radius:var(--radius-sm);box-shadow:var(--shadow-md)">
        <p class="eyebrow" style="margin-bottom:.5rem">Acesso Restrito</p>
        <h1 style="font-size:clamp(2.4rem,5vw,3.4rem);margin-bottom:.6rem">Baphotography Studio</h1>
        <p class="muted" style="margin-bottom:2rem;font-size:.92rem">Faça login com sua conta administrativa para gerenciar o portfólio, agendamentos e o financeiro.</p>
        <form id="lf" class="form">
          <label>E-mail do administrador<input name="e" type="email" autocomplete="username" required placeholder="admin@baphotography.com"></label>
          <label>Senha de acesso<input name="p" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
          ${msg ? `<p class="err" role="alert">${esc(msg)}</p>` : ""}
          <div style="margin-top:.8rem">
            <button class="btn" style="width:100%">Entrar no Painel</button>
          </div>
        </form>
      </div>
    </main>
  `;

  $("#lf").onsubmit = async (ev) => {
    ev.preventDefault();
    const btn = ev.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = "Verificando credenciais…";
    try {
      await au.signInWithEmailAndPassword(auth, ev.target.e.value.trim(), ev.target.p.value);
    } catch {
      login("E-mail ou senha incorretos.");
    }
  };
}

async function start(user) {
  const adm = await fs.getDoc(fs.doc(db, "admins", user.uid)).catch(() => null);
  if (!adm?.exists()) {
    app.innerHTML = `
      <main class="wrap" style="padding-block:5rem;max-width:680px">
        <div class="notice bad">
          <h3 style="color:var(--danger);font-size:1.6rem;margin-bottom:.5rem">Acesso não autorizado</h3>
          <p>Esta conta não possui perfil de administrador cadastrado no Firestore.</p>
          <p style="margin-top:.8rem">Seu UID autenticado: <code style="background:rgba(0,0,0,.08);padding:.2rem .4rem;border-radius:3px">${esc(user.uid)}</code></p>
          <p style="font-size:.85rem;color:var(--text-muted);margin-top:.8rem">Crie o documento correspondente na coleção <code>admins/${esc(user.uid)}</code> no console Firebase.</p>
          <p style="margin-top:1.5rem"><button class="btn ghost small" id="out">Sair da conta</button></p>
        </div>
      </main>
    `;
    $("#out").onclick = () => au.signOut(auth);
    return;
  }

  const s = await fs.getDoc(fs.doc(db, "settings", "site"));
  if (s.exists()) settings = { ...DEFAULTS, ...s.data() };
  shell();
}

async function shell() {
  let pendingCount = 0;
  let newRequestsCount = 0;
  try {
    const [pSnap, rSnap] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, "testimonials"), fs.where("published", "==", false))),
      fs.getDocs(fs.query(fs.collection(db, "requests"), fs.where("status", "in", ["novo", "nova"])))
    ]);
    pendingCount = pSnap.size;
    newRequestsCount = rSnap.size;
  } catch {}

  const tabs = [
    ["dash", "Visão Geral", ""],
    ["albums", "Portfólio & Álbuns", ""],
    ["schedules", "Agendamentos", ""],
    ["requests", "Solicitações", newRequestsCount ? `<span class="admin-badge pending">${newRequestsCount}</span>` : ""],
    ["finance", "Financeiro", ""],
    ["testi", "Avaliações", pendingCount ? `<span class="admin-badge pending">${pendingCount}</span>` : ""],
    ["content", "Conteúdo do Site", ""],
    ["settings", "Configurações", ""]
  ];

  app.innerHTML = `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <a class="brand" href="../index.html" target="_blank" title="Abrir site público">
            <span class="brand-monogram">BA</span>
            <span style="font-size:1.35rem">Baphotography</span>
          </a>
          <span style="display:block;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-top:.4rem;font-weight:600">Studio Management</span>
        </div>
        ${tabs.map(([k, t, badge]) => `
          <button class="admin-nav-item" data-v="${k}">
            <span>${t}</span>
            ${badge}
          </button>
        `).join("")}
        <div style="margin-top:auto;padding-top:1.5rem;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:.5rem">
          <a href="../index.html" target="_blank" class="admin-nav-item" style="color:var(--text-muted)">Ver site público ↗</a>
          <button id="out" class="admin-nav-item" style="color:var(--danger)">Encerrar sessão</button>
        </div>
      </aside>
      <main class="admin-main" id="view"></main>
    </div>
  `;

  $$(".admin-sidebar [data-v]").forEach((b) => (b.onclick = () => {
    view = b.dataset.v;
    editing = null;
    render();
  }));

  $("#out").onclick = () => au.signOut(auth);
  render();
}

async function render() {
  $$(".admin-sidebar [data-v]").forEach((b) => b.setAttribute("aria-current", b.dataset.v === view));
  const v = $("#view");
  v.innerHTML = `<div class="skeleton" style="min-height:22rem"></div>`;

  try {
    const renderers = {
      dash,
      albums,
      schedules: schedulesView,
      requests: requestsView,
      finance: financeView,
      testi: testimonialsView,
      content: contentView,
      settings: settingsView // Preservada rigorosamente a função de configurações!
    };
    const renderer = renderers[view];
    if (typeof renderer !== "function") throw new Error(`Seção administrativa desconhecida: ${view}`);
    await renderer(v);
  } catch (e) {
    console.error("Erro na seção:", e);
    v.innerHTML = `<div class="notice bad"><p>Erro ao carregar seção (${esc(e.code || e.message)}). Verifique regras e índices do Firestore.</p></div>`;
  }
}

const count = async (q) => (await fs.getCountFromServer(q)).data().count;

function formatCurrency(val) {
  const num = Number(val) || 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseCurrencyInput(str) {
  if (typeof str === "number") return str;
  const clean = String(str || "").replace(/[^\d,.-]/g, "").replace(".", "").replace(",", ".");
  return Number(clean) || 0;
}

function toBlob(bmp, max, q) {
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * r);
  const h = Math.round(bmp.height * r);
  const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return new Promise((res) => {
    c.toBlob((b) => (b && b.type === "image/webp" ? res({ b, w, h, ext: "webp" }) : c.toBlob((j) => res({ b: j, w, h, ext: "jpg" }), "image/jpeg", q)), "image/webp", q);
  });
}

/* ==========================================================================
   1. DASHBOARD / VISÃO GERAL
   ========================================================================== */
async function dash(v) {
  const [pub, drafts, photos, reqsSnap, financeSnap] = await Promise.all([
    count(fs.query(fs.collection(db, "albums"), fs.where("status", "==", "published"))).catch(() => 0),
    count(fs.query(fs.collection(db, "albums"), fs.where("status", "==", "draft"))).catch(() => 0),
    count(fs.collectionGroup(db, "photos")).catch(() => 0),
    fs.getDocs(fs.query(fs.collection(db, "requests"), fs.orderBy("createdAt", "desc"), fs.limit(50))).catch(() => ({ docs: [] })),
    fs.getDocs(fs.collection(db, "financial_transactions")).catch(() => ({ docs: [] }))
  ]);

  const rs = reqsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const trans = financeSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const currentYearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthTransactions = trans.filter((t) => (t.dataRecebimento || "").startsWith(currentYearMonth));
  const monthTotal = monthTransactions.reduce((acc, t) => acc + (t.estornado ? 0 : Number(t.valor) || 0), 0);
  const completedCount = rs.filter((r) => r.atendimentoConcluido).length;

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Resumo Operacional</p>
        <h2>Visão Geral do Estúdio</h2>
      </div>
      <div class="admin-row">
        <button class="btn gold" id="btn-quick-album">＋ Criar Novo Álbum</button>
        <button class="btn ghost" id="btn-quick-reqs">Ver Solicitações</button>
      </div>
    </div>

    <div class="admin-cards">
      <div class="admin-stat">
        <b class="highlight">${formatCurrency(monthTotal)}</b>
        <span>Receita Líquida deste Mês</span>
      </div>
      <div class="admin-stat">
        <b>${completedCount}</b>
        <span>Atendimentos Concluídos</span>
      </div>
      <div class="admin-stat">
        <b>${pub}</b>
        <span>Álbuns Publicados (${drafts} rascunhos)</span>
      </div>
      <div class="admin-stat">
        <b>${photos}</b>
        <span>Fotografias no Portfólio</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,0.8fr);gap:1.5rem;margin-top:2rem">
      <div class="admin-table-wrap" style="margin-top:0">
        <div style="padding:1.2rem 1.4rem;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">
          <h4 style="margin:0;font-size:1.1rem">Últimas Solicitações de Orçamento</h4>
          <a class="btn small ghost" href="#" id="view-all-reqs">Ver todas</a>
        </div>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Data do Evento</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rs.slice(0, 5).map((r) => `
              <tr>
                <td><strong>${esc(r.name)}</strong><br><span class="muted" style="font-size:.78rem">${esc(r.phone)}</span></td>
                <td>${esc(r.service)}</td>
                <td>${esc(formatDate(r.eventDate))}${r.eventTime ? `<br><span class="muted" style="font-size:.75rem">⏰ ${esc(formatTime(r.eventTime))}</span>` : ""}</td>
                <td>
                  <span class="status-pill ${r.status === 'atendimento' ? 'atendimento' : r.status === 'cancelado' ? 'cancelado' : 'novo'}">
                    ${STATUS[r.status] || r.status}
                  </span>
                  ${r.atendimentoConcluido ? `<br><span class="status-pill concluido" style="font-size:.65rem;margin-top:.2rem">✓ Concluído</span>` : ""}
                </td>
                <td>
                  <a class="btn small ghost" target="_blank" rel="noopener noreferrer" href="https://wa.me/${normalizeBR(r.phone)}">WhatsApp</a>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="muted" style="text-align:center;padding:2.5rem">Nenhuma solicitação recente.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);padding:1.4rem;box-shadow:var(--shadow-sm)">
        <h4 style="margin-bottom:1rem;font-size:1.1rem">Ações Rápidas</h4>
        <div style="display:flex;flex-direction:column;gap:.75rem">
          <button class="btn ghost" id="quick-schedule-btn" style="justify-content:flex-start">📅 Conferir Agendamentos</button>
          <button class="btn ghost" id="quick-finance-btn" style="justify-content:flex-start">💰 Acessar Painel Financeiro</button>
          <button class="btn ghost" id="quick-content-btn" style="justify-content:flex-start">🖼️ Atualizar Foto Principal do Site</button>
        </div>
      </div>
    </div>
  `;

  $("#btn-quick-album").onclick = () => { view = "albums"; editing = "new"; render(); };
  $("#btn-quick-reqs").onclick = () => { view = "requests"; render(); };
  $("#view-all-reqs")?.addEventListener("click", (e) => { e.preventDefault(); view = "requests"; render(); });
  $("#quick-schedule-btn").onclick = () => { view = "schedules"; render(); };
  $("#quick-finance-btn").onclick = () => { view = "finance"; render(); };
  $("#quick-content-btn").onclick = () => { view = "content"; render(); };
}

/* ==========================================================================
   2. ÁLBUNS & GERENCIADOR DE CAPAS E FOTOS
   ========================================================================== */
async function albums(v) {
  if (editing) return editor(v);

  let snap;
  try {
    snap = await fs.getDocs(fs.query(fs.collection(db, "albums"), fs.orderBy("order", "asc")));
  } catch {
    snap = await fs.getDocs(fs.collection(db, "albums"));
  }

  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Gerenciador de Portfólio</p>
        <h2>Álbuns Publicados e Rascunhos</h2>
      </div>
      <button class="btn gold" id="new-album-btn">＋ Criar Novo Álbum</button>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width:70px">Capa</th>
            <th>Título do Álbum</th>
            <th>Categoria</th>
            <th>Status</th>
            <th>Fotos</th>
            <th style="text-align:right">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((a, i) => `
            <tr>
              <td>
                <div style="width:48px;height:48px;border-radius:3px;overflow:hidden;background:var(--surface-subtle);border:1px solid var(--line)">
                  ${(a.coverThumb || a.coverUrl) ? `<img src="${esc(a.coverThumb || a.coverUrl)}" style="width:100%;height:100%;object-fit:cover" alt="">` : `<div style="display:grid;place-items:center;height:100%;font-size:.7rem;color:var(--text-dim)">S/ capa</div>`}
                </div>
              </td>
              <td>
                <strong>${esc(a.title)}</strong>
                ${a.featured ? `<span style="color:var(--gold);margin-left:.4rem;font-size:.8rem;font-weight:600" title="Destaque na Home">★ Destaque</span>` : ""}
                <br><span class="muted" style="font-size:.78rem">${esc([a.year, a.location].filter(Boolean).join(" · "))}</span>
              </td>
              <td>${esc(a.category || "—")}</td>
              <td>
                <span class="status-pill ${a.status === "published" ? "published" : "draft"}">
                  ${a.status === "published" ? "Publicado" : "Rascunho"}
                </span>
              </td>
              <td>${a.photoCount || 0} fotos</td>
              <td>
                <div class="admin-row" style="justify-content:flex-end">
                  ${a.status === "published" ? `<a class="btn small ghost" href="../album.html?id=${encodeURIComponent(a.id)}" target="_blank" title="Ver álbum público">Visualizar ↗</a>` : ""}
                  <button class="btn small ghost" data-a="up" data-i="${i}" title="Subir na listagem" ${i === 0 ? "disabled" : ""}>↑</button>
                  <button class="btn small ghost" data-a="dn" data-i="${i}" title="Descer na listagem" ${i === list.length - 1 ? "disabled" : ""}>↓</button>
                  <button class="btn small" data-a="ed" data-i="${i}">Editar &amp; Capa</button>
                  <button class="btn small ghost" data-a="pub" data-i="${i}">${a.status === "published" ? "Despublicar" : "Publicar"}</button>
                  <button class="btn small ghost" data-a="del" data-i="${i}" style="color:var(--danger)">Excluir</button>
                </div>
              </td>
            </tr>
          `).join("") || `<tr><td colspan="6" class="muted" style="text-align:center;padding:3rem">Nenhum álbum criado. Clique em "Criar Novo Álbum".</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  $("#new-album-btn").onclick = () => { editing = "new"; render(); };

  v.onclick = async (e) => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const i = Number(b.dataset.i);
    const a = list[i];

    if (b.dataset.a === "ed") {
      editing = a.id;
      render();
    }

    if (b.dataset.a === "pub") {
      const nextStatus = a.status === "published" ? "draft" : "published";
      await fs.updateDoc(fs.doc(db, "albums", a.id), {
        status: nextStatus,
        updatedAt: fs.serverTimestamp()
      });
      toast(`Álbum ${nextStatus === "published" ? "publicado com sucesso!" : "alterado para rascunho."}`);
      render();
    }

    if (b.dataset.a === "up" || b.dataset.a === "dn") {
      const targetIndex = i + (b.dataset.a === "up" ? -1 : 1);
      const o = list[targetIndex];
      const batch = fs.writeBatch(db);
      batch.update(fs.doc(db, "albums", a.id), { order: o.order });
      batch.update(fs.doc(db, "albums", o.id), { order: a.order });
      await batch.commit();
      render();
    }

    if (b.dataset.a === "del") {
      if (confirm(`Tem certeza que deseja excluir o álbum "${a.title}" e todas as suas fotografias? Esta ação não pode ser desfeita.`)) {
        try {
          await deleteAlbum(a.id);
          toast("Álbum excluído com sucesso.");
        } catch (er) {
          toast("Falha ao excluir álbum: " + (er.code || er.message), true);
        }
        render();
      }
    }
  };
}

async function deleteAlbum(id) {
  const ps = await fs.getDocs(fs.collection(db, "albums", id, "photos"));
  for (const p of ps.docs) {
    const d = p.data();
    await Promise.all([d.path, d.thumbPath].filter(Boolean).map((x) => st.deleteObject(st.ref(storage, x)).catch(() => {})));
    await fs.deleteDoc(p.ref);
  }
  await fs.deleteDoc(fs.doc(db, "albums", id));
}

/* ==========================================================================
   3. CADASTRO E EDIÇÃO DE ÁLBUM COM GESTÃO DE CAPA (REQUISITO 2)
   ========================================================================== */
async function editor(v) {
  let a = {
    title: "",
    category: settings.categories[0] || "Casamentos",
    description: "",
    year: new Date().getFullYear().toString(),
    location: "",
    status: "published",
    featured: true,
    coverUrl: "",
    coverThumb: ""
  };

  if (editing !== "new") {
    const snap = await fs.getDoc(fs.doc(db, "albums", editing));
    if (snap.exists()) a = { ...a, ...snap.data() };
  }

  // Estado local para a capa
  let selectedCoverFile = null;
  let coverPreviewUrl = a.coverThumb || a.coverUrl || "";

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Editor de Álbum</p>
        <h2>${editing === "new" ? "Criar Novo Álbum" : `Editar Álbum: ${esc(a.title)}`}</h2>
      </div>
      <div class="admin-row">
        <button class="btn ghost small" id="back-btn">← Voltar à lista de álbuns</button>
        ${editing !== "new" && a.status === "published" ? `<a class="btn small ghost" href="../album.html?id=${encodeURIComponent(editing)}" target="_blank">Visualizar página pública ↗</a>` : ""}
      </div>
    </div>

    <!-- Gestão de Capa do Álbum (Requisito 2) -->
    <div class="album-cover-manager">
      <h3 style="font-size:1.3rem;margin-bottom:1rem">Fotografia de Capa do Álbum</h3>
      <div class="cover-preview-box">
        <div class="cover-preview-img" id="cover-preview-container">
          ${coverPreviewUrl ? `<img src="${esc(coverPreviewUrl)}" id="cover-img-preview" alt="Capa atual">` : `<div class="cover-preview-placeholder">Nenhuma capa definida</div>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:.75rem;max-width:400px">
          <p class="muted" style="font-size:.85rem;margin:0">A capa é a imagem principal que representa este álbum no portfólio. Você pode selecionar um arquivo do computador ou escolher uma foto já enviada.</p>
          <div class="admin-row">
            <label class="btn small" style="cursor:pointer">
              Selecionar imagem do computador
              <input type="file" id="cover-file-input" accept="image/jpeg,image/png,image/webp" style="display:none">
            </label>
            ${editing !== "new" ? `<button type="button" class="btn small ghost" id="choose-cover-from-album-btn">Escolher das fotos do álbum</button>` : ""}
            <button type="button" class="btn small ghost" id="remove-cover-btn" style="color:var(--danger)">Remover capa</button>
          </div>
          <span id="cover-file-name" class="muted" style="font-size:.78rem"></span>
        </div>
      </div>
    </div>

    <!-- Formulário de dados do álbum -->
    <div style="background:var(--surface);border:1px solid var(--line);padding:clamp(1.5rem,4vw,2.5rem);border-radius:var(--radius-sm);margin-bottom:2rem;box-shadow:var(--shadow-sm)">
      <form id="album-form" class="form">
        <div class="modal-grid-2">
          <label>Título do Álbum *<input name="title" required maxlength="120" value="${esc(a.title)}" placeholder="Ex.: Fernanda & Tiago — Casamento em Palmas"></label>
          <label>Categoria *
            <select name="category">
              ${settings.categories.map((c) => `<option ${c === a.category ? "selected" : ""}>${esc(c)}</option>`).join("")}
            </select>
          </label>
        </div>

        <div class="modal-grid-2">
          <label>Ano ou data do evento<input name="year" maxlength="30" value="${esc(a.year)}" placeholder="Ex.: 2026"></label>
          <label>Localização (opcional)<input name="location" maxlength="120" value="${esc(a.location)}" placeholder="Ex.: Palmas - TO"></label>
        </div>

        <label>Descrição ou narrativa do ensaio (opcional)<textarea name="description" maxlength="1500" placeholder="Conte brevemente sobre o estilo, a cerimônia e a atmosfera...">${esc(a.description)}</textarea></label>

        <div class="modal-grid-2" style="align-items:center">
          <label>Status de Publicação
            <select name="status">
              <option value="published" ${a.status === "published" ? "selected" : ""}>Publicado (Visível no site e portfólio)</option>
              <option value="draft" ${a.status === "draft" ? "selected" : ""}>Rascunho (Oculto aos visitantes)</option>
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:.7rem;margin-top:1.5rem;cursor:pointer">
            <input type="checkbox" name="featured" style="width:auto" ${a.featured ? "checked" : ""}>
            <span>Destacar este álbum na página inicial</span>
          </label>
        </div>

        <div style="margin-top:1rem">
          <button class="btn gold" type="submit" id="save-album-btn">${editing === "new" ? "Salvar Álbum e Adicionar Fotografias" : "Salvar Alterações do Álbum"}</button>
        </div>
      </form>
    </div>

    <!-- Gerenciador de Fotos do Álbum -->
    <div id="photos-section"></div>
    <div id="cover-modal-target"></div>
  `;

  $("#back-btn").onclick = () => { editing = null; render(); };

  // Escolha de capa do computador com pré-visualização instantânea
  $("#cover-file-input").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      toast("Formato inválido. Use JPG, PNG ou WebP.", true);
      return;
    }
    selectedCoverFile = file;
    coverPreviewUrl = URL.createObjectURL(file);
    $("#cover-preview-container").innerHTML = `<img src="${coverPreviewUrl}" alt="Prévia da nova capa">`;
    $("#cover-file-name").textContent = `Arquivo selecionado: ${file.name}`;
    toast("Prévia da capa carregada. Salve o álbum para confirmar.");
  };

  // Remoção da capa
  $("#remove-cover-btn").onclick = () => {
    selectedCoverFile = null;
    a.coverUrl = "";
    a.coverThumb = "";
    coverPreviewUrl = "";
    $("#cover-preview-container").innerHTML = `<div class="cover-preview-placeholder">Nenhuma capa definida</div>`;
    $("#cover-file-name").textContent = "Capa removida. Salve para confirmar.";
  };

  // Escolher capa a partir de foto já existente no álbum
  $("#choose-cover-from-album-btn")?.addEventListener("click", async () => {
    const photosSnap = await fs.getDocs(fs.collection(db, "albums", editing, "photos"));
    const pList = photosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!pList.length) {
      toast("Este álbum ainda não possui fotos. Envie fotos abaixo primeiro.", true);
      return;
    }

    const modalTarget = $("#cover-modal-target");
    modalTarget.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem">
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);max-width:760px;width:100%;max-height:85vh;overflow-y:auto;padding:1.8rem;box-shadow:var(--shadow-lg)">
          <div class="admin-header-row" style="margin-bottom:1.2rem">
            <h3 style="font-size:1.3rem">Selecione uma fotografia para ser a capa</h3>
            <button class="btn small ghost" id="close-cover-modal">×</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:.8rem">
            ${pList.map((p) => `
              <div style="cursor:pointer;border:2px solid ${p.url === a.coverUrl ? "var(--gold)" : "var(--line)"};border-radius:2px;overflow:hidden;aspect-ratio:4/5;position:relative" class="cover-option" data-url="${esc(p.url)}" data-thumb="${esc(p.thumbUrl || p.url)}">
                <img src="${esc(p.thumbUrl || p.url)}" style="width:100%;height:100%;object-fit:cover" alt="">
                ${p.url === a.coverUrl ? `<span class="cover-badge">Atual</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;

    $("#close-cover-modal").onclick = () => { modalTarget.innerHTML = ""; };

    $$(".cover-option", modalTarget).forEach((el) => {
      el.onclick = async () => {
        const u = el.dataset.url;
        const th = el.dataset.thumb;
        a.coverUrl = u;
        a.coverThumb = th;
        coverPreviewUrl = th || u;
        selectedCoverFile = null;
        $("#cover-preview-container").innerHTML = `<img src="${coverPreviewUrl}" alt="Capa selecionada">`;
        modalTarget.innerHTML = "";
        await fs.updateDoc(fs.doc(db, "albums", editing), { coverUrl: u, coverThumb: th });
        toast("Capa definida com sucesso a partir das fotos do álbum!");
      };
    });
  });

  // Salvamento do álbum
  $("#album-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#save-album-btn");
    btn.disabled = true;
    btn.textContent = "Salvando dados e capa…";

    const f = e.target;
    let coverUrl = a.coverUrl || "";
    let coverThumb = a.coverThumb || "";

    try {
      // Se uma nova capa foi selecionada do computador, faz upload antes de salvar
      if (selectedCoverFile) {
        toast("Enviando imagem de capa para o armazenamento…");
        const bmp = await createImageBitmap(selectedCoverFile);
        const pid = crypto.randomUUID();
        const big = await toBlob(bmp, 2000, 0.88);
        const th = await toBlob(bmp, 700, 0.82);

        const tempId = editing === "new" ? "temp_" + Date.now() : editing;
        const [upBig, upTh] = await Promise.all([
          uploadToStorage(`albums/${tempId}/cover_${pid}.${big.ext}`, big.b),
          uploadToStorage(`albums/${tempId}/cover_${pid}_t.${th.ext}`, th.b)
        ]);
        coverUrl = upBig.url;
        coverThumb = upTh.url;
      }

      const albumData = {
        title: f.title.value.trim(),
        category: f.category.value,
        year: f.year.value.trim(),
        location: f.location.value.trim(),
        description: f.description.value.trim(),
        status: f.status.value,
        featured: f.featured.checked,
        coverUrl,
        coverThumb,
        updatedAt: fs.serverTimestamp()
      };

      if (editing === "new") {
        const ref = await fs.addDoc(fs.collection(db, "albums"), {
          ...albumData,
          order: Date.now(),
          photoCount: 0,
          createdAt: fs.serverTimestamp()
        });
        editing = ref.id;
        toast("Álbum criado com sucesso! Agora envie as fotografias.");
        render();
      } else {
        await fs.updateDoc(fs.doc(db, "albums", editing), albumData);
        toast("Álbum e capa atualizados com sucesso.");
        btn.disabled = false;
        btn.textContent = "Salvar Alterações do Álbum";
      }
    } catch (er) {
      console.error(er);
      toast("Não foi possível salvar: " + (er.message || er.code), true);
      btn.disabled = false;
      btn.textContent = "Salvar Alterações do Álbum";
    }
  };

  if (editing !== "new") {
    photosUI(editing);
  } else {
    $("#photos-section").innerHTML = `
      <div class="notice">
        <p>Preencha os dados e a capa acima e clique em <strong>Salvar Álbum e Adicionar Fotografias</strong> para liberar o envio das fotos internas.</p>
      </div>
    `;
  }
}

async function photosUI(albumId) {
  const container = $("#photos-section");
  const col = fs.collection(db, "albums", albumId, "photos");

  let photosSnap;
  try {
    photosSnap = await fs.getDocs(fs.query(col, fs.orderBy("order", "asc")));
  } catch {
    photosSnap = await fs.getDocs(col);
  }

  let photos = photosSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  let pending = [];
  const albumDocSnap = await fs.getDoc(fs.doc(db, "albums", albumId));
  const currentAlbum = albumDocSnap.data() || {};

  const draw = () => {
    container.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--line);padding:clamp(1.5rem,4vw,2.5rem);border-radius:var(--radius-sm);box-shadow:var(--shadow-sm)">
        <div class="admin-header-row" style="margin-bottom:1.5rem">
          <div>
            <h3 style="font-size:1.6rem">Fotografias do Álbum (${photos.length})</h3>
            <p class="muted" style="margin:0;font-size:.88rem">Adicione fotografias JPG, PNG ou WebP. As imagens são otimizadas e entregues em alta qualidade.</p>
          </div>
        </div>

        <!-- Área de seleção de arquivos -->
        <label class="admin-dropzone" for="photo-file-input">
          <p style="font-family:var(--serif);font-size:1.6rem;color:var(--text);margin-bottom:.4rem">Clique para selecionar fotografias do computador</p>
          <p class="muted" style="font-size:.82rem;margin:0">Envie até ${MAX_FILES} imagens por vez (máx. 35 MB cada)</p>
          <input type="file" id="photo-file-input" accept="image/jpeg,image/png,image/webp" multiple style="display:none">
        </label>

        <!-- Fila de envio pendente -->
        <div id="pending-box"></div>
        ${pending.length ? `
          <div style="margin-top:1.5rem;text-align:center">
            <button class="btn gold" id="upload-all-btn">Confirmar e Enviar ${pending.length} fotografia(s)</button>
          </div>
        ` : ""}

        <!-- Galeria atual com ações de capa, reordenação e exclusão -->
        <h4 style="margin-top:3rem;font-size:1.2rem;border-bottom:1px solid var(--line);padding-bottom:.8rem;color:var(--text)">
          Fotografias Ativas (${photos.length})
        </h4>

        ${photos.length ? `
          <div class="admin-photos-grid" id="existing-photos">
            ${photos.map((p, i) => {
              const isCover = currentAlbum.coverUrl === p.url || (!currentAlbum.coverUrl && i === 0);
              return `
                <div class="admin-photo-card ${isCover ? "is-cover" : ""}" data-id="${p.id}">
                  ${isCover ? `<span class="cover-badge">★ Capa do Álbum</span>` : ""}
                  <div class="admin-photo-thumb">
                    <img src="${esc(p.thumbUrl || p.url)}" alt="${esc(p.alt || "")}" loading="lazy">
                  </div>
                  <input data-f="title" data-i="${i}" placeholder="Título (opcional)" value="${esc(p.title || "")}" style="font-size:.8rem;padding:.45rem">
                  <input data-f="alt" data-i="${i}" placeholder="Texto alt" value="${esc(p.alt || "")}" style="font-size:.8rem;padding:.45rem">
                  <div class="admin-row" style="justify-content:space-between">
                    <div class="admin-row">
                      <button class="btn small ghost" data-p="up" data-i="${i}" title="Mover para esquerda" ${i === 0 ? "disabled" : ""}>←</button>
                      <button class="btn small ghost" data-p="dn" data-i="${i}" title="Mover para direita" ${i === photos.length - 1 ? "disabled" : ""}>→</button>
                    </div>
                    <button class="btn small ghost" data-p="del" data-i="${i}" style="color:var(--danger)">Remover</button>
                  </div>
                  <div style="margin-top:.3rem">
                    <button class="btn small ${isCover ? "ghost" : "gold-ghost"}" data-p="cover" data-i="${i}" style="width:100%">
                      ${isCover ? "✓ Capa Atual" : "Definir como Capa"}
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        ` : `
          <p class="muted" style="padding:2.5rem 0;text-align:center">Nenhuma fotografia enviada para este álbum ainda.</p>
        `}
      </div>
    `;

    $("#photo-file-input").onchange = (e) => {
      const files = [...e.target.files].slice(0, MAX_FILES);
      const invalid = [];
      for (const f of files) {
        if (!TYPES.includes(f.type)) invalid.push(`${f.name}: Formato não suportado`);
        else if (f.size > MAX_BYTES) invalid.push(`${f.name}: Excede o limite de 35 MB`);
        else pending.push({ f, url: URL.createObjectURL(f), title: "", alt: "" });
      }
      if (invalid.length) toast(invalid.join(" | "), true);
      draw();
    };

    const pBox = $("#pending-box");
    if (pending.length && pBox) {
      pBox.innerHTML = `
        <h4 style="margin-top:2rem;font-size:1.1rem;color:var(--gold)">Fotos Selecionadas para Upload (${pending.length})</h4>
        <div class="admin-photos-grid">
          ${pending.map((p, i) => `
            <div class="admin-photo-card">
              <div class="admin-photo-thumb">
                <img src="${p.url}" alt="Pré-visualização">
              </div>
              <input data-q="title" data-i="${i}" placeholder="Título (opcional)" value="${esc(p.title)}" style="font-size:.8rem;padding:.45rem">
              <input data-q="alt" data-i="${i}" placeholder="Texto alt" value="${esc(p.alt)}" style="font-size:.8rem;padding:.45rem">
              <progress value="0" max="1" id="pg${i}" style="width:100%"></progress>
              <button class="btn small ghost" data-q="rm" data-i="${i}" style="color:var(--danger)">Cancelar</button>
            </div>
          `).join("")}
        </div>
      `;

      pBox.oninput = (e) => {
        const t = e.target;
        if (t.dataset.q) pending[Number(t.dataset.i)][t.dataset.q] = t.value;
      };

      pBox.onclick = (e) => {
        const b = e.target.closest("[data-q=rm]");
        if (b) {
          pending.splice(Number(b.dataset.i), 1);
          draw();
        }
      };

      $("#upload-all-btn")?.addEventListener("click", sendUploads);
    }

    const curBox = $("#existing-photos");
    if (curBox) {
      curBox.onchange = async (e) => {
        const t = e.target;
        if (!t.dataset.f) return;
        const p = photos[Number(t.dataset.i)];
        p[t.dataset.f] = t.value.trim();
        await fs.updateDoc(fs.doc(col, p.id), { [t.dataset.f]: p[t.dataset.f] });
        toast("Salvo.");
      };
      curBox.onclick = (e) => handlePhotoActions(e);
    }
  };

  async function sendUploads() {
    const btn = $("#upload-all-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processando e enviando imagens…";
    }

    let ok = 0;
    const baseOrder = photos.length ? Math.max(...photos.map((p) => Number(p.order) || 0)) : 0;

    for (const [i, p] of pending.entries()) {
      try {
        const bmp = await createImageBitmap(p.f);
        const pid = crypto.randomUUID();
        const big = await toBlob(bmp, 2400, 0.88);
        const th = await toBlob(bmp, 750, 0.82);

        const path = `albums/${albumId}/${pid}.${big.ext}`;
        const tpath = `albums/${albumId}/${pid}_t.${th.ext}`;
        const pr = $(`#pg${i}`);

        // Upload inteligente e resiliente
        const [upBig, upTh] = await Promise.all([
          uploadToStorage(path, big.b, (x) => { if (pr) pr.value = x * 0.85; }),
          uploadToStorage(tpath, th.b, () => {})
        ]);

        if (pr) pr.value = 1;

        await fs.addDoc(col, {
          url: upBig.url,
          thumbUrl: upTh.url,
          path,
          thumbPath: tpath,
          width: big.w,
          height: big.h,
          title: p.title.trim(),
          alt: p.alt.trim(),
          order: baseOrder + i + 1,
          createdAt: fs.serverTimestamp()
        });

        ok++;
      } catch (er) {
        console.error("Falha no upload de foto:", er);
        toast(`Falha em ${p.f.name}: ${er.message || er.code}`, true);
      }
    }

    const updatedSnap = await fs.getDocs(fs.query(col, fs.orderBy("order", "asc")));
    photos = updatedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const albumUpdates = { photoCount: photos.length };
    if (!currentAlbum.coverUrl && photos.length) {
      albumUpdates.coverUrl = photos[0].url;
      albumUpdates.coverThumb = photos[0].thumbUrl || photos[0].url;
    }
    await fs.updateDoc(fs.doc(db, "albums", albumId), albumUpdates);

    pending = [];
    draw();
    toast(`${ok} fotografia(s) enviada(s) com sucesso.`);
  }

  async function handlePhotoActions(e) {
    const b = e.target.closest("[data-p]");
    if (!b) return;
    const i = Number(b.dataset.i);
    const p = photos[i];
    const action = b.dataset.p;

    try {
      if (action === "up" || action === "dn") {
        const targetI = i + (action === "up" ? -1 : 1);
        const o = photos[targetI];
        const batch = fs.writeBatch(db);
        batch.update(fs.doc(col, p.id), { order: o.order });
        batch.update(fs.doc(col, o.id), { order: p.order });
        await batch.commit();

        [p.order, o.order] = [o.order, p.order];
        photos.sort((x, y) => (Number(x.order) || 0) - (Number(y.order) || 0));
        draw();
      }

      if (action === "del") {
        if (confirm("Remover esta fotografia do álbum?")) {
          await Promise.all([p.path, p.thumbPath].filter(Boolean).map((x) => st.deleteObject(st.ref(storage, x)).catch(() => {})));
          await fs.deleteDoc(fs.doc(col, p.id));
          photos.splice(i, 1);
          await fs.updateDoc(fs.doc(db, "albums", albumId), { photoCount: photos.length });
          toast("Fotografia removida.");
          draw();
        }
      }

      if (action === "cover") {
        await fs.updateDoc(fs.doc(db, "albums", albumId), {
          coverUrl: p.url,
          coverThumb: p.thumbUrl || p.url
        });
        currentAlbum.coverUrl = p.url;
        currentAlbum.coverThumb = p.thumbUrl || p.url;
        toast("Fotografia definida como capa do álbum!");
        draw();
      }
    } catch (er) {
      toast("Erro: " + (er.message || er.code), true);
    }
  }

  draw();
}

/* ==========================================================================
   4. GESTÃO DE SOLICITAÇÕES (REQUISITO 4) — 3 STATUS ESTRITOS
   ========================================================================== */
async function requestsView(v) {
  const snap = await fs.getDocs(fs.query(fs.collection(db, "requests"), fs.orderBy("createdAt", "desc"), fs.limit(300)));
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Atendimento a Clientes</p>
        <h2>Solicitações de Orçamento</h2>
      </div>
      <button class="btn ghost small" id="run-retention-btn" style="color:var(--warning);border-color:var(--warning)">
        Limpeza de Encerradas (>60 dias)
      </button>
    </div>

    <!-- Filtros por status e serviço -->
    <div class="admin-row" style="margin-bottom:1.5rem;background:var(--surface);padding:1rem 1.25rem;border:1px solid var(--line);border-radius:var(--radius-sm);box-shadow:var(--shadow-sm)">
      <label style="font-size:.78rem">Filtrar por Status
        <select id="req-filter-status" style="padding:.5rem;font-size:.82rem">
          <option value="">Todos os status</option>
          <option value="novo">Novo</option>
          <option value="atendimento">Em atendimento</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </label>
      <label style="font-size:.78rem">Serviço
        <select id="req-filter-service" style="padding:.5rem;font-size:.82rem">
          <option value="">Todos os serviços</option>
          ${SERVICES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}
        </select>
      </label>
      <label style="font-size:.78rem">Situação do Atendimento
        <select id="req-filter-concluido" style="padding:.5rem;font-size:.82rem">
          <option value="">Todos</option>
          <option value="aberto">Em andamento</option>
          <option value="concluido">Concluído / Pago</option>
        </select>
      </label>
    </div>

    <div class="admin-table-wrap">
      <div id="requests-table-body"></div>
    </div>

    <!-- Modal de Encerramento com Pagamento -->
    <div id="completion-modal-container"></div>
  `;

  const draw = () => {
    const fStatus = $("#req-filter-status").value;
    const fService = $("#req-filter-service").value;
    const fConc = $("#req-filter-concluido").value;

    const rows = all.filter((r) => {
      const normalizedStatus = (r.status === "nova" ? "novo" : r.status) || "novo";
      if (fStatus && normalizedStatus !== fStatus) return false;
      if (fService && r.service !== fService) return false;
      if (fConc === "aberto" && r.atendimentoConcluido) return false;
      if (fConc === "concluido" && !r.atendimentoConcluido) return false;
      return true;
    });

    $("#requests-table-body").innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Cliente &amp; Contato</th>
            <th>Serviço Pretendido</th>
            <th>Data &amp; Horário Desejados</th>
            <th>Status / Conclusão</th>
            <th>Mensagem / Observações</th>
            <th style="text-align:right">Ações de Atendimento</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const normalizedStatus = (r.status === "nova" ? "novo" : r.status) || "novo";
            return `
              <tr>
                <td>
                  <strong>${esc(r.name)}</strong><br>
                  <span class="muted">${esc(r.phone)}</span>
                  ${r.email ? `<br><span class="muted" style="font-size:.78rem">${esc(r.email)}</span>` : ""}
                </td>
                <td>
                  <strong>${esc(r.service)}</strong>
                  ${r.location ? `<br><span class="muted" style="font-size:.78rem">📍 ${esc(r.location)}</span>` : ""}
                </td>
                <td>
                  <strong>${esc(formatDate(r.eventDate))}</strong><br>
                  <span class="muted" style="font-size:.8rem">⏰ ${esc(formatTime(r.eventTime))}</span>
                </td>
                <td>
                  <span class="status-pill ${normalizedStatus}">
                    ${STATUS[normalizedStatus] || normalizedStatus}
                  </span>
                  ${r.atendimentoConcluido ? `
                    <div style="margin-top:.4rem">
                      <span class="status-pill concluido" title="Pagamento: ${esc(r.financeiro?.formaPagamento || '')}">
                        ✓ Concluído (${formatCurrency(r.financeiro?.valor || 0)})
                      </span>
                    </div>
                  ` : ""}
                </td>
                <td style="max-width:240px;font-size:.82rem;line-height:1.5">
                  ${esc(r.notes || "—")}
                </td>
                <td>
                  <div class="admin-row" style="justify-content:flex-end">
                    <a class="btn small" target="_blank" rel="noopener noreferrer" href="https://wa.me/${normalizeBR(r.phone)}">WhatsApp</a>
                    
                    ${normalizedStatus === "novo" ? `
                      <button class="btn small gold-ghost" data-action="start" data-id="${r.id}">Iniciar atendimento</button>
                    ` : ""}

                    ${normalizedStatus === "atendimento" && !r.atendimentoConcluido ? `
                      <button class="btn small gold" data-action="complete" data-id="${r.id}">Encerrar atendimento</button>
                    ` : ""}

                    ${r.atendimentoConcluido ? `
                      <button class="btn small ghost" data-action="reopen" data-id="${r.id}">Reabrir atendimento</button>
                    ` : ""}

                    ${normalizedStatus !== "cancelado" ? `
                      <button class="btn small ghost" data-action="cancel" data-id="${r.id}" style="color:var(--danger)">Cancelar</button>
                    ` : ""}
                  </div>
                </td>
              </tr>
            `;
          }).join("") || `<tr><td colspan="6" class="muted" style="text-align:center;padding:3rem">Nenhuma solicitação encontrada com os filtros selecionados.</td></tr>`}
        </tbody>
      </table>
    `;
  };

  draw();
  ["req-filter-status", "req-filter-service", "req-filter-concluido"].forEach((id) => {
    $("#" + id).onchange = draw;
  });

  // Ações de atendimento
  v.onclick = async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const req = all.find((r) => r.id === id);
    if (!req) return;

    // 1. Iniciar atendimento -> status: 'atendimento'
    if (action === "start") {
      await fs.updateDoc(fs.doc(db, "requests", id), {
        status: "atendimento",
        iniciadoEm: fs.serverTimestamp()
      });
      req.status = "atendimento";
      toast("Status alterado para 'Em atendimento'.");
      draw();
    }

    // 2. Encerrar atendimento -> Abre modal com campos de pagamento obrigatórios
    if (action === "complete") {
      openCompletionModal(req);
    }

    // 3. Reabrir atendimento -> Reabre sem duplicar receita
    if (action === "reopen") {
      if (confirm(`Reabrir o atendimento da solicitação de "${req.name}"? O histórico financeiro existente será preservado.`)) {
        await fs.updateDoc(fs.doc(db, "requests", id), {
          atendimentoConcluido: false,
          reabertoEm: fs.serverTimestamp()
        });
        req.atendimentoConcluido = false;
        toast("Atendimento reaberto. Você pode continuar os registros normalmente.");
        draw();
      }
    }

    // 4. Cancelar solicitação -> status: 'cancelado'
    if (action === "cancel") {
      if (confirm(`Deseja realmente cancelar a solicitação de "${req.name}"? Esta ação registrará o status como Cancelado e não contabilizará receita.`)) {
        await fs.updateDoc(fs.doc(db, "requests", id), {
          status: "cancelado",
          canceladoEm: fs.serverTimestamp()
        });
        req.status = "cancelado";
        toast("Solicitação cancelada.");
        draw();
      }
    }
  };

  function openCompletionModal(req) {
    const container = $("#completion-modal-container");
    container.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem">
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);max-width:540px;width:100%;padding:2rem;box-shadow:var(--shadow-lg)">
          <div class="admin-header-row" style="margin-bottom:1.2rem">
            <div>
              <p class="eyebrow" style="margin-bottom:.2rem">Encerramento de Atendimento</p>
              <h3 style="font-size:1.4rem">Confirmar Pagamento e Concluir</h3>
            </div>
            <button class="btn small ghost" id="close-complete-modal">×</button>
          </div>
          <form id="complete-req-form" class="form">
            <p style="font-size:.88rem;color:var(--text-muted)">Cliente: <strong>${esc(req.name)}</strong> (${esc(req.service)})</p>
            
            <label>Selecione a forma de pagamento utilizada pelo cliente *
              <select name="formaPagamento" required id="select-forma-pgto">
                <option value="">Selecione...</option>
                ${PAYMENT_METHODS.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}
              </select>
            </label>

            <div id="forma-outro-box" style="display:none">
              <label>Descrição da outra forma de pagamento *
                <input name="formaPagamentoOutro" placeholder="Ex.: Permuta, Cheque, etc.">
              </label>
            </div>

            <div class="modal-grid-2">
              <label>Valor efetivamente recebido (R$) *
                <input name="valor" required placeholder="Ex.: 3500,00" value="">
              </label>
              <label>Data do recebimento *
                <input name="dataRecebimento" type="date" required value="${new Date().toISOString().slice(0, 10)}">
              </label>
            </div>

            <label>Observações do encerramento (opcional)
              <textarea name="notasEncerramento" placeholder="Número do comprovante, parcelamento acordado, etc."></textarea>
            </label>

            <div class="notice" style="font-size:.8rem;padding:.8rem;margin-top:.4rem">
              O status permanecerá como <strong>Em atendimento</strong> com o indicativo destacado de <strong>Atendimento Concluído</strong>, e a receita será integrada ao painel Financeiro.
            </div>

            <div style="margin-top:1rem;display:flex;gap:.8rem">
              <button class="btn gold" type="submit" id="submit-completion-btn">Confirmar Encerramento e Salvar</button>
              <button class="btn ghost" type="button" id="cancel-complete-modal">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    $("#close-complete-modal").onclick = () => { container.innerHTML = ""; };
    $("#cancel-complete-modal").onclick = () => { container.innerHTML = ""; };

    const selectPgto = $("#select-forma-pgto");
    selectPgto.onchange = () => {
      $("#forma-outro-box").style.display = selectPgto.value === "Outra forma de pagamento" ? "block" : "none";
    };

    $("#complete-req-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const valorNum = parseCurrencyInput(f.valor.value);

      if (valorNum <= 0) {
        toast("Informe um valor recebido válido maior que zero.", true);
        return;
      }

      if (f.formaPagamento.value === "Outra forma de pagamento" && !f.formaPagamentoOutro.value.trim()) {
        toast("Descreva a outra forma de pagamento.", true);
        return;
      }

      const submitBtn = $("#submit-completion-btn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Registrando…";

      try {
        // 1. Registra no Firestore na coleção de transações financeiras
        const transRef = await fs.addDoc(fs.collection(db, "financial_transactions"), {
          requestId: req.id,
          clientName: req.name,
          service: req.service,
          valor: valorNum,
          formaPagamento: f.formaPagamento.value,
          formaPagamentoOutro: f.formaPagamentoOutro.value.trim(),
          dataRecebimento: f.dataRecebimento.value,
          notas: f.notasEncerramento.value.trim(),
          status: "recebido",
          estornado: false,
          createdAt: fs.serverTimestamp()
        });

        // 2. Atualiza a solicitação marcando o atendimento como concluído
        await fs.updateDoc(fs.doc(db, "requests", req.id), {
          atendimentoConcluido: true,
          encerradoEm: fs.serverTimestamp(),
          financeiro: {
            transacaoId: transRef.id,
            valor: valorNum,
            formaPagamento: f.formaPagamento.value,
            formaPagamentoOutro: f.formaPagamentoOutro.value.trim(),
            dataRecebimento: f.dataRecebimento.value
          }
        });

        req.atendimentoConcluido = true;
        req.financeiro = {
          transacaoId: transRef.id,
          valor: valorNum,
          formaPagamento: f.formaPagamento.value,
          dataRecebimento: f.dataRecebimento.value
        };

        toast("Atendimento encerrado e recebimento contabilizado no Financeiro!");
        container.innerHTML = "";
        draw();
      } catch (err) {
        toast("Erro ao registrar encerramento: " + (err.message || err.code), true);
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirmar Encerramento e Salvar";
      }
    };
  }

  // Limpeza de retenção manual
  $("#run-retention-btn").onclick = async () => {
    if (confirm("Executar limpeza de retenção? Apenas solicitações canceladas ou concluídas há mais de 60 dias serão removidas.")) {
      const cutoff = fs.Timestamp.fromMillis(Date.now() - 60 * 24 * 60 * 60 * 1000);
      try {
        const snapOld = await fs.getDocs(
          fs.query(
            fs.collection(db, "requests"),
            fs.where("status", "==", "cancelado"),
            fs.where("createdAt", "<", cutoff),
            fs.limit(500)
          )
        );

        if (snapOld.empty) {
          toast("Nenhuma solicitação cancelada com mais de 60 dias encontrada.");
          return;
        }

        const batch = fs.writeBatch(db);
        snapOld.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        toast(`${snapOld.size} solicitação(ões) antiga(s) cancelada(s) removida(s).`);
        render();
      } catch (err) {
        toast("Erro na limpeza: " + (err.message || err.code), true);
      }
    }
  };
}

/* ==========================================================================
   5. ABA FINANCEIRO FUNCIONAL (REQUISITO 5)
   ========================================================================== */
async function financeView(v) {
  const snap = await fs.getDocs(fs.query(fs.collection(db, "financial_transactions"), fs.orderBy("dataRecebimento", "desc")));
  const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const currentMonth = (now.getMonth() + 1).toString().padStart(2, "0");

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Controle de Receitas</p>
        <h2>Gestão Financeira do Estúdio</h2>
      </div>
      <div class="admin-row">
        <button class="btn gold" id="new-direct-revenue-btn">＋ Novo Recebimento Direto</button>
      </div>
    </div>

    <!-- Cards de Resumo Financeiro -->
    <div class="admin-cards" id="finance-metrics-cards"></div>

    <!-- Gráficos de Evolução e Formas de Pagamento -->
    <div class="finance-chart-container">
      <div class="chart-card">
        <h4 style="font-size:1.1rem;margin-bottom:1rem">Evolução Mensal das Receitas (${currentYear})</h4>
        <div class="chart-bars" id="finance-bars"></div>
      </div>
      <div class="chart-card">
        <h4 style="font-size:1.1rem;margin-bottom:1rem">Receitas por Forma de Pagamento</h4>
        <div id="finance-methods-breakdown" style="display:flex;flex-direction:column;gap:.75rem"></div>
      </div>
    </div>

    <!-- Filtros de Movimentações -->
    <div class="admin-row" style="margin-bottom:1.5rem;background:var(--surface);padding:1rem 1.25rem;border:1px solid var(--line);border-radius:var(--radius-sm);box-shadow:var(--shadow-sm)">
      <label style="font-size:.78rem">Ano
        <select id="fin-filter-year" style="padding:.5rem;font-size:.82rem">
          <option value="">Todos</option>
          <option value="2026" selected>2026</option>
          <option value="2025">2025</option>
        </select>
      </label>
      <label style="font-size:.78rem">Mês
        <select id="fin-filter-month" style="padding:.5rem;font-size:.82rem">
          <option value="">Todos os meses</option>
          ${[...Array(12).keys()].map((i) => {
            const m = (i + 1).toString().padStart(2, "0");
            const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            return `<option value="${m}" ${m === currentMonth ? "selected" : ""}>${names[i]}</option>`;
          }).join("")}
        </select>
      </label>
      <label style="font-size:.78rem">Forma de Pagamento
        <select id="fin-filter-method" style="padding:.5rem;font-size:.82rem">
          <option value="">Todas</option>
          ${PAYMENT_METHODS.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}
        </select>
      </label>
      <label style="font-size:.78rem">Buscar Cliente
        <input id="fin-filter-search" placeholder="Nome do cliente…" style="padding:.45rem;font-size:.82rem">
      </label>
    </div>

    <!-- Tabela de Movimentações Financeiras -->
    <div class="admin-table-wrap">
      <div id="finance-table-target"></div>
    </div>

    <div id="estorno-modal-container"></div>
  `;

  const recalculateAndDraw = () => {
    const fYear = $("#fin-filter-year").value;
    const fMonth = $("#fin-filter-month").value;
    const fMethod = $("#fin-filter-method").value;
    const fSearch = ($("#fin-filter-search").value || "").toLowerCase().trim();

    // 1. Métricas Totais
    const ymPrefix = fYear && fMonth ? `${fYear}-${fMonth}` : "";
    let monthTotal = 0;
    let yearTotal = 0;
    let paidCount = 0;
    let estornosTotal = 0;
    let netTotal = 0;

    const methodsSum = {};

    transactions.forEach((t) => {
      const date = t.dataRecebimento || "";
      const val = Number(t.valor) || 0;
      const isEstornado = Boolean(t.estornado);

      if (isEstornado) {
        estornosTotal += val;
      } else {
        netTotal += val;
        paidCount++;
        const method = t.formaPagamento || "Outro";
        methodsSum[method] = (methodsSum[method] || 0) + val;
      }

      if (date.startsWith(currentYear)) {
        yearTotal += isEstornado ? -val : val;
      }
      if (date.startsWith(ymPrefix || `${currentYear}-${currentMonth}`)) {
        monthTotal += isEstornado ? -val : val;
      }
    });

    $("#finance-metrics-cards").innerHTML = `
      <div class="admin-stat">
        <b class="highlight">${formatCurrency(monthTotal)}</b>
        <span>Recebido no Mês Selecionado</span>
      </div>
      <div class="admin-stat">
        <b>${formatCurrency(yearTotal)}</b>
        <span>Receita do Ano (${currentYear})</span>
      </div>
      <div class="admin-stat">
        <b>${formatCurrency(netTotal)}</b>
        <span>Total Líquido Acumulado</span>
      </div>
      <div class="admin-stat">
        <b>${paidCount}</b>
        <span>Atendimentos Pagos (${formatCurrency(estornosTotal)} em estornos)</span>
      </div>
    `;

    // 2. Gráfico mensal de barras
    const monthsData = [...Array(12).keys()].map((i) => {
      const mStr = `${currentYear}-${(i + 1).toString().padStart(2, "0")}`;
      const sum = transactions
        .filter((t) => (t.dataRecebimento || "").startsWith(mStr))
        .reduce((acc, t) => acc + (t.estornado ? -Number(t.valor) : Number(t.valor)), 0);
      return Math.max(0, sum);
    });

    const maxVal = Math.max(...monthsData, 1000);
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    $("#finance-bars").innerHTML = monthsData.map((val, i) => {
      const pct = Math.round((val / maxVal) * 100);
      return `
        <div class="chart-bar-col" title="${monthNames[i]}: ${formatCurrency(val)}">
          <div class="chart-bar-fill" style="height:${Math.max(4, pct)}%"></div>
          <span class="chart-bar-label">${monthNames[i]}</span>
        </div>
      `;
    }).join("");

    // 3. Quebra por Forma de Pagamento
    const totalPositivo = Object.values(methodsSum).reduce((a, b) => a + b, 0) || 1;
    $("#finance-methods-breakdown").innerHTML = Object.entries(methodsSum).map(([method, val]) => {
      const pct = Math.round((val / totalPositivo) * 100);
      return `
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:.2rem">
            <span><strong>${esc(method)}</strong></span>
            <span>${formatCurrency(val)} (${pct}%)</span>
          </div>
          <div style="background:var(--surface-subtle);height:6px;border-radius:3px;overflow:hidden">
            <div style="background:var(--gold);width:${pct}%;height:100%"></div>
          </div>
        </div>
      `;
    }).join("") || `<p class="muted" style="font-size:.85rem">Nenhum recebimento contabilizado ainda.</p>`;

    // 4. Tabela de Transações Filtradas
    const filteredRows = transactions.filter((t) => {
      const date = t.dataRecebimento || "";
      if (fYear && !date.startsWith(fYear)) return false;
      if (fMonth && date.slice(5, 7) !== fMonth) return false;
      if (fMethod && t.formaPagamento !== fMethod) return false;
      if (fSearch && !(t.clientName || "").toLowerCase().includes(fSearch)) return false;
      return true;
    });

    $("#finance-table-target").innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Data Recebimento</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Forma de Pagamento</th>
            <th>Valor Recebido</th>
            <th>Situação</th>
            <th style="text-align:right">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows.map((t) => `
            <tr>
              <td><strong>${esc(formatDate(t.dataRecebimento))}</strong></td>
              <td>${esc(t.clientName || "—")}</td>
              <td>${esc(t.service || "—")}</td>
              <td>
                ${esc(t.formaPagamento)}
                ${t.formaPagamentoOutro ? `<br><span class="muted" style="font-size:.75rem">${esc(t.formaPagamentoOutro)}</span>` : ""}
              </td>
              <td><strong>${formatCurrency(t.valor)}</strong></td>
              <td>
                <span class="status-pill ${t.estornado ? "cancelado" : "published"}">
                  ${t.estornado ? "Estornado" : "Recebido"}
                </span>
              </td>
              <td>
                <div class="admin-row" style="justify-content:flex-end">
                  ${!t.estornado ? `
                    <button class="btn small ghost" data-estorno-id="${t.id}" style="color:var(--danger)">Registrar Estorno</button>
                  ` : `
                    <span class="muted" style="font-size:.75rem">Motivo: ${esc(t.motivoEstorno || "—")}</span>
                  `}
                </div>
              </td>
            </tr>
          `).join("") || `<tr><td colspan="7" class="muted" style="text-align:center;padding:3rem">Nenhuma movimentação financeira encontrada com os filtros selecionados.</td></tr>`}
        </tbody>
      </table>
    `;
  };

  recalculateAndDraw();
  ["fin-filter-year", "fin-filter-month", "fin-filter-method", "fin-filter-search"].forEach((id) => {
    $("#" + id).oninput = recalculateAndDraw;
    $("#" + id).onchange = recalculateAndDraw;
  });

  // Modal de Estorno
  v.onclick = (e) => {
    const estBtn = e.target.closest("[data-estorno-id]");
    if (!estBtn) return;
    const tid = estBtn.dataset.estornoId;
    const trans = transactions.find((t) => t.id === tid);
    if (!trans) return;

    const modal = $("#estorno-modal-container");
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem">
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);max-width:500px;width:100%;padding:2rem;box-shadow:var(--shadow-lg)">
          <div class="admin-header-row" style="margin-bottom:1.2rem">
            <h3 style="font-size:1.3rem;color:var(--danger)">Confirmar Estorno Financeiro</h3>
            <button class="btn small ghost" id="close-estorno">×</button>
          </div>
          <form id="estorno-form" class="form">
            <p style="font-size:.88rem">Cliente: <strong>${esc(trans.clientName)}</strong> | Valor: <strong>${formatCurrency(trans.valor)}</strong></p>
            <label>Motivo do estorno / devolução *
              <textarea name="motivo" required placeholder="Ex.: Cancelamento a pedido do cliente com devolução do sinal..."></textarea>
            </label>
            <div style="margin-top:1rem;display:flex;gap:.8rem">
              <button class="btn" style="background:var(--danger);border-color:var(--danger);color:#fff" type="submit">Confirmar Estorno</button>
              <button class="btn ghost" type="button" id="cancel-estorno">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    $("#close-estorno").onclick = () => { modal.innerHTML = ""; };
    $("#cancel-estorno").onclick = () => { modal.innerHTML = ""; };

    $("#estorno-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const motivo = ev.target.motivo.value.trim();
      await fs.updateDoc(fs.doc(db, "financial_transactions", tid), {
        estornado: true,
        dataEstorno: fs.serverTimestamp(),
        motivoEstorno: motivo
      });
      trans.estornado = true;
      trans.motivoEstorno = motivo;
      toast("Estorno registrado no histórico com sucesso.");
      modal.innerHTML = "";
      recalculateAndDraw();
    };
  };

  // Recebimento Direto (Manual)
  $("#new-direct-revenue-btn").onclick = () => {
    const modal = $("#estorno-modal-container");
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem">
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);max-width:520px;width:100%;padding:2rem;box-shadow:var(--shadow-lg)">
          <div class="admin-header-row" style="margin-bottom:1.2rem">
            <h3 style="font-size:1.3rem">Registrar Recebimento Direto</h3>
            <button class="btn small ghost" id="close-direct">×</button>
          </div>
          <form id="direct-rev-form" class="form">
            <label>Nome do Cliente / Identificador *
              <input name="clientName" required placeholder="Ex.: Lucas & Bruna">
            </label>
            <label>Serviço Realizado *
              <select name="service">
                ${SERVICES.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}
              </select>
            </label>
            <div class="modal-grid-2">
              <label>Valor (R$) *
                <input name="valor" required placeholder="Ex.: 2500,00">
              </label>
              <label>Data *
                <input name="dataRecebimento" type="date" required value="${new Date().toISOString().slice(0, 10)}">
              </label>
            </div>
            <label>Forma de Pagamento *
              <select name="formaPagamento">
                ${PAYMENT_METHODS.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}
              </select>
            </label>
            <div style="margin-top:1rem;display:flex;gap:.8rem">
              <button class="btn gold" type="submit">Salvar Recebimento</button>
              <button class="btn ghost" type="button" id="cancel-direct">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    $("#close-direct").onclick = () => { modal.innerHTML = ""; };
    $("#cancel-direct").onclick = () => { modal.innerHTML = ""; };

    $("#direct-rev-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      const valor = parseCurrencyInput(f.valor.value);
      if (valor <= 0) return toast("Informe um valor válido.", true);

      const ref = await fs.addDoc(fs.collection(db, "financial_transactions"), {
        clientName: f.clientName.value.trim(),
        service: f.service.value,
        valor,
        dataRecebimento: f.dataRecebimento.value,
        formaPagamento: f.formaPagamento.value,
        status: "recebido",
        estornado: false,
        createdAt: fs.serverTimestamp()
      });

      transactions.unshift({
        id: ref.id,
        clientName: f.clientName.value.trim(),
        service: f.service.value,
        valor,
        dataRecebimento: f.dataRecebimento.value,
        formaPagamento: f.formaPagamento.value,
        status: "recebido",
        estornado: false
      });

      toast("Recebimento adicionado com sucesso.");
      modal.innerHTML = "";
      recalculateAndDraw();
    };
  };
}

/* ==========================================================================
   6. ABA AGENDAMENTOS (REQUISITO 9) COM VERIFICAÇÃO DE CONFLITOS
   ========================================================================== */
async function schedulesView(v) {
  const snap = await fs.getDocs(fs.query(fs.collection(db, "requests"), fs.where("status", "in", ["novo", "nova", "atendimento"])));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Agrupamento por data para detecção de conflitos de horário
  const dateMap = {};
  list.forEach((r) => {
    const d = r.agendamento?.dataConfirmada || r.eventDate;
    if (d) {
      dateMap[d] = dateMap[d] || [];
      dateMap[d].push(r);
    }
  });

  const conflicts = [];
  Object.entries(dateMap).forEach(([date, reqs]) => {
    if (reqs.length > 1) {
      // Verifica se mais de um agendamento foi confirmado ou coincide em horário
      const confirmed = reqs.filter((r) => r.agendamento?.status === "confirmado");
      if (confirmed.length > 1) {
        conflicts.push({ date, reqs: confirmed });
      }
    }
  });

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Calendário &amp; Datas</p>
        <h2>Gestão de Agendamentos</h2>
      </div>
    </div>

    ${conflicts.length ? `
      <div class="notice bad" style="margin-bottom:1.5rem">
        <strong>⚠️ Alerta de Conflito de Agendamentos:</strong> Existem eventos confirmados para a mesma data:
        <ul style="margin:.4rem 0 0 1rem;padding:0">
          ${conflicts.map((c) => `
            <li><strong>${formatDate(c.date)}</strong>: ${c.reqs.map((r) => `${esc(r.name)} (${esc(formatTime(r.agendamento?.horarioConfirmado || r.eventTime))})`).join(" e ")}</li>
          `).join("")}
        </ul>
      </div>
    ` : ""}

    <div class="admin-cards">
      <div class="admin-stat">
        <b class="highlight">${list.filter((r) => r.agendamento?.status === "confirmado").length}</b>
        <span>Agendamentos Confirmados</span>
      </div>
      <div class="admin-stat">
        <b>${list.filter((r) => r.agendamento?.status !== "confirmado").length}</b>
        <span>Aguardando Confirmação</span>
      </div>
      <div class="admin-stat">
        <b style="color:${conflicts.length ? "var(--danger)" : "var(--success)"}">${conflicts.length}</b>
        <span>Conflitos de Data</span>
      </div>
    </div>

    <!-- Tabela de Agendamentos -->
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Data Desejada / Confirmada</th>
            <th>Horário</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Situação do Agendamento</th>
            <th style="text-align:right">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((r) => {
            const isConfirmed = r.agendamento?.status === "confirmado";
            const dateDisplay = isConfirmed ? r.agendamento.dataConfirmada : r.eventDate;
            const timeDisplay = isConfirmed ? r.agendamento.horarioConfirmado : r.eventTime;
            const hasConflict = conflicts.some((c) => c.date === dateDisplay && isConfirmed);

            return `
              <tr>
                <td>
                  <strong>${esc(formatDate(dateDisplay))}</strong>
                  ${isConfirmed ? `<span style="color:var(--success);font-size:.7rem;margin-left:.3rem">✓ Confirmado</span>` : `<span class="muted" style="font-size:.7rem;margin-left:.3rem">(Solicitado)</span>`}
                  ${hasConflict ? `<br><span class="conflict-warning">⚠️ Conflito nesta data</span>` : ""}
                </td>
                <td><strong>⏰ ${esc(formatTime(timeDisplay))}</strong></td>
                <td>
                  <strong>${esc(r.name)}</strong><br>
                  <span class="muted">${esc(r.phone)}</span>
                </td>
                <td>${esc(r.service)}</td>
                <td>
                  <span class="status-pill ${isConfirmed ? "concluido" : "atendimento"}">
                    ${isConfirmed ? "Agendamento Confirmado" : "Pendente de Confirmação"}
                  </span>
                  ${r.agendamento?.notas ? `<br><span class="muted" style="font-size:.75rem">${esc(r.agendamento.notas)}</span>` : ""}
                </td>
                <td>
                  <div class="admin-row" style="justify-content:flex-end">
                    <button class="btn small ${isConfirmed ? "ghost" : "gold"}" data-schedule-id="${r.id}">
                      ${isConfirmed ? "Alterar Agendamento" : "Confirmar agendamento com cliente"}
                    </button>
                    ${isConfirmed ? `<button class="btn small ghost" data-cancel-sched="${r.id}" style="color:var(--danger)">Desmarcar</button>` : ""}
                  </div>
                </td>
              </tr>
            `;
          }).join("") || `<tr><td colspan="6" class="muted" style="text-align:center;padding:3rem">Nenhum evento ou solicitação aguardando agendamento.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div id="schedule-modal-container"></div>
  `;

  v.onclick = (e) => {
    const btn = e.target.closest("[data-schedule-id]");
    if (btn) {
      const id = btn.dataset.scheduleId;
      const req = list.find((r) => r.id === id);
      if (req) openScheduleConfirmModal(req);
    }

    const cancelBtn = e.target.closest("[data-cancel-sched]");
    if (cancelBtn) {
      const id = cancelBtn.dataset.cancelSched;
      if (confirm("Deseja desmarcar a confirmação de agendamento deste cliente?")) {
        fs.updateDoc(fs.doc(db, "requests", id), {
          "agendamento.status": "pendente"
        }).then(() => {
          toast("Agendamento revertido para pendente.");
          render();
        });
      }
    }
  };

  function openScheduleConfirmModal(req) {
    const container = $("#schedule-modal-container");
    const currentConfirmed = req.agendamento?.status === "confirmado";
    const initialDate = req.agendamento?.dataConfirmada || req.eventDate || "";
    const initialTime = req.agendamento?.horarioConfirmado || req.eventTime || "16:00";

    container.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem">
        <div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-sm);max-width:540px;width:100%;padding:2rem;box-shadow:var(--shadow-lg)">
          <div class="admin-header-row" style="margin-bottom:1.2rem">
            <div>
              <p class="eyebrow" style="margin-bottom:.2rem">Alinhamento com Cliente</p>
              <h3 style="font-size:1.4rem">Confirmar Agendamento</h3>
            </div>
            <button class="btn small ghost" id="close-sched-modal">×</button>
          </div>
          <form id="sched-form" class="form">
            <p style="font-size:.88rem">Cliente: <strong>${esc(req.name)}</strong> (${esc(req.phone)})</p>
            
            <div class="modal-grid-2">
              <label>Data Confirmada *
                <input name="dataConfirmada" type="date" required value="${esc(initialDate)}">
              </label>
              <label>Horário Confirmado *
                <input name="horarioConfirmado" type="time" required value="${esc(initialTime)}">
              </label>
            </div>

            <label>Observações do Agendamento (local de encontro, trajes, roteiro...)
              <textarea name="notas">${esc(req.agendamento?.notas || "")}</textarea>
            </label>

            <label style="display:flex;align-items:flex-start;gap:.6rem;cursor:pointer;margin-top:.4rem">
              <input type="checkbox" name="contatoConfirmado" required checked style="margin-top:.2rem">
              <span style="font-size:.82rem;line-height:1.5">Confirmo que entrei em contato com o cliente e alinhamos a disponibilidade desta data e horário. *</span>
            </label>

            <div style="margin-top:1rem;display:flex;gap:.8rem">
              <button class="btn gold" type="submit">Salvar Confirmação de Agendamento</button>
              <button class="btn ghost" type="button" id="cancel-sched-modal">Cancelar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    $("#close-sched-modal").onclick = () => { container.innerHTML = ""; };
    $("#cancel-sched-modal").onclick = () => { container.innerHTML = ""; };

    $("#sched-form").onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      await fs.updateDoc(fs.doc(db, "requests", req.id), {
        status: "atendimento",
        agendamento: {
          status: "confirmado",
          dataConfirmada: f.dataConfirmada.value,
          horarioConfirmado: f.horarioConfirmado.value,
          notas: f.notas.value.trim(),
          contatoConfirmado: true,
          confirmadoEm: fs.serverTimestamp()
        }
      });
      toast("Agendamento confirmado com sucesso!");
      container.innerHTML = "";
      render();
    };
  }
}

/* ==========================================================================
   7. CONTEÚDO DO SITE COM SELETOR DE ARQUIVOS DO COMPUTADOR (REQUISITO 6)
   ========================================================================== */
async function contentView(v) {
  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Imagens e Textos do Site</p>
        <h2>Conteúdo da Página Inicial e Sobre</h2>
      </div>
    </div>

    <div style="background:var(--surface);border:1px solid var(--line);padding:clamp(1.5rem,4vw,2.5rem);border-radius:var(--radius-sm);box-shadow:var(--shadow-sm);margin-bottom:2rem">
      <form id="content-form" class="form">
        <h3 style="font-size:1.4rem;margin-bottom:1rem;color:var(--text)">Fotografia Principal da Home (Hero Image)</h3>
        <p class="muted" style="font-size:.85rem;margin-bottom:1.2rem">Selecione uma imagem em alta resolução diretamente do seu computador.</p>
        
        <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1.5rem">
          <div style="width:150px;aspect-ratio:4/5;border:1px solid var(--line);overflow:hidden;background:var(--surface-subtle);border-radius:var(--radius-sm)" id="hero-preview-box">
            ${settings.heroImage ? `<img src="${esc(settings.heroImage)}" style="width:100%;height:100%;object-fit:cover" alt="Hero atual">` : `<div style="display:grid;place-items:center;height:100%;font-size:.78rem;color:var(--text-dim);text-align:center;padding:.5rem">Sem imagem</div>`}
          </div>
          <div>
            <label class="btn small" style="cursor:pointer">
              Selecionar nova imagem do computador
              <input type="file" id="hero-file-input" accept="image/jpeg,image/png,image/webp" style="display:none">
            </label>
            <p id="hero-file-status" class="muted" style="font-size:.78rem;margin-top:.4rem"></p>
          </div>
        </div>

        <div class="modal-grid-2">
          <label>Título Principal da Home<input name="heroTitle" value="${esc(settings.heroTitle)}"></label>
          <label>Subtítulo da Home<textarea name="heroSubtitle">${esc(settings.heroSubtitle)}</textarea></label>
        </div>

        <h3 style="font-size:1.4rem;margin-block:2rem 1rem;color:var(--text);border-top:1px solid var(--line);padding-top:1.5rem">Foto do Fotógrafo na Seção Sobre</h3>
        <p class="muted" style="font-size:.85rem;margin-bottom:1.2rem">Selecione seu retrato profissional para apresentação na seção Sobre e na página da marca.</p>

        <div style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1.5rem">
          <div style="width:150px;aspect-ratio:4/5;border:1px solid var(--line);overflow:hidden;background:var(--surface-subtle);border-radius:var(--radius-sm)" id="about-preview-box">
            ${settings.aboutPortrait ? `<img src="${esc(settings.aboutPortrait)}" style="width:100%;height:100%;object-fit:cover" alt="Retrato atual">` : `<div style="display:grid;place-items:center;height:100%;font-size:.78rem;color:var(--text-dim);text-align:center;padding:.5rem">Sem retrato</div>`}
          </div>
          <div>
            <label class="btn small" style="cursor:pointer">
              Selecionar retrato do computador
              <input type="file" id="about-file-input" accept="image/jpeg,image/png,image/webp" style="display:none">
            </label>
            <p id="about-file-status" class="muted" style="font-size:.78rem;margin-top:.4rem"></p>
          </div>
        </div>

        <div class="modal-grid-2">
          <label>História e Trajetória<textarea name="aboutStory" style="min-height:9rem">${esc(settings.aboutStory)}</textarea></label>
          <label>Filosofia e Abordagem<textarea name="aboutPhilosophy" style="min-height:9rem">${esc(settings.aboutPhilosophy)}</textarea></label>
        </div>

        <div class="modal-grid-2">
          <label>Estilo Fotográfico<textarea name="aboutStyle">${esc(settings.aboutStyle)}</textarea></label>
          <label>Processo de Atendimento<textarea name="aboutProcess">${esc(settings.aboutProcess)}</textarea></label>
        </div>

        <div style="margin-top:1.5rem">
          <button class="btn gold" type="submit" id="save-content-btn">Salvar Conteúdo e Imagens</button>
        </div>
      </form>
    </div>
  `;

  let heroFile = null;
  let aboutFile = null;

  $("#hero-file-input").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    heroFile = f;
    $("#hero-preview-box").innerHTML = `<img src="${URL.createObjectURL(f)}" alt="Nova foto hero">`;
    $("#hero-file-status").textContent = `Pronto para envio: ${f.name}`;
  };

  $("#about-file-input").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    aboutFile = f;
    $("#about-preview-box").innerHTML = `<img src="${URL.createObjectURL(f)}" alt="Novo retrato">`;
    $("#about-file-status").textContent = `Pronto para envio: ${f.name}`;
  };

  $("#content-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#save-content-btn");
    btn.disabled = true;
    btn.textContent = "Processando e enviando imagens…";

    const f = e.target;
    let heroImage = settings.heroImage || "";
    let aboutPortrait = settings.aboutPortrait || "";

    try {
      if (heroFile) {
        toast("Enviando foto da Home…");
        const bmp = await createImageBitmap(heroFile);
        const webp = await toBlob(bmp, 2400, 0.88);
        const res = await uploadToStorage(`site/hero_${Date.now()}.${webp.ext}`, webp.b);
        heroImage = res.url;
      }

      if (aboutFile) {
        toast("Enviando retrato do fotógrafo…");
        const bmp = await createImageBitmap(aboutFile);
        const webp = await toBlob(bmp, 1800, 0.88);
        const res = await uploadToStorage(`site/about_${Date.now()}.${webp.ext}`, webp.b);
        aboutPortrait = res.url;
      }

      const data = {
        heroTitle: f.heroTitle.value.trim(),
        heroSubtitle: f.heroSubtitle.value.trim(),
        heroImage,
        aboutPortrait,
        aboutStory: f.aboutStory.value.trim(),
        aboutPhilosophy: f.aboutPhilosophy.value.trim(),
        aboutStyle: f.aboutStyle.value.trim(),
        aboutProcess: f.aboutProcess.value.trim()
      };

      await fs.setDoc(fs.doc(db, "settings", "site"), data, { merge: true });
      Object.assign(settings, data);
      toast("Conteúdo e imagens atualizados com sucesso no site público!");
      render();
    } catch (er) {
      console.error(er);
      toast("Erro ao salvar: " + (er.message || er.code), true);
      btn.disabled = false;
      btn.textContent = "Salvar Conteúdo e Imagens";
    }
  };
}

/* ==========================================================================
   8. AVALIAÇÕES & DEPOIMENTOS (MODERAÇÃO)
   ========================================================================== */
async function testimonialsView(v) {
  const snap = await fs.getDocs(fs.collection(db, "testimonials"));
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Depoimentos dos Clientes</p>
        <h2>Moderação de Avaliações</h2>
      </div>
      <button class="btn gold" id="add-testi-btn">＋ Cadastrar Depoimento</button>
    </div>

    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Cliente / Casal</th>
            <th>Avaliação</th>
            <th>Texto</th>
            <th>Status</th>
            <th style="text-align:right">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((t) => `
            <tr>
              <td>
                <strong>${esc(t.name)}</strong>
                ${t.featured ? `<br><span style="color:var(--gold);font-size:.72rem">★ Destaque na Home</span>` : ""}
              </td>
              <td style="color:var(--gold);letter-spacing:.1em;white-space:nowrap">
                ${"★".repeat(Math.max(1, Math.min(5, Number(t.rating) || 5)))}${"☆".repeat(5 - Math.max(1, Math.min(5, Number(t.rating) || 5)))}
              </td>
              <td style="max-width:320px;font-size:.84rem;line-height:1.6">“${esc(t.text)}”</td>
              <td>
                <span class="status-pill ${t.published ? "published" : "atendimento"}">
                  ${t.published ? "Publicada" : "Pendente"}
                </span>
              </td>
              <td>
                <div class="admin-row" style="justify-content:flex-end">
                  <button class="btn small ${t.published ? "ghost" : "gold"}" data-t="${t.id}" data-a="pub">
                    ${t.published ? "Ocultar" : "Aprovar"}
                  </button>
                  <button class="btn small ghost" data-t="${t.id}" data-a="feat">
                    ${t.featured ? "Sem Destaque" : "★ Destacar"}
                  </button>
                  <button class="btn small ghost" data-t="${t.id}" data-a="del" style="color:var(--danger)">Excluir</button>
                </div>
              </td>
            </tr>
          `).join("") || `<tr><td colspan="5" class="muted" style="text-align:center;padding:3rem">Nenhuma avaliação cadastrada ainda.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

  v.onclick = async (e) => {
    const b = e.target.closest("[data-t]");
    if (!b) return;
    const t = list.find((x) => x.id === b.dataset.t);
    if (!t) return;
    const a = b.dataset.a;

    if (a === "pub") {
      await fs.updateDoc(fs.doc(db, "testimonials", t.id), { published: !t.published });
      toast(t.published ? "Avaliação ocultada." : "Avaliação aprovada e visível publicamente!");
      render();
    }
    if (a === "feat") {
      await fs.updateDoc(fs.doc(db, "testimonials", t.id), { featured: !t.featured });
      toast("Destaque atualizado.");
      render();
    }
    if (a === "del" && confirm(`Excluir a avaliação de "${t.name}"?`)) {
      await fs.deleteDoc(fs.doc(db, "testimonials", t.id));
      toast("Avaliação excluída.");
      render();
    }
  };

  $("#add-testi-btn").onclick = () => {
    const name = prompt("Nome do cliente / casal:");
    if (!name) return;
    const text = prompt("Texto do depoimento:");
    if (!text) return;
    const rating = Number(prompt("Nota em estrelas (1 a 5):", "5")) || 5;

    fs.addDoc(fs.collection(db, "testimonials"), {
      name: name.trim(),
      text: text.trim(),
      rating,
      published: true,
      featured: false,
      createdAt: fs.serverTimestamp()
    }).then(() => {
      toast("Depoimento cadastrado com sucesso!");
      render();
    });
  };
}

/* ==========================================================================
   9. CONFIGURAÇÕES (PRESERVANDO A IMPLEMENTAÇÃO EXISTENTE)
   ========================================================================== */
async function settingsView(v) {
  const F = [
    ["brandName", "Nome da marca"],
    ["description", "Descrição da marca", 1],
    ["instagram", "Link do Instagram"],
    ["threads", "Link do Threads"],
    ["whatsappLink", "Link oficial do WhatsApp (wa.me/message/…)"],
    ["whatsappNumber", "Número internacional (só dígitos, ex.: 5563…)"],
    ["location", "Localização e atendimento"],
    ["heroTitle", "Título da home"],
    ["heroSubtitle", "Subtítulo da home", 1],
    ["storyTitle", "Título 'forma de contar histórias'"],
    ["storyText", "Texto 'forma de contar histórias'", 1],
    ["aboutStory", "Sobre: história", 1],
    ["aboutPhilosophy", "Sobre: filosofia", 1],
    ["aboutStyle", "Sobre: estilo", 1],
    ["aboutExperience", "Sobre: experiência", 1],
    ["aboutProcess", "Sobre: processo de atendimento", 1],
    ["aboutArea", "Sobre: área de atuação", 1]
  ];

  v.innerHTML = `
    <div class="admin-header-row">
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">Configurações Gerais</p>
        <h2>Configurações do Site</h2>
      </div>
    </div>
    <div style="background:var(--surface);border:1px solid var(--line);padding:clamp(1.5rem,4vw,2.5rem);border-radius:var(--radius-sm);box-shadow:var(--shadow-sm)">
      <form id="sf" class="form">
        ${F.map(([k, l, ta]) => `
          <label>${l}
            ${ta ? `<textarea name="${k}">${esc(settings[k])}</textarea>` : `<input name="${k}" value="${esc(settings[k])}">`}
          </label>
        `).join("")}
        <label>Categorias de Álbuns (uma por linha)
          <textarea name="categories">${esc(settings.categories.join("\n"))}</textarea>
        </label>
        <p class="notice">
          Política de retenção: solicitações encerradas com mais de 60 dias podem ser removidas de forma automática (via rotina agendada Cloud Functions) ou manual (na aba Solicitações).
        </p>
        <input name="retentionDays" type="hidden" value="60">
        <div style="margin-top:1rem">
          <button class="btn gold">Salvar configurações</button>
        </div>
      </form>
    </div>
  `;

  $("#sf").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, d = {};
    F.forEach(([k]) => (d[k] = f[k].value.trim()));
    d.categories = f.categories.value.split("\n").map((x) => x.trim()).filter(Boolean);
    d.retentionDays = 60;

    try {
      await fs.setDoc(fs.doc(db, "settings", "site"), d, { merge: true });
      Object.assign(settings, d);
      sessionStorage.clear();
      toast("Configurações salvas com sucesso.");
    } catch (er) {
      toast("Erro ao salvar: " + (er.code || er.message), true);
    }
  };
}
