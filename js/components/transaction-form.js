import { listSpaces, listCategories, addTransaction, updateTransaction, deleteTransaction } from "../db.js";
import { todayStr } from "../format.js";
import { openModal, confirmDialog, escapeHtml } from "./modal.js";
import { showToast } from "./toast.js";
import { bus } from "../state.js";

export async function openTransactionForm({ spaceId = null, lockSpace = false, type: initialType = "gasto", editing = null } = {}) {
  const spaces = await listSpaces();
  if (!spaces.length) {
    showToast("Primero crea un espacio de dinero");
    return;
  }
  let type = editing ? editing.type : initialType;
  let selectedSpaceId = editing ? editing.spaceId : spaceId || spaces[0].id;
  let categories = await listCategories({ type });

  const body = document.createElement("div");
  body.innerHTML = formHtml({ spaces, selectedSpaceId, lockSpace: lockSpace || !!editing === false && lockSpace, editing, type, categories });

  function refreshCategorySelect() {
    const sel = body.querySelector("#tx-category");
    sel.innerHTML = categories.map((c) => `<option value="${escapeHtml(c.name)}">${c.icon} ${escapeHtml(c.name)}</option>`).join("");
    if (editing && categories.some((c) => c.name === editing.category)) sel.value = editing.category;
  }

  const { close } = openModal({
    title: editing ? "Editar movimiento" : "Nuevo movimiento",
    content: body,
    actions: [],
  });

  refreshCategorySelect();

  const segIngreso = body.querySelector('[data-type="ingreso"]');
  const segGasto = body.querySelector('[data-type="gasto"]');
  function setType(t) {
    type = t;
    segIngreso.classList.toggle("active", t === "ingreso");
    segIngreso.classList.toggle("ingreso", t === "ingreso");
    segGasto.classList.toggle("active", t === "gasto");
    segGasto.classList.toggle("gasto", t === "gasto");
    listCategories({ type: t }).then((cats) => {
      categories = cats;
      refreshCategorySelect();
    });
  }
  segIngreso.addEventListener("click", () => setType("ingreso"));
  segGasto.addEventListener("click", () => setType("gasto"));
  setType(type);

  if (editing) {
    body.querySelector("#tx-amount").value = Math.abs(editing.amount);
    body.querySelector("#tx-name").value = editing.name;
    body.querySelector("#tx-date").value = editing.date;
    body.querySelector("#tx-note").value = editing.note || "";
  }

  const form = body.querySelector("#tx-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amountRaw = Number(body.querySelector("#tx-amount").value);
    const name = body.querySelector("#tx-name").value.trim();
    const date = body.querySelector("#tx-date").value || todayStr();
    const category = body.querySelector("#tx-category").value;
    const note = body.querySelector("#tx-note").value.trim();
    const spaceSel = body.querySelector("#tx-space");
    const chosenSpaceId = spaceSel ? spaceSel.value : selectedSpaceId;

    const errorEl = body.querySelector("#tx-error");
    if (!amountRaw || amountRaw <= 0) {
      errorEl.textContent = "Ingresa un monto mayor a 0";
      return;
    }
    if (!name) {
      errorEl.textContent = "Ponle un nombre al movimiento";
      return;
    }
    errorEl.textContent = "";

    const signedAmount = type === "gasto" ? -Math.abs(amountRaw) : Math.abs(amountRaw);
    const submitBtn = body.querySelector("#tx-submit");
    submitBtn.disabled = true;

    try {
      if (editing) {
        await updateTransaction(editing.id, {
          spaceId: chosenSpaceId,
          amount: signedAmount,
          date,
          name,
          category,
          type,
          note,
        });
        showToast("Movimiento actualizado");
      } else {
        await addTransaction({ spaceId: chosenSpaceId, amount: signedAmount, date, name, category, type, note });
        showToast(type === "ingreso" ? "Ingreso agregado" : "Gasto agregado");
      }
      bus.emit("data:changed");
      close();
    } catch (err) {
      errorEl.textContent = "No se pudo guardar: " + err.message;
      submitBtn.disabled = false;
    }
  });

  if (editing) {
    const delBtn = body.querySelector("#tx-delete");
    delBtn.classList.remove("hidden-el");
    delBtn.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: "Eliminar movimiento",
        message: `Esto eliminará "${editing.name}" y ajustará el saldo del espacio. No se puede deshacer.`,
        okText: "Eliminar",
        danger: true,
      });
      if (!ok) return;
      await deleteTransaction(editing.id);
      showToast("Movimiento eliminado");
      bus.emit("data:changed");
      close();
    });
  }
}

function formHtml({ spaces, selectedSpaceId, lockSpace, editing }) {
  const spaceOptions = spaces
    .map((s) => `<option value="${s.id}" ${s.id === selectedSpaceId ? "selected" : ""}>${s.icon} ${escapeHtml(s.name)}</option>`)
    .join("");

  return `
    <form id="tx-form" style="display:flex;flex-direction:column;gap:16px">
      <div class="segmented">
        <button type="button" class="ingreso" data-type="ingreso">↑ Ingreso</button>
        <button type="button" class="gasto" data-type="gasto">↓ Gasto</button>
      </div>

      <div class="field">
        <label for="tx-amount">Monto (COP)</label>
        <input type="number" id="tx-amount" inputmode="numeric" min="1" step="1" placeholder="0" required />
      </div>

      <div class="field">
        <label for="tx-name">Nombre</label>
        <input type="text" id="tx-name" placeholder="Ej. Almuerzo, Nequi a mamá..." required maxlength="60" />
      </div>

      ${
        spaces.length > 1 && !lockSpace
          ? `<div class="field"><label for="tx-space">Espacio</label><select id="tx-space">${spaceOptions}</select></div>`
          : `<input type="hidden" id="tx-space" value="${selectedSpaceId}" />`
      }

      <div class="field">
        <label for="tx-category">Categoría</label>
        <select id="tx-category"></select>
      </div>

      <div class="field">
        <label for="tx-date">Fecha</label>
        <input type="date" id="tx-date" value="${todayStr()}" />
      </div>

      <div class="field">
        <label for="tx-note">Nota (opcional)</label>
        <textarea id="tx-note" maxlength="140" placeholder="Detalles adicionales..."></textarea>
      </div>

      <div id="tx-error" class="field-error"></div>

      <button type="submit" id="tx-submit" class="btn btn-primary btn-block">${editing ? "Guardar cambios" : "Guardar"}</button>
      ${editing ? '<button type="button" id="tx-delete" class="btn btn-danger btn-block">Eliminar movimiento</button>' : ""}
    </form>
  `;
}
