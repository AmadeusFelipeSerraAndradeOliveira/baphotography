import { db, fs, isConfigured } from "./firebase.js";
import { $, $$, mountLayout, albumCard, reveal, notConfiguredNotice } from "./ui.js";

const PAGE_LIMIT = 12;
const s = await mountLayout();
const list = $("#list");
const moreBtn = $("#more");
const filtersEl = $("#filters");

let category = "";
let cursor = null;
let allCategoryAlbums = [];
let currentIndex = 0;

// Inicializa filtros de categoria
if (filtersEl) {
  const cats = ["Todos", ...(s.categories || [])];
  filtersEl.innerHTML = cats
    .map((c, i) => `
      <button class="chip" aria-pressed="${i === 0}" data-category="${i === 0 ? "" : esc(c)}">
        ${esc(c)}
      </button>
    `)
    .join("");

  filtersEl.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    $$(".chip", filtersEl).forEach((x) => x.setAttribute("aria-pressed", x === b));
    category = b.dataset.category;
    cursor = null;
    currentIndex = 0;
    allCategoryAlbums = [];
    list.innerHTML = "";
    load();
  });
}

if (moreBtn) {
  moreBtn.addEventListener("click", load);
}

async function load() {
  if (!isConfigured) return notConfiguredNotice(list);
  if (moreBtn) moreBtn.disabled = true;

  if (!cursor && currentIndex === 0) {
    list.innerHTML = `<div class="skeleton" style="grid-column:span 12"></div>`;
  }

  try {
    // Se ainda não buscamos a lista inteira ordenada, buscamos de forma resiliente
    if (!allCategoryAlbums.length) {
      let snap;
      try {
        const constraints = [fs.where("status", "==", "published")];
        if (category) constraints.push(fs.where("category", "==", category));
        constraints.push(fs.orderBy("order", "asc"));
        snap = await fs.getDocs(fs.query(fs.collection(db, "albums"), ...constraints));
      } catch (err) {
        console.warn("Consulta composta com fallback de ordenação local:", err);
        const constraints = [fs.where("status", "==", "published")];
        if (category) constraints.push(fs.where("category", "==", category));
        snap = await fs.getDocs(fs.query(fs.collection(db, "albums"), ...constraints));
      }

      allCategoryAlbums = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

      if (!cursor) list.innerHTML = "";
    }

    if (!allCategoryAlbums.length) {
      list.innerHTML = `
        <div style="grid-column:span 12;text-align:center;padding:4rem 1rem" class="muted">
          <p>Nenhum álbum publicado ${category ? `na categoria "${esc(category)}"` : "no portfólio ainda"}.</p>
        </div>
      `;
      if (moreBtn) moreBtn.hidden = true;
      return;
    }

    const nextBatch = allCategoryAlbums.slice(currentIndex, currentIndex + PAGE_LIMIT);
    currentIndex += nextBatch.length;

    list.insertAdjacentHTML("beforeend", nextBatch.map(albumCard).join(""));

    if (moreBtn) {
      moreBtn.hidden = currentIndex >= allCategoryAlbums.length;
    }

    reveal(list);
  } catch (e) {
    console.error("Falha ao carregar álbuns:", e);
    list.innerHTML = `<div class="notice bad" style="grid-column:span 12"><p>Não foi possível carregar os álbuns agora. Verifique a conexão e tente novamente.</p></div>`;
  } finally {
    if (moreBtn) moreBtn.disabled = false;
  }
}

load();
