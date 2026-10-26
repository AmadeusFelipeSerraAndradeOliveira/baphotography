import { db, fs, isConfigured } from "./firebase.js";
import { $, $$, esc, mountLayout, albumCard, reveal, notConfiguredNotice, toast } from "./ui.js";

// Inicializa layout compartilhado
const s = await mountLayout();

// 1. Preenchimento de dados da marca e Hero
if (s.heroTitle) $("#hero-heading").textContent = s.heroTitle;
if (s.heroSubtitle) $("#hero-sub").textContent = s.heroSubtitle;

const heroMedia = $("#hero-media");
if (s.heroImage && heroMedia) {
  const heroImg = document.createElement("img");
  heroImg.src = s.heroImage;
  heroImg.alt = "Fotografia de destaque Baphotography";
  heroImg.fetchPriority = "high";
  heroImg.loading = "eager";
  heroImg.onerror = () => heroImg.remove();
  heroMedia.prepend(heroImg);
}

// 2. Seção Sobre
const aboutMedia = $("#about-media");
if (s.aboutPortrait && aboutMedia) {
  const portraitImg = document.createElement("img");
  portraitImg.src = s.aboutPortrait;
  portraitImg.alt = "Retrato de apresentação Baphotography";
  portraitImg.loading = "lazy";
  portraitImg.onerror = () => portraitImg.remove();
  aboutMedia.replaceChildren(portraitImg);
}

const aboutTextEl = $("#about-text");
if (aboutTextEl) {
  const parts = [s.aboutStory, s.aboutPhilosophy].filter((x) => String(x || "").trim());
  if (parts.length) {
    aboutTextEl.innerHTML = parts.map((p) => `<p>${esc(p)}</p>`).join("");
  } else if (s.storyText) {
    aboutTextEl.innerHTML = `<p>${esc(s.storyText)}</p>`;
  }
}

if (s.location && $("#about-location")) {
  $("#about-location").textContent = s.location;
}

// Links CTA
if (s.instagram && $("#cta-ig-link")) $("#cta-ig-link").href = s.instagram;
if (s.threads && $("#cta-threads-link")) $("#cta-threads-link").href = s.threads;

// 3. Portfólio Integrado com Filtros de Categoria
const portfolioGrid = $("#portfolio-grid");
const filtersContainer = $("#portfolio-filters");
let allPublishedAlbums = [];
let activeCategory = "";

async function loadIntegratedPortfolio() {
  if (!portfolioGrid) return;
  if (!isConfigured) return notConfiguredNotice(portfolioGrid);

  try {
    // Tenta consulta ordenada; se índice composto não estiver pronto, busca publicados e ordena em memória
    let snap;
    try {
      const q = fs.query(
        fs.collection(db, "albums"),
        fs.where("status", "==", "published"),
        fs.orderBy("order", "asc")
      );
      snap = await fs.getDocs(q);
    } catch (err) {
      console.warn("Consulta ordenada com fallback em memória:", err);
      const qFallback = fs.query(
        fs.collection(db, "albums"),
        fs.where("status", "==", "published")
      );
      snap = await fs.getDocs(qFallback);
    }

    allPublishedAlbums = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        // Álbuns em destaque primeiro, seguidos pela ordem definida
        if (b.featured && !a.featured) return 1;
        if (a.featured && !b.featured) return -1;
        return (Number(a.order) || 0) - (Number(b.order) || 0);
      });

    // Renderiza chips de categorias dinâmicas
    if (filtersContainer) {
      const cats = ["Todos", ...(s.categories || [])];
      filtersContainer.innerHTML = cats
        .map((c, idx) => `
          <button type="button" class="chip" data-category="${idx === 0 ? "" : esc(c)}" aria-pressed="${idx === 0}">
            ${esc(c)}
          </button>
        `)
        .join("");

      filtersContainer.onclick = (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        $$(".chip", filtersContainer).forEach((c) => c.setAttribute("aria-pressed", c === btn));
        activeCategory = btn.dataset.category || "";
        renderPortfolioGrid();
      };
    }

    renderPortfolioGrid();
  } catch (e) {
    console.error("Erro ao carregar portfólio:", e);
    portfolioGrid.innerHTML = `<div class="notice bad" style="grid-column:span 12"><p>Não foi possível carregar o portfólio neste momento. Verifique a conexão com o banco de dados.</p></div>`;
  }
}

function renderPortfolioGrid() {
  if (!portfolioGrid) return;
  const filtered = activeCategory
    ? allPublishedAlbums.filter((a) => (a.category || "").toLowerCase() === activeCategory.toLowerCase())
    : allPublishedAlbums;

  if (!filtered.length) {
    portfolioGrid.innerHTML = `
      <div style="grid-column:span 12;text-align:center;padding:4rem 1rem;" class="muted">
        <p>Nenhum álbum publicado ${activeCategory ? `na categoria "${esc(activeCategory)}"` : "ainda"}.</p>
      </div>
    `;
    return;
  }

  // Exibe até 9 álbuns na página inicial integrada
  portfolioGrid.innerHTML = filtered.slice(0, 9).map(albumCard).join("");
  reveal(portfolioGrid);
}

loadIntegratedPortfolio();

// 4. Avaliações / Depoimentos Aprovados
const reviewsGrid = $("#reviews-grid");
async function loadTestimonials() {
  if (!reviewsGrid) return;
  if (!isConfigured) return;

  try {
    let snap;
    try {
      const q = fs.query(
        fs.collection(db, "testimonials"),
        fs.where("published", "==", true),
        fs.orderBy("createdAt", "desc"),
        fs.limit(6)
      );
      snap = await fs.getDocs(q);
    } catch {
      const q2 = fs.query(
        fs.collection(db, "testimonials"),
        fs.where("published", "==", true),
        fs.limit(6)
      );
      snap = await fs.getDocs(q2);
    }

    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));

    if (!list.length) {
      reviewsGrid.innerHTML = `
        <div style="grid-column:span 3;text-align:center;padding:3rem 1rem" class="muted">
          <p>Ainda não há avaliações publicadas. Se você já viveu uma história conosco, compartilhe sua experiência abaixo!</p>
        </div>
      `;
      return;
    }

    reviewsGrid.innerHTML = list
      .map((t) => {
        const rating = Math.max(1, Math.min(5, Number(t.rating) || 5));
        const initials = (t.name || "BA")
          .split(" ")
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0].toUpperCase())
          .join("");

        return `
          <blockquote class="review-card reveal">
            <div>
              <div class="review-stars" aria-label="Nota ${rating} de 5">
                ${"★".repeat(rating)}${"☆".repeat(5 - rating)}
              </div>
              <p class="review-text">“${esc(t.text)}”</p>
            </div>
            <footer class="review-author">
              <div class="review-author-avatar">${esc(initials)}</div>
              <cite class="review-author-name">${esc(t.name)}</cite>
            </footer>
          </blockquote>
        `;
      })
      .join("");

    reveal(reviewsGrid);
  } catch (err) {
    console.error("Falha ao carregar avaliações:", err);
    reviewsGrid.innerHTML = `<p class="muted" style="grid-column:span 3">Não foi possível carregar as avaliações agora.</p>`;
  }
}

loadTestimonials();

// 5. Modal de Envio de Avaliação pelo Cliente
const reviewModal = $("#client-review-modal");
const openReviewBtn = $("#open-review-modal-btn");
const closeReviewBtn = $("#close-review-modal-btn");
const reviewForm = $("#public-review-form");
const starPicker = $("#star-picker");
const ratingInput = $("#review-rating-val");
const feedback = $("#review-feedback");
const submitReviewBtn = $("#submit-review-btn");

if (openReviewBtn && reviewModal) {
  const closeM = () => {
    if (reviewModal.open) {
      reviewModal.close();
      document.body.classList.remove("modal-open");
    }
  };

  openReviewBtn.addEventListener("click", () => {
    document.body.classList.add("modal-open");
    reviewModal.showModal();
    reviewForm?.querySelector("[name=name]")?.focus();
  });

  closeReviewBtn?.addEventListener("click", closeM);
  reviewModal.addEventListener("click", (e) => { if (e.target === reviewModal) closeM(); });
  reviewModal.addEventListener("keydown", (e) => { if (e.key === "Escape") closeM(); });

  // Seletor interativo de estrelas (1 a 5)
  if (starPicker) {
    const stars = $$(".star", starPicker);
    stars.forEach((star) => {
      star.addEventListener("click", () => {
        const val = Number(star.dataset.v);
        ratingInput.value = val;
        stars.forEach((s) => {
          s.classList.toggle("active", Number(s.dataset.v) <= val);
        });
      });
    });
  }

  // Submissão da avaliação com validação e segurança
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (reviewForm.website.value) return; // Anti-spam

      const name = reviewForm.name.value.trim();
      const text = reviewForm.text.value.trim();
      const rating = Number(ratingInput.value);

      const errors = {};
      if (name.length < 2) errors.name = "Informe seu nome (mínimo 2 caracteres).";
      if (name.length > 80) errors.name = "Nome muito longo (máximo 80 caracteres).";
      if (text.length < 10) errors.text = "Conte um pouco mais sobre sua experiência (mínimo 10 caracteres).";
      if (text.length > 800) errors.text = "Depoimento muito longo (máximo 800 caracteres).";
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = "Selecione uma nota válida de 1 a 5 estrelas.";

      $$("[data-for]", reviewForm).forEach((el) => { el.textContent = errors[el.dataset.for] || ""; });
      if (Object.keys(errors).length) return;

      submitReviewBtn.disabled = true;
      submitReviewBtn.textContent = "Enviando avaliação…";
      feedback.textContent = "";

      try {
        await fs.addDoc(fs.collection(db, "testimonials"), {
          name,
          text,
          rating,
          published: false,
          featured: false,
          createdAt: fs.serverTimestamp()
        });

        reviewForm.reset();
        ratingInput.value = "5";
        $$(".star", starPicker).forEach((s) => s.classList.add("active"));

        feedback.innerHTML = `<span style="color:var(--success)">✓ Muito obrigado! Sua avaliação foi enviada e será exibida no site após nossa moderação.</span>`;
        toast("Avaliação enviada com sucesso!");
        setTimeout(() => {
          closeM();
          feedback.textContent = "";
        }, 2500);
      } catch (err) {
        console.error("Erro ao enviar avaliação:", err);
        feedback.innerHTML = `<span style="color:var(--danger)">Não foi possível enviar agora. Verifique a conexão e tente novamente.</span>`;
      } finally {
        submitReviewBtn.disabled = false;
        submitReviewBtn.textContent = "Enviar avaliação";
      }
    });
  }
}
