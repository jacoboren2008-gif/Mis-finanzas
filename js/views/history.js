import { listSpaces, listTransactions, listCategories } from "../db.js";
import { formatMoney, formatMoneySigned, monthShortLabel, relativeDay } from "../format.js";
import { bottomNavHtml } from "../components/nav.js";
import { openTransactionForm } from "../components/transaction-form.js";
import { escapeHtml } from "../components/modal.js";
import { renderMonthlyDivergingChart, renderCategoryBars } from "../charts.js";
import { bus } from "../state.js";

const PAGE_SIZE = 30;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

export async function renderHistory(container) {
  if (typeof container._cleanup === "function") {
    container._cleanup();
    container._cleanup = null;
  }

  const allSpaces = await listSpaces({ includeArchived: true });
  const allCategories = await listCategories({});
  const iconByCategory = new Map(allCategories.map((c) => [c.name, c.icon]));

  const filters = { year: String(CURRENT_YEAR), type: "", category: "", search: "", deselected: new Set() };
  let visibleCount = PAGE_SIZE;
  let showMonthlyTable = false;
  let showCategoryTable = false;

  async function computeData() {
    const year = filters.year;
    const dateFrom = year === "todos" ? undefined : `${year}-01-01`;
    const dateTo = year === "todos" ? undefined : `${year}-12-31`;
    const spaceIds = filters.deselected.size ? allSpaces.filter((s) => !filters.deselected.has(s.id)).map((s) => s.id) : undefined;
    const txs = await listTransactions({
      dateFrom,
      dateTo,
      spaceIds,
      type: filters.type || undefined,
      category: filters.category || undefined,
      search: filters.search || undefined,
    });

    const totalIngreso = txs.filter((t) => t.type === "ingreso").reduce((s, t) => s + t.amount, 0);
    const totalGasto = txs.filter((t) => t.type === "gasto").reduce((s, t) => s + Math.abs(t.amount), 0);

    let buckets;
    if (year === "todos") {
      const byYear = new Map();
      for (const t of txs) {
        const y = t.date.slice(0, 4);
        if (!byYear.has(y)) byYear.set(y, { ingreso: 0, gasto: 0 });
        const b = byYear.get(y);
        if (t.type === "ingreso") b.ingreso += t.amount;
        else b.gasto += Math.abs(t.amount);
      }
      buckets = Array.from(byYear.entries())
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([y, v]) => ({ key: y, label: y, ingreso: v.ingreso, gasto: v.gasto }));
      if (!buckets.length) buckets = [{ key: String(CURRENT_YEAR), label: String(CURRENT_YEAR), ingreso: 0, gasto: 0 }];
    } else {
      const byMonth = new Map();
      for (let m = 1; m <= 12; m++) byMonth.set(String(m).padStart(2, "0"), { ingreso: 0, gasto: 0 });
      for (const t of txs) {
        const mm = t.date.slice(5, 7);
        const b = byMonth.get(mm);
        if (!b) continue;
        if (t.type === "ingreso") b.ingreso += t.amount;
        else b.gasto += Math.abs(t.amount);
      }
      buckets = Array.from(byMonth.entries()).map(([mm, v]) => ({ key: mm, label: monthShortLabel(`${year}-${mm}`), ingreso: v.ingreso, gasto: v.gasto }));
    }

    const catMap = new Map();
    for (const t of txs) {
      if (t.type !== "gasto") continue;
      catMap.set(t.category, (catMap.get(t.category) || 0) + Math.abs(t.amount));
    }
    let catEntries = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    let raw;
    if (catEntries.length > 7) {
      const top = catEntries.slice(0, 7);
      const otherSum = catEntries.slice(7).reduce((s, [, v]) => s + v, 0);
      raw = [...top, ["Otros (varias categorías)", otherSum]];
    } else {
      raw = catEntries;
    }
    const categoryItems = raw.map(([name, amount], i) => ({
      name,
      amount,
      icon: iconByCategory.get(name) || "🏷️",
      colorVar: `var(--cat-${(i % 8) + 1})`,
    }));

    return { txs, totalIngreso, totalGasto, neto: totalIngreso - totalGasto, buckets, categoryItems };
  }

  async function paint() {
    const data = await computeData();

    container.innerHTML = `
      <div class="page">
        <div class="topbar"><h1>Historial y análisis</h1></div>

        <div class="filter-row" id="year-filter">
          ${YEAR_OPTIONS.map((y) => `<button type="button" class="chip ${filters.year === String(y) ? "active" : ""}" data-year="${y}">${y}</button>`).join("")}
          <button type="button" class="chip ${filters.year === "todos" ? "active" : ""}" data-year="todos">Todo</button>
        </div>

        <div class="stat-row">
          <div class="stat-tile ingreso"><span class="label">Ingresos</span><span class="value">${formatMoney(data.totalIngreso)}</span></div>
          <div class="stat-tile gasto"><span class="label">Gastos</span><span class="value">${formatMoney(data.totalGasto)}</span></div>
          <div class="stat-tile"><span class="label">Neto</span><span class="value" style="color:${data.neto >= 0 ? "var(--success-text)" : "var(--status-critical)"}">${formatMoneySigned(data.neto)}</span></div>
        </div>

        <div class="card chart-card">
          <div class="chart-head">
            <h3>Ingresos vs. gastos</h3>
            <button type="button" class="link-btn" id="toggle-monthly-table">${showMonthlyTable ? "Ver gráfica" : "Ver tabla"}</button>
          </div>
          <div id="monthly-chart-mount"></div>
        </div>

        <div class="card chart-card">
          <div class="chart-head">
            <h3>Gastos por categoría</h3>
            <button type="button" class="link-btn" id="toggle-category-table">${showCategoryTable ? "Ver gráfica" : "Ver tabla"}</button>
          </div>
          <div id="category-chart-mount"></div>
        </div>

        <div class="section-title">Filtrar movimientos</div>
        <div class="filter-row" id="space-filter">
          ${allSpaces.map((s) => `<button type="button" class="chip ${filters.deselected.has(s.id) ? "" : "active"}" data-space="${s.id}">${s.icon} ${escapeHtml(s.name)}</button>`).join("")}
        </div>
        <div class="filter-row">
          <button type="button" class="chip ${filters.type === "" ? "active" : ""}" data-type="">Todo</button>
          <button type="button" class="chip ${filters.type === "ingreso" ? "active" : ""}" data-type="ingreso">Ingresos</button>
          <button type="button" class="chip ${filters.type === "gasto" ? "active" : ""}" data-type="gasto">Gastos</button>
        </div>
        <div class="search-box">
          <span>🔎</span>
          <input type="text" id="search-input" placeholder="Buscar por nombre..." value="${escapeHtml(filters.search)}" />
        </div>

        <div class="section-title">Movimientos (${data.txs.length})</div>
        <div class="card">
          <div class="tx-list" id="tx-list"></div>
        </div>
        <button type="button" class="btn btn-secondary btn-block" id="export-csv">⬇️ Exportar este listado a CSV</button>
      </div>
      ${bottomNavHtml("/historial")}
    `;

    if (showMonthlyTable) renderMonthlyTable(container.querySelector("#monthly-chart-mount"), data.buckets);
    else renderMonthlyDivergingChart(container.querySelector("#monthly-chart-mount"), data.buckets);

    if (showCategoryTable) renderCategoryTable(container.querySelector("#category-chart-mount"), data.categoryItems);
    else if (data.categoryItems.length) renderCategoryBars(container.querySelector("#category-chart-mount"), data.categoryItems);
    else container.querySelector("#category-chart-mount").innerHTML = `<p style="color:var(--ink-muted);font-size:0.85rem;margin:0">Sin gastos en este período.</p>`;

    renderTxList(data.txs);
    wire(data);
  }

  function renderMonthlyTable(mount, buckets) {
    mount.innerHTML = `<div class="table-scroll"><table class="data-table">
      <thead><tr><th>Período</th><th class="num">Ingresos</th><th class="num">Gastos</th></tr></thead>
      <tbody>${buckets.map((b) => `<tr><td>${escapeHtml(b.label)}</td><td class="num">${formatMoney(b.ingreso)}</td><td class="num">${formatMoney(b.gasto)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  }

  function renderCategoryTable(mount, items) {
    if (!items.length) {
      mount.innerHTML = `<p style="color:var(--ink-muted);font-size:0.85rem;margin:0">Sin gastos en este período.</p>`;
      return;
    }
    mount.innerHTML = `<div class="table-scroll"><table class="data-table">
      <thead><tr><th>Categoría</th><th class="num">Monto</th></tr></thead>
      <tbody>${items.map((it) => `<tr><td>${it.icon} ${escapeHtml(it.name)}</td><td class="num">${formatMoney(it.amount)}</td></tr>`).join("")}</tbody>
    </table></div>`;
  }

  function renderTxList(txs) {
    const listEl = container.querySelector("#tx-list");
    if (!txs.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="emoji">🧾</div><p>No hay movimientos con estos filtros.</p></div>`;
      return;
    }
    const spaceById = Object.fromEntries(allSpaces.map((s) => [s.id, s]));
    const visible = txs.slice(0, visibleCount);
    listEl.innerHTML =
      visible.map((t) => rowHtml(t, spaceById[t.spaceId])).join("") +
      (txs.length > visible.length ? `<button type="button" class="link-btn" id="load-more">Ver más (${txs.length - visible.length} restantes)</button>` : "");
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
        renderTxList(txs);
      });
  }

  function rowHtml(t, space) {
    return `
      <div class="tx-row" data-tx="${t.id}" style="cursor:pointer">
        <div class="tx-icon">${space ? space.icon : "❔"}</div>
        <div class="tx-info">
          <div class="name">${escapeHtml(t.name)}</div>
          <div class="meta">${relativeDay(t.date)} · ${space ? escapeHtml(space.name) : "—"} · ${escapeHtml(t.category)}</div>
        </div>
        <div class="tx-amount ${t.type}">${t.type === "ingreso" ? "+" : "-"}${formatMoney(Math.abs(t.amount))}</div>
      </div>
    `;
  }

  function wire(data) {
    container.querySelectorAll("#year-filter [data-year]").forEach((btn) =>
      btn.addEventListener("click", () => {
        filters.year = btn.dataset.year;
        visibleCount = PAGE_SIZE;
        paint();
      })
    );
    container.querySelectorAll("#space-filter [data-space]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.dataset.space;
        if (filters.deselected.has(id)) filters.deselected.delete(id);
        else filters.deselected.add(id);
        visibleCount = PAGE_SIZE;
        paint();
      })
    );
    container.querySelectorAll(".chip[data-type]").forEach((btn) =>
      btn.addEventListener("click", () => {
        filters.type = btn.dataset.type;
        visibleCount = PAGE_SIZE;
        paint();
      })
    );
    container.querySelector("#search-input").addEventListener("change", (e) => {
      filters.search = e.target.value;
      visibleCount = PAGE_SIZE;
      paint();
    });
    container.querySelector("#toggle-monthly-table").addEventListener("click", () => {
      showMonthlyTable = !showMonthlyTable;
      paint();
    });
    container.querySelector("#toggle-category-table").addEventListener("click", () => {
      showCategoryTable = !showCategoryTable;
      paint();
    });
    container.querySelector("#export-csv").addEventListener("click", () => exportCsv(data.txs, allSpaces));
  }

  await paint();
  container._cleanup = bus.on("data:changed", paint);
}

function exportCsv(txs, spaces) {
  const spaceById = Object.fromEntries(spaces.map((s) => [s.id, s.name]));
  const header = ["Fecha", "Nombre", "Espacio", "Categoría", "Tipo", "Monto"];
  const rows = txs.map((t) => [t.date, t.name, spaceById[t.spaceId] || "", t.category, t.type, t.amount]);
  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movimientos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
