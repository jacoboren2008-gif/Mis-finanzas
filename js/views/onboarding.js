// Asistente de primer uso: nombre, un par de preguntas guía, PIN opcional y
// creación de los espacios iniciales (Trabajo / Efectivo / Digital, editables).
import { saveProfile, createSpace } from "../db.js";
import { renderLock } from "./lock.js";
import { escapeHtml } from "../components/modal.js";
import { showToast } from "../components/toast.js";

const STEPS = ["bienvenida", "ingreso", "objetivo", "pin", "espacios"];

const OBJETIVOS = [
  { key: "ahorrar", emoji: "💰", label: "Ahorrar para algo importante" },
  { key: "controlar", emoji: "📉", label: "Controlar mejor mis gastos" },
  { key: "deudas", emoji: "🧯", label: "Salir de deudas" },
  { key: "organizar", emoji: "🗂️", label: "Simplemente organizarme" },
];

const EMOJI_CHOICES = ["💰", "💼", "💵", "📱", "🏦", "🎯", "🐷", "🧾", "✈️", "🏠"];

export function renderOnboarding(container, { onComplete }) {
  const data = {
    name: "",
    ingresoMensual: "",
    objetivo: null,
    pinBundle: null,
    spaces: [
      { name: "Trabajo", icon: "💼", colorSlot: 1 },
      { name: "Efectivo", icon: "💵", colorSlot: 3 },
      { name: "Digital", icon: "📱", colorSlot: 2 },
    ],
  };
  let stepIndex = 0;

  paint();

  function stepDots() {
    return `<div class="step-dots">${STEPS.map((_, i) => `<div class="d ${i === stepIndex ? "active" : ""}"></div>`).join("")}</div>`;
  }

  function go(delta) {
    stepIndex = Math.max(0, Math.min(STEPS.length - 1, stepIndex + delta));
    paint();
  }

  function paint() {
    const step = STEPS[stepIndex];
    if (step === "pin-create") return; // manejado aparte
    container.innerHTML = `<div class="centered-flow">${stepDots()}${bodyFor(step)}</div>`;
    wire(step);
  }

  function bodyFor(step) {
    if (step === "bienvenida") {
      return `
        <div class="brand-mark">👋</div>
        <h1 style="text-align:center;font-size:1.35rem;font-weight:700">¡Hola! Vamos a organizar tus finanzas</h1>
        <p style="text-align:center;color:var(--ink-secondary);font-size:0.9rem">Unas preguntas rápidas para dejar todo listo. Toma menos de un minuto.</p>
        <div class="field">
          <label for="ob-name">¿Cómo te llamas?</label>
          <input type="text" id="ob-name" placeholder="Tu nombre" maxlength="30" value="${escapeHtml(data.name)}" />
        </div>
        <button type="button" class="btn btn-primary btn-block" id="ob-next">Continuar</button>
      `;
    }
    if (step === "ingreso") {
      return `
        <div class="brand-mark">📈</div>
        <h1 style="text-align:center;font-size:1.2rem;font-weight:700">¿Cuál es tu ingreso mensual aproximado?</h1>
        <p style="text-align:center;color:var(--ink-secondary);font-size:0.85rem">Es solo para darte mejores referencias más adelante. Puedes omitir esto.</p>
        <div class="field">
          <label for="ob-ingreso">Ingreso mensual aproximado (COP)</label>
          <input type="number" id="ob-ingreso" inputmode="numeric" min="0" step="1" placeholder="Ej. 2000000" value="${data.ingresoMensual}" />
        </div>
        <button type="button" class="btn btn-primary btn-block" id="ob-next">Continuar</button>
        <button type="button" class="btn btn-ghost btn-block" id="ob-skip">Omitir</button>
      `;
    }
    if (step === "objetivo") {
      return `
        <div class="brand-mark">🎯</div>
        <h1 style="text-align:center;font-size:1.2rem;font-weight:700">¿Cuál es tu objetivo principal?</h1>
        <div class="option-list">
          ${OBJETIVOS.map(
            (o) => `<button type="button" class="option-card ${data.objetivo === o.key ? "selected" : ""}" data-obj="${o.key}">
              <span class="emoji">${o.emoji}</span><span class="txt">${o.label}</span>
            </button>`
          ).join("")}
        </div>
        <button type="button" class="btn btn-primary btn-block" id="ob-next">Continuar</button>
      `;
    }
    if (step === "pin") {
      return `
        <div class="brand-mark">🔒</div>
        <h1 style="text-align:center;font-size:1.2rem;font-weight:700">Protege tu app con un PIN</h1>
        <p style="text-align:center;color:var(--ink-secondary);font-size:0.85rem">Es un candado local para que otras personas no vean tus datos si toman tu celular. No cifra la información ni es una cuenta en la nube.</p>
        <div class="option-list">
          <button type="button" class="option-card" data-pin="yes"><span class="emoji">🔐</span><span class="txt">Sí, crear un PIN</span></button>
          <button type="button" class="option-card" data-pin="no"><span class="emoji">➡️</span><span class="txt">No por ahora</span></button>
        </div>
      `;
    }
    // espacios
    return `
      <div class="brand-mark">🗂️</div>
      <h1 style="text-align:center;font-size:1.2rem;font-weight:700">Tus espacios de dinero</h1>
      <p style="text-align:center;color:var(--ink-secondary);font-size:0.85rem">Ya te dejamos estos tres listos. Ponles el nombre que prefieras o agrega más.</p>
      <div id="ob-spaces" style="display:flex;flex-direction:column;gap:10px">
        ${data.spaces
          .map(
            (s, i) => `
          <div class="option-card" style="cursor:default">
            <span class="emoji">${s.icon}</span>
            <input type="text" class="space-name-input" data-idx="${i}" value="${escapeHtml(s.name)}" maxlength="24" style="border:none;background:transparent;font-weight:600;font-size:0.92rem;flex:1;color:var(--ink)" />
            ${data.spaces.length > 1 ? `<button type="button" class="icon-btn ghost" data-remove="${i}">✕</button>` : ""}
          </div>`
          )
          .join("")}
      </div>
      <button type="button" class="btn btn-secondary btn-block" id="ob-add-space">+ Agregar otro espacio</button>
      <button type="button" class="btn btn-primary btn-block" id="ob-finish">Empezar a usar la app</button>
    `;
  }

  function wire(step) {
    const next = container.querySelector("#ob-next");
    if (next) next.addEventListener("click", () => handleNext(step));
    const skip = container.querySelector("#ob-skip");
    if (skip) skip.addEventListener("click", () => go(1));

    if (step === "objetivo") {
      container.querySelectorAll("[data-obj]").forEach((btn) =>
        btn.addEventListener("click", () => {
          data.objetivo = btn.dataset.obj;
          paint();
        })
      );
    }

    if (step === "pin") {
      container.querySelector('[data-pin="no"]').addEventListener("click", () => go(1));
      container.querySelector('[data-pin="yes"]').addEventListener("click", () => {
        renderLock(container, {
          mode: "create",
          onCancel: () => paint(),
          onSuccess: (hashBundle) => {
            data.pinBundle = hashBundle;
            showToast("PIN creado");
            go(1);
          },
        });
      });
    }

    if (step === "espacios") {
      container.querySelectorAll(".space-name-input").forEach((input) =>
        input.addEventListener("input", () => {
          data.spaces[Number(input.dataset.idx)].name = input.value;
        })
      );
      container.querySelectorAll("[data-remove]").forEach((btn) =>
        btn.addEventListener("click", () => {
          data.spaces.splice(Number(btn.dataset.remove), 1);
          paint();
        })
      );
      container.querySelector("#ob-add-space").addEventListener("click", () => {
        const nextSlot = (data.spaces.length % 8) + 1;
        const emoji = EMOJI_CHOICES[data.spaces.length % EMOJI_CHOICES.length];
        data.spaces.push({ name: "", icon: emoji, colorSlot: nextSlot });
        paint();
      });
      container.querySelector("#ob-finish").addEventListener("click", finish);
    }
  }

  function handleNext(step) {
    if (step === "bienvenida") {
      const nameInput = container.querySelector("#ob-name");
      data.name = nameInput.value.trim();
      if (!data.name) {
        nameInput.focus();
        showToast("Cuéntanos cómo te llamas");
        return;
      }
    }
    if (step === "ingreso") {
      data.ingresoMensual = container.querySelector("#ob-ingreso").value;
    }
    go(1);
  }

  async function finish() {
    const validSpaces = data.spaces.filter((s) => s.name && s.name.trim());
    if (!validSpaces.length) {
      showToast("Agrega al menos un espacio de dinero");
      return;
    }
    const finishBtn = container.querySelector("#ob-finish");
    if (finishBtn) finishBtn.disabled = true;

    await saveProfile({
      name: data.name || "Tú",
      currency: "COP",
      onboarded: true,
      onboardingAnswers: {
        ingresoMensualAprox: data.ingresoMensual ? Number(data.ingresoMensual) : null,
        objetivo: data.objetivo,
      },
      ...(data.pinBundle || {}),
      createdAt: Date.now(),
    });
    for (const s of validSpaces) {
      await createSpace({ name: s.name.trim(), icon: s.icon, colorSlot: s.colorSlot, includeInTotal: true });
    }
    onComplete();
  }
}
