import { db, fs, isConfigured } from "./firebase.js";
import { $, esc, mountLayout, openLightbox, notConfiguredNotice } from "./ui.js";

await mountLayout();

const id = new URLSearchParams(location.search).get("id");
const gallery = $("#gallery");
let photos = [];

async function init() {
  if (!isConfigured) return notConfiguredNotice(gallery);
  if (!id) {
    gallery.innerHTML = `<div class="notice bad"><p>Álbum não especificado. <a href="portfolio.html">Voltar ao portfólio</a>.</p></div>`;
    return;
  }

  try {
    const docRef = fs.doc(db, "albums", id);
    const snap = await fs.getDoc(docRef);

    if (!snap.exists()) {
      gallery.innerHTML = `<div class="notice bad"><p>Este álbum não foi encontrado ou foi removido.</p></div>`;
      return;
    }

    const album = snap.data();
    if (album.status !== "published") {
      gallery.innerHTML = `<div class="notice bad"><p>Este álbum não está disponível publicamente.</p></div>`;
      return;
    }

    document.title = `${album.title} | Baphotography`;
    $("#a-title").textContent = album.title;
    if (album.category && $("#a-category")) $("#a-category").textContent = album.category;
    $("#a-meta").textContent = [album.category, album.year, album.location].filter(Boolean).join(" · ");
    $("#a-desc").textContent = album.description || "";

    // Consulta de fotos com fallback inteligente de ordenação
    let photosSnap;
    try {
      const q = fs.query(fs.collection(db, "albums", id, "photos"), fs.orderBy("order", "asc"));
      photosSnap = await fs.getDocs(q);
    } catch (err) {
      console.warn("Consulta ordenada de fotos com fallback local:", err);
      photosSnap = await fs.getDocs(fs.collection(db, "albums", id, "photos"));
    }

    photos = photosSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    if (!photos.length) {
      gallery.innerHTML = `<div style="grid-column:1/-1;padding:3rem 1rem" class="muted"><p>Este álbum ainda não possui fotografias publicadas.</p></div>`;
      return;
    }

    gallery.innerHTML = photos
      .map((p, idx) => `
        <figure class="reveal">
          <button type="button" data-index="${idx}" aria-label="Ampliar fotografia ${idx + 1}${p.title ? ": " + esc(p.title) : ""}">
            <img
              src="${esc(p.thumbUrl || p.url)}"
              alt="${esc(p.alt || p.title || "Fotografia do álbum " + album.title)}"
              ${p.width ? `width="${p.width}" height="${p.height}"` : ""}
              loading="${idx < 4 ? "eager" : "lazy"}"
              onerror="if (this.src !== '${esc(p.url)}') { this.src = '${esc(p.url)}'; } else { this.closest('figure').classList.add('broken'); }"
            >
          </button>
        </figure>
      `)
      .join("");

    gallery.querySelectorAll("img").forEach((im) => {
      im.addEventListener("load", () => im.classList.add("ok"));
      if (im.complete && im.naturalWidth) im.classList.add("ok");
    });

    // Clique para abrir o Lightbox
    gallery.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-index]");
      if (!btn) return;
      const idx = Number(btn.dataset.index);
      openLightbox(photos, idx);
    });

  } catch (err) {
    console.error("Erro ao carregar álbum:", err);
    gallery.innerHTML = `<div class="notice bad"><p>Não foi possível carregar as fotografias deste álbum agora. Verifique a conexão com o banco de dados.</p></div>`;
  }
}

init();
