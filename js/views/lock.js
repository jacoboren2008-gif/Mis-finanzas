// Pantalla de PIN — candado local de privacidad (no es una cuenta en la nube ni
// cifra los datos; solo evita que alguien que tome el celular vea tus finanzas
// a simple vista). Se usa tanto para desbloquear como para crear/cambiar el PIN.
import { verifyPin, hashPin } from "../crypto-pin.js";
import { getProfile, wipeAllData } from "../db.js";
import { confirmDialog } from "../components/modal.js";

const PIN_LEN = 4;

export function renderLock(container, { mode = "unlock", onSuccess, onCancel } = {}) {
  let phase = mode === "create" ? "create-first" : "unlock";
  let entered = "";
  let firstPin = "";
  let busy = false;

  paint();

  function titleFor(p) {
    if (p === "unlock") return "Ingresa tu PIN";
    if (p === "create-first") return "Crea un PIN de 4 dígitos";
    return "Confirma tu PIN";
  }

  function dotsHtml(count) {
    return Array.from({ length: PIN_LEN })
      .map((_, i) => `<div class="p ${i < count ? "filled" : ""}"></div>`)
      .join("");
  }

  function paint() {
    container.innerHTML = `
      <div class="centered-flow">
        ${onCancel ? '<button type="button" class="icon-btn ghost" id="lock-cancel" style="position:fixed;top:calc(env(safe-area-inset-top,0px) + 14px);right:16px">✕</button>' : ""}
        <div class="brand-mark">🔒</div>
        <h1 style="text-align:center;font-size:1.2rem;font-weight:700">${titleFor(phase)}</h1>
        <div class="pin-dots" id="pin-dots">${dotsHtml(0)}</div>
        <div id="pin-error" style="text-align:center;color:var(--status-critical);font-size:0.85rem;min-height:20px"></div>
        <div class="keypad" id="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}">${n}</button>`).join("")}
          <button type="button" class="wide" ${mode === "unlock" ? 'data-k="forgot"' : 'style="visibility:hidden"'}>¿Olvidaste?</button>
          <button type="button" data-k="0">0</button>
          <button type="button" class="wide" data-k="back">⌫</button>
        </div>
      </div>
    `;
    container.querySelectorAll("[data-k]").forEach((btn) => btn.addEventListener("click", () => handleKey(btn.dataset.k)));
    const cancelBtn = container.querySelector("#lock-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
  }

  function updateDots() {
    const el = container.querySelector("#pin-dots");
    if (el) el.innerHTML = dotsHtml(entered.length);
  }

  async function handleKey(key) {
    if (busy) return;
    if (key === "back") {
      entered = entered.slice(0, -1);
      updateDots();
      return;
    }
    if (key === "forgot") {
      await handleForgot();
      return;
    }
    if (!/^[0-9]$/.test(key) || entered.length >= PIN_LEN) return;
    entered += key;
    updateDots();
    if (entered.length === PIN_LEN) {
      busy = true;
      await submit();
      busy = false;
    }
  }

  async function submit() {
    if (phase === "unlock") {
      const profile = await getProfile();
      const ok = profile && profile.pinHash ? await verifyPin(entered, profile) : true;
      if (ok) {
        onSuccess && onSuccess();
      } else {
        showError("PIN incorrecto");
      }
      return;
    }
    if (phase === "create-first") {
      firstPin = entered;
      entered = "";
      phase = "create-confirm";
      paint();
      return;
    }
    if (phase === "create-confirm") {
      if (entered !== firstPin) {
        firstPin = "";
        entered = "";
        phase = "create-first";
        paint();
        container.querySelector("#pin-error").textContent = "No coincide, intenta de nuevo";
        return;
      }
      const hashBundle = await hashPin(entered);
      onSuccess && onSuccess(hashBundle);
    }
  }

  function showError(msg) {
    entered = "";
    updateDots();
    const errEl = container.querySelector("#pin-error");
    if (errEl) errEl.textContent = msg;
  }

  async function handleForgot() {
    const ok = await confirmDialog({
      title: "Olvidé mi PIN",
      message:
        "No hay forma de recuperar tu PIN sin borrar los datos locales (esta app no usa servidor). Si tienes un respaldo exportado, podrás restaurarlo después desde Perfil. ¿Borrar todos los datos de este dispositivo y empezar de nuevo?",
      okText: "Borrar todo",
      danger: true,
    });
    if (!ok) return;
    await wipeAllData();
    location.reload();
  }
}
