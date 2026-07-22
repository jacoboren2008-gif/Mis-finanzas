import { formatMoney } from "../format.js";
import { escapeHtml } from "./modal.js";

export function renderSpaceCard(space, { onOpen, onIngreso, onGasto, meterHtml = "" }) {
  const el = document.createElement("div");
  el.className = "space-card";
  el.style.setProperty("--space-color", `var(--cat-${space.colorSlot || 1})`);
  const balanceClass = "balance" + (space.balance < 0 ? " negativo" : "");

  el.innerHTML = `
    <div class="space-card-head">
      <div class="space-icon">${space.icon || "💰"}</div>
      <div class="space-card-title">
        <div class="name">${escapeHtml(space.name)}</div>
        <div class="${balanceClass}">${formatMoney(space.balance)}</div>
      </div>
      ${!space.includeInTotal ? '<span class="badge-excluida">No incluido</span>' : ""}
    </div>
    ${meterHtml}
    <div class="space-card-actions">
      <button class="btn btn-secondary btn-sm" data-act="gasto" type="button">− Gasto</button>
      <button class="btn btn-secondary btn-sm" data-act="ingreso" type="button">+ Ingreso</button>
    </div>
  `;
  el.querySelector('[data-act="ingreso"]').addEventListener("click", (e) => {
    e.stopPropagation();
    onIngreso(space);
  });
  el.querySelector('[data-act="gasto"]').addEventListener("click", (e) => {
    e.stopPropagation();
    onGasto(space);
  });
  el.addEventListener("click", () => onOpen(space));
  return el;
}
