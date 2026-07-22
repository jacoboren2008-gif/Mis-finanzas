import { listSpaces, updateSpace } from "../db.js";
import { formatMoney } from "../format.js";
import { renderSpaceCard } from "../components/space-card.js";
import { getGoalProgress, renderMeterHtml } from "../components/goal-progress.js";
import { bottomNavHtml } from "../components/nav.js";
import { openTransactionForm } from "../components/transaction-form.js";
import { openModal, escapeHtml } from "../components/modal.js";
import { bus, appState } from "../state.js";
import { navigate } from "../router.js";

export async function renderDashboard(container) {
  if (typeof container._cleanup === "function") {
    container._cleanup();
    container._cleanup = null;
  }

  const profile = appState.get().profile;
  const spaces = await listSpaces();
  const included = spaces.filter((s) => s.includeInTotal);
  const total = included.reduce((sum, s) => sum + s.balance, 0);

  container.innerHTML = `
    <div class="page">
      <div class="topbar">
        <h1>Hola${profile && profile.name ? ", " + escapeHtml(profile.name) : ""} 👋</h1>
      </div>
      <div class="hero-total">
        <div class="label">Total disponible</div>
        <div class="value">${formatMoney(total)}</div>
        <button type="button" class="sub" id="toggle-total-info">🧮 ${included.length} de ${spaces.length} espacios incluidos</button>
      </div>
      <div class="section-title">Tus espacios</div>
      <div id="space-list" style="display:flex;flex-direction:column;gap:14px"></div>
    </div>
    <button class="fab" id="fab-add" type="button" aria-label="Nuevo movimiento">+</button>
    ${bottomNavHtml("/dashboard")}
  `;

  const listEl = container.querySelector("#space-list");
  if (!spaces.length) {
    listEl.innerHTML = emptyStateHtml();
  } else {
    for (const space of spaces) {
      const progress = await getGoalProgress(space);
      const card = renderSpaceCard(space, {
        onOpen: (s) => navigate(`/espacio/${s.id}`),
        onIngreso: (s) => openTransactionForm({ spaceId: s.id, lockSpace: true, type: "ingreso" }),
        onGasto: (s) => openTransactionForm({ spaceId: s.id, lockSpace: true, type: "gasto" }),
        meterHtml: renderMeterHtml(progress),
      });
      listEl.appendChild(card);
    }
  }

  container.querySelector("#fab-add").addEventListener("click", () => openTransactionForm({}));
  container.querySelector("#toggle-total-info").addEventListener("click", () => openTotalConfig(spaces));

  container._cleanup = bus.on("data:changed", () => renderDashboard(container));
}

function emptyStateHtml() {
  return `
    <div class="empty-state">
      <div class="emoji">🗂️</div>
      <h3>Aún no tienes espacios</h3>
      <p>Ve a tu Perfil para crear tu primer espacio de dinero.</p>
    </div>
  `;
}

function openTotalConfig(spaces) {
  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "4px";
  body.innerHTML = `
    <p style="color:var(--ink-secondary);font-size:0.85rem;margin:0 0 4px">Elige qué espacios suman al total de arriba. Los espacios archivados nunca suman.</p>
    ${spaces
      .map(
        (s) => `
      <div class="settings-row" style="cursor:default">
        <span class="emoji">${s.icon}</span>
        <span class="txt"><span class="t">${escapeHtml(s.name)}</span><span class="s">${formatMoney(s.balance)}</span></span>
        <button type="button" class="switch ${s.includeInTotal ? "on" : ""}" data-space="${s.id}"></button>
      </div>`
      )
      .join("")}
  `;
  openModal({ title: "Total del dashboard", content: body });
  body.querySelectorAll("[data-space]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const isOn = btn.classList.toggle("on");
      await updateSpace(btn.dataset.space, { includeInTotal: isOn });
      bus.emit("data:changed");
    });
  });
}
