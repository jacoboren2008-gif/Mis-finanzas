// Gráficas SVG hechas a mano — sin librerías externas. Especificación de trazos
// (barras redondeadas solo en el extremo, gap de 2px, gridline hairline, tooltip
// por barra) según la guía interna de dataviz. Colores: ver css/styles.css.
import { formatMoney, formatCompact } from "./format.js";
import { escapeHtml } from "./components/modal.js";

function roundedBarPath(x, y, w, h, r, corners) {
  const rad = Math.max(0, Math.min(r, w / 2, Math.max(h, 0.01)));
  const { tl, tr, br, bl } = corners;
  return [
    `M${x + (tl ? rad : 0)},${y}`,
    `H${x + w - (tr ? rad : 0)}`,
    tr ? `A${rad},${rad} 0 0 1 ${x + w},${y + rad}` : "",
    `V${y + h - (br ? rad : 0)}`,
    br ? `A${rad},${rad} 0 0 1 ${x + w - rad},${y + h}` : "",
    `H${x + (bl ? rad : 0)}`,
    bl ? `A${rad},${rad} 0 0 1 ${x},${y + h - rad}` : "",
    `V${y + (tl ? rad : 0)}`,
    tl ? `A${rad},${rad} 0 0 1 ${x + rad},${y}` : "",
    "Z",
  ].join(" ");
}

function attachTooltip(wrap) {
  let tipEl = wrap.querySelector(".chart-tooltip");
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "chart-tooltip";
    tipEl.style.display = "none";
    wrap.appendChild(tipEl);
  }
  function show(target, text) {
    const wrapRect = wrap.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    tipEl.textContent = text;
    tipEl.style.left = rect.left - wrapRect.left + rect.width / 2 + "px";
    tipEl.style.top = rect.top - wrapRect.top + "px";
    tipEl.style.display = "block";
  }
  function hide() {
    tipEl.style.display = "none";
  }
  return { show, hide };
}

// months: [{ ym, label, ingreso, gasto }]
export function renderMonthlyDivergingChart(mount, months) {
  const W = 560,
    H = 230,
    marginTop = 20,
    marginBottom = 30,
    marginX = 8;
  const plotH = H - marginTop - marginBottom;
  const midY = marginTop + plotH / 2;
  const maxVal = Math.max(1, ...months.map((m) => Math.max(m.ingreso, m.gasto)));
  const n = Math.max(1, months.length);
  const slot = (W - marginX * 2) / n;
  const barW = Math.min(18, slot * 0.34);
  const gap = 3;
  const halfPlot = plotH / 2 - 6;

  let maxIngresoIdx = 0,
    maxGastoIdx = 0;
  months.forEach((m, i) => {
    if (m.ingreso > months[maxIngresoIdx].ingreso) maxIngresoIdx = i;
    if (m.gasto > months[maxGastoIdx].gasto) maxGastoIdx = i;
  });

  let bars = "";
  let labels = "";
  months.forEach((m, i) => {
    const cx = marginX + slot * i + slot / 2;
    const ingH = maxVal ? (m.ingreso / maxVal) * halfPlot : 0;
    const gasH = maxVal ? (m.gasto / maxVal) * halfPlot : 0;
    const xIng = cx - gap / 2 - barW;
    const xGas = cx + gap / 2;

    if (m.ingreso > 0) {
      const d = roundedBarPath(xIng, midY - ingH, barW, ingH, 4, { tl: true, tr: true, br: false, bl: false });
      bars += `<path d="${d}" fill="var(--div-pos)" data-amount="${m.ingreso}" data-label="${escapeHtml(m.label)} · Ingresos" class="bar-mark"></path>`;
    }
    if (m.gasto > 0) {
      const d = roundedBarPath(xGas, midY, barW, gasH, 4, { tl: false, tr: false, br: true, bl: true });
      bars += `<path d="${d}" fill="var(--div-neg)" data-amount="${m.gasto}" data-label="${escapeHtml(m.label)} · Gastos" class="bar-mark"></path>`;
    }
    labels += `<text x="${cx}" y="${H - 12}" text-anchor="middle" font-size="9" fill="var(--ink-muted)">${escapeHtml(m.label)}</text>`;

    if (i === maxIngresoIdx && m.ingreso > 0) {
      labels += `<text x="${cx}" y="${midY - ingH - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink-secondary)">${formatCompact(m.ingreso)}</text>`;
    }
    if (i === maxGastoIdx && m.gasto > 0) {
      labels += `<text x="${cx}" y="${midY + gasH + 13}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink-secondary)">${formatCompact(m.gasto)}</text>`;
    }
  });

  mount.innerHTML = `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Ingresos y gastos por mes">
        <line x1="${marginX}" y1="${midY}" x2="${W - marginX}" y2="${midY}" stroke="var(--baseline)" stroke-width="1" />
        ${bars}
        ${labels}
      </svg>
    </div>
    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style="background:var(--div-pos)"></span>Ingresos</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--div-neg)"></span>Gastos</span>
    </div>
  `;

  const wrap = mount.querySelector(".chart-wrap");
  const tooltip = attachTooltip(wrap);
  wrap.querySelectorAll(".bar-mark").forEach((bar) => {
    const showTip = () => tooltip.show(bar, `${bar.dataset.label}: ${formatMoney(Number(bar.dataset.amount))}`);
    bar.addEventListener("pointerenter", showTip);
    bar.addEventListener("click", showTip);
    bar.addEventListener("pointerleave", tooltip.hide);
  });
}

// items: [{ name, icon, amount, colorVar }] ya ordenados desc; incluye "Otros" si aplica
export function renderCategoryBars(mount, items) {
  const max = Math.max(1, ...items.map((it) => it.amount));
  mount.innerHTML = items
    .map(
      (it) => `
    <div class="category-bar-row">
      <span class="cat-label">${it.icon || "🏷️"} ${escapeHtml(it.name)}</span>
      <span class="cat-track"><span class="cat-fill" style="width:${(it.amount / max) * 100}%;background:${it.colorVar}"></span></span>
      <span class="cat-value">${formatMoney(it.amount)}</span>
    </div>
  `
    )
    .join("");
}
