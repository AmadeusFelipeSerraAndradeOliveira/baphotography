import { $, esc, mountLayout } from "./ui.js";

const s = await mountLayout();

const portraitEl = $("#portrait");
if (s.aboutPortrait && portraitEl) {
  const img = document.createElement("img");
  img.src = s.aboutPortrait;
  img.alt = "Retrato de apresentação Baphotography";
  img.loading = "eager";
  img.onerror = () => img.remove();
  portraitEl.replaceChildren(img);
}

const sections = [
  ["Nossa História", s.aboutStory],
  ["Filosofia & Abordagem", s.aboutPhilosophy],
  ["Estilo Fotográfico", s.aboutStyle],
  ["Experiência & Trajetória", s.aboutExperience],
  ["Processo de Atendimento", s.aboutProcess]
].filter(([, v]) => String(v || "").trim());

const body = $("#about-body");
if (body) {
  if (sections.length) {
    body.innerHTML = sections
      .map(([title, text]) => `
        <div style="margin-bottom:2rem">
          <h4 style="font-family:var(--sans);font-size:.78rem;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:.5rem">${esc(title)}</h4>
          <p style="white-space:pre-line;line-height:1.8;color:var(--text)">${esc(text)}</p>
        </div>
      `)
      .join("");
  } else {
    body.innerHTML = `
      <p style="line-height:1.8;color:var(--text)">
        A Baphotography nasceu da paixão por narrativas visuais profundas, sensíveis e elegantes. Especializada em casamentos e registros afetivos, nossa missão é capturar os momentos com pureza estética e verdade documental.
      </p>
      <p style="line-height:1.8;color:var(--text)">
        Cada detalhe, cada sorriso e cada lágrima recebem nossa atenção dedicada para que a sua história continue viva pelas próximas gerações.
      </p>
    `;
  }
}

if (s.aboutPhilosophy && $("#about-phil")) {
  $("#about-phil").textContent = s.aboutPhilosophy.slice(0, 120) + (s.aboutPhilosophy.length > 120 ? "…" : "");
}

if (s.aboutArea && $("#about-area")) {
  $("#about-area").textContent = s.aboutArea;
} else if (s.location && $("#about-area")) {
  $("#about-area").textContent = s.location;
}
