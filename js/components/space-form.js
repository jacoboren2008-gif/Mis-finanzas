import { createSpace, updateSpace } from "../db.js";
import { openModal, confirmDialog, escapeHtml } from "./modal.js";
import { showToast } from "./toast.js";
import { bus } from "../state.js";
import { todayStr } from "../format.js";

const EMOJI_CHOICES = ["💼", "💵", "📱", "🏦", "🎯", "🐷", "🧾", "✈️", "🏠", "🎓", "🚗", "🎁", "💳", "🛒", "❤️", "⭐"];

export function openSpaceForm({ editing = null, onSaved } = {}) {
  const state = {
    name: editing?.name || "",
    icon: editing?.icon || EMOJI_CHOICES[0],
    colorSlot: editing?.colorSlot || 1,
    includeInTotal: editing ? editing.includeInTotal !== false : true,
    goalEnabled: !!editing?.goal,
    goalType: editing?.goal?.type || "ahorro",
    goalAmount: editing?.goal?.amount || "",
    goalDeadline: editing?.goal?.deadline || "",
    goalNote: editing?.goal?.note || "",
  };

  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "18px";
  body.innerHTML = formHtml(state);

  const { close } = openModal({ title: editing ? "Editar espacio" : "Nuevo espacio", content: body });
  wire();

  function formHtml(s) {
    return `
      <div class="field">
        <label for="sf-name">Nombre</label>
        <input type="text" id="sf-name" maxlength="24" value="${escapeHtml(s.name)}" placeholder="Ej. Ahorros viaje" />
      </div>
      <div class="field">
        <label>Ícono</label>
        <div class="emoji-picker">${EMOJI_CHOICES.map((e) => `<button type="button" class="emoji-opt ${e === s.icon ? "selected" : ""}" data-emoji="${e}">${e}</button>`).join("")}</div>
      </div>
      <div class="field">
        <label>Color</label>
        <div class="color-picker">${[1, 2, 3, 4, 5, 6, 7, 8]
          .map((n) => `<button type="button" class="color-swatch ${n === s.colorSlot ? "selected" : ""}" data-color="${n}" style="background:var(--cat-${n})"></button>`)
          .join("")}</div>
      </div>
      <div class="field" style="flex-direction:row;align-items:center;justify-content:space-between">
        <label style="margin:0">Incluir en el total</label>
        <button type="button" class="switch ${s.includeInTotal ? "on" : ""}" id="sf-include"></button>
      </div>
      <div class="field" style="flex-direction:row;align-items:center;justify-content:space-between">
        <label style="margin:0">Ponerle una meta</label>
        <button type="button" class="switch ${s.goalEnabled ? "on" : ""}" id="sf-goal-toggle"></button>
      </div>
      <div id="sf-goal-fields" style="display:${s.goalEnabled ? "flex" : "none"};flex-direction:column;gap:14px">
        <div class="segmented">
          <button type="button" class="${s.goalType === "ahorro" ? "active" : ""}" data-goal-type="ahorro">🐷 Ahorro</button>
          <button type="button" class="${s.goalType === "limite_gasto" ? "active" : ""}" data-goal-type="limite_gasto">🚧 Límite mensual</button>
        </div>
        <div class="field">
          <label id="sf-amount-label" for="sf-goal-amount">${s.goalType === "ahorro" ? "Monto meta" : "Límite de gasto mensual"}</label>
          <input type="number" id="sf-goal-amount" min="1" step="1" value="${s.goalAmount}" placeholder="0" />
        </div>
        <div class="field" id="sf-deadline-field" style="display:${s.goalType === "limite_gasto" ? "none" : "flex"}">
          <label for="sf-goal-deadline">Fecha límite (opcional)</label>
          <input type="date" id="sf-goal-deadline" value="${s.goalDeadline || ""}" min="${todayStr()}" />
        </div>
        <div class="field">
          <label for="sf-goal-note">Nota (opcional)</label>
          <input type="text" id="sf-goal-note" maxlength="60" value="${escapeHtml(s.goalNote)}" placeholder="Ej. Viaje a Cartagena" />
        </div>
      </div>
      <div id="sf-error" class="field-error"></div>
      <button type="button" class="btn btn-primary btn-block" id="sf-save">${editing ? "Guardar cambios" : "Crear espacio"}</button>
      ${editing ? `<button type="button" class="btn btn-secondary btn-block" id="sf-archive">${editing.archived ? "Reactivar espacio" : "Archivar espacio"}</button>` : ""}
    `;
  }

  function wire() {
    body.querySelectorAll("[data-emoji]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.icon = btn.dataset.emoji;
        body.querySelectorAll("[data-emoji]").forEach((b) => b.classList.toggle("selected", b === btn));
      })
    );
    body.querySelectorAll("[data-color]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.colorSlot = Number(btn.dataset.color);
        body.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("selected", b === btn));
      })
    );
    body.querySelector("#sf-include").addEventListener("click", (e) => {
      state.includeInTotal = e.currentTarget.classList.toggle("on");
    });
    body.querySelector("#sf-goal-toggle").addEventListener("click", (e) => {
      state.goalEnabled = e.currentTarget.classList.toggle("on");
      body.querySelector("#sf-goal-fields").style.display = state.goalEnabled ? "flex" : "none";
    });
    body.querySelectorAll("[data-goal-type]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.goalType = btn.dataset.goalType;
        body.querySelectorAll("[data-goal-type]").forEach((b) => b.classList.toggle("active", b === btn));
        body.querySelector("#sf-amount-label").textContent = state.goalType === "ahorro" ? "Monto meta" : "Límite de gasto mensual";
        body.querySelector("#sf-deadline-field").style.display = state.goalType === "limite_gasto" ? "none" : "flex";
      })
    );
    body.querySelector("#sf-save").addEventListener("click", save);
    const archiveBtn = body.querySelector("#sf-archive");
    if (archiveBtn) archiveBtn.addEventListener("click", toggleArchive);
  }

  async function save() {
    const name = body.querySelector("#sf-name").value.trim();
    const errEl = body.querySelector("#sf-error");
    if (!name) {
      errEl.textContent = "Ponle un nombre al espacio";
      return;
    }

    let goal = null;
    if (state.goalEnabled) {
      const amount = Number(body.querySelector("#sf-goal-amount").value);
      if (!amount || amount <= 0) {
        errEl.textContent = "La meta necesita un monto mayor a 0";
        return;
      }
      goal = {
        type: state.goalType,
        amount,
        deadline: state.goalType === "ahorro" ? body.querySelector("#sf-goal-deadline").value || null : null,
        note: body.querySelector("#sf-goal-note").value.trim(),
      };
    }
    errEl.textContent = "";

    const payload = { name, icon: state.icon, colorSlot: state.colorSlot, includeInTotal: state.includeInTotal, goal };
    try {
      if (editing) await updateSpace(editing.id, payload);
      else await createSpace(payload);
      showToast(editing ? "Espacio actualizado" : "Espacio creado");
      bus.emit("data:changed");
      close();
      onSaved && onSaved();
    } catch (err) {
      errEl.textContent = "No se pudo guardar: " + err.message;
    }
  }

  async function toggleArchive() {
    const willArchive = !editing.archived;
    if (willArchive) {
      const ok = await confirmDialog({
        title: "Archivar espacio",
        message: `"${editing.name}" dejará de aparecer en tu dashboard y no sumará al total, pero su historial se conserva. Puedes reactivarlo cuando quieras desde Perfil.`,
        okText: "Archivar",
      });
      if (!ok) return;
    }
    await updateSpace(editing.id, { archived: willArchive });
    showToast(willArchive ? "Espacio archivado" : "Espacio reactivado");
    bus.emit("data:changed");
    close();
    onSaved && onSaved();
  }
}
