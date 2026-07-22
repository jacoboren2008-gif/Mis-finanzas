import { getSpace, listTransactions, listCategories } from "../db.js";
import { formatMoney, relativeDay } from "../format.js";
import { bottomNavHtml } from "../components/nav.js";
import { openTransactionForm } from "../components/transaction-form.js";
import { openSpaceForm } from "../components/space-form.js";
import { getGoalProgress, renderMeterHtml } from "../components/goal-progress.js";
import { bus } from "../state.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../components/modal.js";

const PAGE_SIZE = 30;

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export async function renderSpaceDetail(container, params) {
  if (typeof container._cleanup === "function") {
    container._cleanup();
    container._cleanup = null;
  }

  let space = await getSpace(params.id);
  if (!space) {
    navigate("/dashboard");
    return;
  }

  const filters = { type: "", category: "", search: "", dateFrom: "", dateTo: "" };
  let visibleCount = PAGE_SIZE;

  async function paint() {
    const [progress, categories] = await Promise.all([getGoalProgress(space), listCategories({})]);
    container.innerHTML = `
      <div class="page">
        <div class="topbar">
          <button class="icon-btn" id="back-btn" type="button" aria-label="Volver">←</button>
          <h1>${space.icon} ${escapeHtml(space.name)}</h1>
          <button class="icon-btn" id="edit-btn" type="button" aria-label="Editar espacio">✏️</button>
        </div>
        <div class="hero-total" style="background:linear-gradient(135deg, var(--cat-${space.colorSlot || 1}), color-mix(in srgb, var(--cat-${space.colorSlot || 1}) 65%, black))">
          <div class="label">Saldo</div>
          <div class="value">${formatMoney(space.balance)}</div>
        </div>
        ${progress ? `<div class="card">${renderMeterHtml(progress)}</div>` : ""}

        <div class="section-title">Historial</div>
        <div class="filter-row">
          <button type="button" class="chip ${filters.type === "" ? "active" : ""}" data-type="">Todo</button>
          <button type="button" class="chip ${filters.type === "ingreso" ? "active" : ""}" data-type="ingreso">Ingresos</button>
          <button type="button" class="chip ${filters.type === "gasto" ? "active" : ""}" data-type="gasto">Gastos</button>
        </div>
        <div class="search-box">
          <span>🔎</span>
          <input type="text" id="search-input" placeholder="Buscar por nombre..." value="${escapeHtml(filters.search)}" />
        </div>
        <div class="filter-row">
          <button type="button" class="chip ${filters.category === "" ? "active" : ""}" data-cat="">Todas las categorías</button>
          ${categories.map((c) => `<button type="button" class="chip ${filters.category === c.name ? "active" : ""}" data-cat="${escapeHtml(c.name)}">${c.icon} ${escapeHtml(c.name)}</button>`).join("")}
        </div>
        <div style="display:flex;gap:10px">
          <div class="field" style="flex:1"><label for="date-from">Desde</label><input type="date" id="date-from" value="${filters.dateFrom}" /></div>
          <div class="field" style="flex:1"><label for="date-to">Hasta</label><input type="date" id="date-to" value="${filters.dateTo}" /></div>
        </div>

        <div class="card" id="tx-list-card"><div class="tx-list" id="tx-list"></div></div>
      </div>
      <button class="fab" id="fab-add" type="button" aria-label="Nuevo movimiento">+</button>
      ${bottomNavHtml("/dashboard")}
    `;
    wireStatic();
    await paintList();
  }

  async function paintList() {
    const txs = await listTransactions({
      spaceId: space.id,
      type: filters.type || undefined,
      category: filters.category || undefined,
      search: filters.search || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    });
    const listEl = container.querySelector("#tx-list");
    if (!listEl) return;
    if (!txs.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="emoji">🧾</div><p>No hay movimientos con estos filtros.</p></div>`;
      return;
    }
    const visible = txs.slice(0, visibleCount);
    listEl.innerHTML =
      visible.map(rowHtml).join("") +
      (txs.length > visible.length
        ? `<button type="button" class="link-btn" id="load-more">Ver más (${txs.length - visible.length} restantes)</button>`
        : "");
    listEl.querySelectorAll("[data-tx]").forEach((row) =>
      row.addEventListener("click", () => {
        const tx = txs.find((t) => t.id === row.dataset.tx);
        if (tx) openTransactionForm({ editing: tx });
      })
    );
    const loadMore = listEl.querySelector("#load-more");
    if (loadMore)
      loadMore.addEventListener("click", () => {
        visibleCount += PAGE_SIZE;
        paintList();
      });
  }

  function rowHtml(t) {
    return `
      <div class="tx-row" data-tx="${t.id}" style="cursor:pointer">
        <div class="tx-icon">${t.type === "ingreso" ? "↑" : "↓"}</div>
        <div class="tx-info">
          <div class="name">${escapeHtml(t.name)}</div>
          <div class="meta">${relativeDay(t.date)} · ${escapeHtml(t.category)}${t.recurringId ? " · 🔁" : ""}</div>
        </div>
        <div class="tx-amount ${t.type}">${t.type === "ingreso" ? "+" : "-"}${formatMoney(Math.abs(t.amount))}</div>
      </div>
    `;
  }

  function wireStatic() {
    container.querySelector("#back-btn").addEventListener("click", () => navigate("/dashboard"));
    container.querySelector("#edit-btn").addEventListener("click", () =>
      openSpaceForm({
        editing: space,
        onSaved: async () => {
          const fresh = await getSpace(space.id);
          if (!fresh || fresh.archived) {
            navigate("/dashboard");
            return;
          }
          space = fresh;
          paint();
        },
      })
    );
    container.querySelector("#fab-add").addEventListener("click", () => openTransactionForm({ spaceId: space.id, lockSpace: true }));
    container.querySelectorAll(".chip[data-type]").forEach((btn) =>
      btn.addEventListener("click", () => {
        filters.type = btn.dataset.type;
        visibleCount = PAGE_SIZE;
        paint();
      })
    );
    container.querySelectorAll(".chip[data-cat]").forEach((btn) =>
      btn.addEventListener("click", () => {
        filters.category = btn.dataset.cat;
        visibleCount = PAGE_SIZE;
        paint();
      })
    );
    container.querySelector("#search-input").addEventListener(
      "input",
      debounce((e) => {
        filters.search = e.target.value;
        visibleCount = PAGE_SIZE;
        paintList();
      }, 300)
    );
    container.querySelector("#date-from").addEventListener("change", (e) => {
      filters.dateFrom = e.target.value;
      visibleCount = PAGE_SIZE;
      paintList();
    });
    container.querySelector("#date-to").addEventListener("change", (e) => {
      filters.dateTo = e.target.value;
      visibleCount = PAGE_SIZE;
      paintList();
    });
  }

  await paint();

  container._cleanup = bus.on("data:changed", async () => {
    const fresh = await getSpace(space.id);
    if (!fresh) {
      navigate("/dashboard");
      return;
    }
    space = fresh;
    await paint();
  });
}
