import {
  listSpaces,
  listCategories,
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  getAllPending,
  applyRecurring,
  skipRecurring,
} from "../db.js";
import { formatMoney, formatDateShort, monthLabel, currentYearMonth, addMonthsToYearMonth, daysInMonth, resolvedDayNumber } from "../format.js";
import { bottomNavHtml } from "../components/nav.js";
import { openModal, confirmDialog, escapeHtml } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { bus } from "../state.js";

const DOW_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export async function renderCalendar(container) {
  if (typeof container._cleanup === "function") {
    container._cleanup();
    container._cleanup = null;
  }

  let viewYM = currentYearMonth();

  async function paint() {
    const [spaces, recurring, pending] = await Promise.all([listSpaces(), listRecurring(), getAllPending()]);
    const spaceById = Object.fromEntries(spaces.map((s) => [s.id, s]));
    const activeRecurring = recurring.filter((r) => r.active);
    const pausedRecurring = recurring.filter((r) => !r.active);

    container.innerHTML = `
      <div class="page">
        <div class="topbar"><h1>Calendario</h1></div>

        <div class="card">
          <div class="cal-head">
            <button type="button" class="icon-btn ghost" id="cal-prev">←</button>
            <h2>${monthLabel(viewYM)}</h2>
            <button type="button" class="icon-btn ghost" id="cal-next">→</button>
          </div>
          <div class="cal-grid" style="margin-top:10px">
            ${DOW_LABELS.map((d) => `<div class="cal-dow">${d}</div>`).join("")}
            ${monthCellsHtml(viewYM, activeRecurring)}
          </div>
        </div>

        ${
          pending.length
            ? `<div class="section-title">Pendientes de aplicar (${pending.length})</div>
               <div style="display:flex;flex-direction:column;gap:10px">${pending.map(pendingRowHtml).join("")}</div>`
            : `<div class="banner-warning"><span class="emoji">✅</span><span>No tienes movimientos recurrentes pendientes por aplicar.</span></div>`
        }

        <div class="section-title">Recurrentes activos</div>
        ${
          activeRecurring.length
            ? `<div style="display:flex;flex-direction:column;gap:10px">${activeRecurring.map((r) => recurringRowHtml(r, spaceById)).join("")}</div>`
            : `<div class="empty-state"><div class="emoji">🔁</div><p>Aún no tienes ingresos o gastos recurrentes. Agrega uno con el botón +.</p></div>`
        }

        ${
          pausedRecurring.length
            ? `<div class="section-title">Pausados</div><div style="display:flex;flex-direction:column;gap:10px">${pausedRecurring.map((r) => recurringRowHtml(r, spaceById)).join("")}</div>`
            : ""
        }
      </div>
      <button class="fab" id="fab-add-recurring" type="button" aria-label="Nuevo recurrente">+</button>
      ${bottomNavHtml("/calendario")}
    `;

    wire(spaces);
  }

  function monthCellsHtml(ym, activeRecurring) {
    const [y, m] = ym.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startDow = (first.getDay() + 6) % 7;
    const dim = daysInMonth(y, m);
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;

    const byDay = new Map();
    for (const rec of activeRecurring) {
      const day = resolvedDayNumber(rec.dayOfMonth, ym);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(rec);
    }

    let cells = "";
    for (let i = 0; i < startDow; i++) cells += `<div class="cal-day empty"></div>`;
    for (let d = 1; d <= dim; d++) {
      const items = byDay.get(d) || [];
      const isToday = isCurrentMonth && today.getDate() === d;
      const dots = items
        .slice(0, 4)
        .map((r) => `<span class="dot" style="background:${r.type === "ingreso" ? "var(--div-pos)" : "var(--div-neg)"}"></span>`)
        .join("");
      cells += `<div class="cal-day ${isToday ? "today" : ""}"><span>${d}</span><span class="dot-row">${dots}</span></div>`;
    }
    return cells;
  }

  function pendingRowHtml(p) {
    return `
      <div class="pending-item">
        <div class="tx-icon">${p.recurring.type === "ingreso" ? "↑" : "↓"}</div>
        <div class="info">
          <div class="t">${escapeHtml(p.recurring.name)} · ${monthLabel(p.yearMonth)}</div>
          <div class="s">${formatMoney(p.recurring.amount)} · vence ${formatDateShort(p.dueDate)}</div>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-sm btn-secondary" data-skip="${p.recurring.id}|${p.yearMonth}">Omitir</button>
          <button type="button" class="btn btn-sm btn-primary" data-apply="${p.recurring.id}|${p.yearMonth}">Aplicar</button>
        </div>
      </div>
    `;
  }

  function recurringRowHtml(rec, spaceById) {
    const space = spaceById[rec.spaceId];
    const dayLabel = rec.dayOfMonth === "last" ? "Último día del mes" : `Día ${rec.dayOfMonth}`;
    return `
      <div class="pending-item">
        <div class="tx-icon">${rec.type === "ingreso" ? "↑" : "↓"}</div>
        <div class="info">
          <div class="t">${escapeHtml(rec.name)}</div>
          <div class="s">${space ? space.icon + " " + escapeHtml(space.name) : "Espacio eliminado"} · ${dayLabel} · ${formatMoney(rec.amount)}</div>
        </div>
        <div class="actions">
          <button type="button" class="switch ${rec.active ? "on" : ""}" data-toggle="${rec.id}" aria-label="Activar o pausar"></button>
          <button type="button" class="icon-btn ghost" data-edit="${rec.id}">✏️</button>
        </div>
      </div>
    `;
  }

  function wire(spaces) {
    container.querySelector("#cal-prev").addEventListener("click", () => {
      viewYM = addMonthsToYearMonth(viewYM, -1);
      paint();
    });
    container.querySelector("#cal-next").addEventListener("click", () => {
      viewYM = addMonthsToYearMonth(viewYM, 1);
      paint();
    });
    container.querySelector("#fab-add-recurring").addEventListener("click", () => openRecurringForm({ spaces, onSaved: paint }));

    container.querySelectorAll("[data-apply]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const [id, ym] = btn.dataset.apply.split("|");
        await applyRecurring(id, ym);
        showToast("Movimiento aplicado");
        bus.emit("data:changed");
        paint();
      })
    );
    container.querySelectorAll("[data-skip]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const [id, ym] = btn.dataset.skip.split("|");
        const ok = await confirmDialog({
          title: "Omitir este mes",
          message: `No se creará ningún movimiento para ${monthLabel(ym)}. Puedes revisar esta decisión en cualquier momento editando el recurrente.`,
          okText: "Omitir",
        });
        if (!ok) return;
        await skipRecurring(id, ym);
        showToast("Mes omitido");
        paint();
      })
    );
    container.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const isOn = btn.classList.toggle("on");
        await updateRecurring(btn.dataset.toggle, { active: isOn });
        showToast(isOn ? "Recurrente activado" : "Recurrente pausado");
      })
    );
    container.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const all = await listRecurring();
        const rec = all.find((r) => r.id === btn.dataset.edit);
        openRecurringForm({ editing: rec, spaces, onSaved: paint });
      })
    );
  }

  await paint();
  container._cleanup = bus.on("data:changed", paint);
}

async function openRecurringForm({ editing = null, spaces, onSaved }) {
  let type = editing?.type || "gasto";
  let categories = await listCategories({ type });

  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "16px";
  body.innerHTML = `
    <div class="segmented">
      <button type="button" class="ingreso" data-type="ingreso">↑ Ingreso</button>
      <button type="button" class="gasto" data-type="gasto">↓ Gasto</button>
    </div>
    <div class="field"><label for="rf-name">Nombre</label><input type="text" id="rf-name" maxlength="40" placeholder="Ej. Arriendo, Salario, Netflix..." value="${escapeHtml(editing?.name || "")}" /></div>
    <div class="field"><label for="rf-amount">Monto (COP)</label><input type="number" id="rf-amount" min="1" step="1" value="${editing?.amount || ""}" /></div>
    <div class="field"><label for="rf-space">Espacio</label><select id="rf-space">${spaces.map((s) => `<option value="${s.id}" ${editing && editing.spaceId === s.id ? "selected" : ""}>${s.icon} ${escapeHtml(s.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="rf-category">Categoría</label><select id="rf-category"></select></div>
    <div class="field">
      <label for="rf-day">Día del mes</label>
      <select id="rf-day">
        ${Array.from({ length: 28 }, (_, i) => i + 1)
          .map((d) => `<option value="${d}" ${editing && editing.dayOfMonth === d ? "selected" : ""}>Día ${d}</option>`)
          .join("")}
        <option value="last" ${editing && editing.dayOfMonth === "last" ? "selected" : ""}>Último día del mes</option>
      </select>
      <span class="field-hint">Si el mes tiene menos días, se ajusta automáticamente.</span>
    </div>
    <div id="rf-error" class="field-error"></div>
    <button type="button" class="btn btn-primary btn-block" id="rf-save">${editing ? "Guardar cambios" : "Crear recurrente"}</button>
    ${editing ? '<button type="button" class="btn btn-danger btn-block" id="rf-delete">Eliminar recurrente</button>' : ""}
  `;

  const { close } = openModal({ title: editing ? "Editar recurrente" : "Nuevo recurrente", content: body });

  function refreshCategories() {
    const sel = body.querySelector("#rf-category");
    sel.innerHTML = categories.map((c) => `<option value="${escapeHtml(c.name)}">${c.icon} ${escapeHtml(c.name)}</option>`).join("");
    if (editing && categories.some((c) => c.name === editing.category)) sel.value = editing.category;
  }
  refreshCategories();

  const segIngreso = body.querySelector('[data-type="ingreso"]');
  const segGasto = body.querySelector('[data-type="gasto"]');
  function setType(t) {
    type = t;
    segIngreso.classList.toggle("active", t === "ingreso");
    segGasto.classList.toggle("active", t === "gasto");
    listCategories({ type: t }).then((cats) => {
      categories = cats;
      refreshCategories();
    });
  }
  segIngreso.addEventListener("click", () => setType("ingreso"));
  segGasto.addEventListener("click", () => setType("gasto"));
  setType(type);

  body.querySelector("#rf-save").addEventListener("click", async () => {
    const name = body.querySelector("#rf-name").value.trim();
    const amount = Number(body.querySelector("#rf-amount").value);
    const spaceId = body.querySelector("#rf-space").value;
    const category = body.querySelector("#rf-category").value;
    const dayRaw = body.querySelector("#rf-day").value;
    const dayOfMonth = dayRaw === "last" ? "last" : Number(dayRaw);
    const errEl = body.querySelector("#rf-error");

    if (!name) {
      errEl.textContent = "Ponle un nombre";
      return;
    }
    if (!amount || amount <= 0) {
      errEl.textContent = "El monto debe ser mayor a 0";
      return;
    }
    errEl.textContent = "";

    const payload = { name, amount, type, spaceId, category, dayOfMonth };
    if (editing) await updateRecurring(editing.id, payload);
    else await createRecurring(payload);
    showToast(editing ? "Recurrente actualizado" : "Recurrente creado");
    close();
    onSaved && onSaved();
  });

  if (editing) {
    body.querySelector("#rf-delete").addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Eliminar recurrente",
        message: "Se eliminará esta plantilla. Los movimientos que ya generó se conservan en tu historial.",
        okText: "Eliminar",
        danger: true,
      });
      if (!ok) return;
      await deleteRecurring(editing.id);
      showToast("Recurrente eliminado");
      close();
      onSaved && onSaved();
    });
  }
}
