import {
  getProfile,
  saveProfile,
  listSpaces,
  updateSpace,
  listCategories,
  createCategory,
  deleteCategory,
  recalcAllBalances,
  exportAllData,
  importAllData,
  wipeAllData,
} from "../db.js";
import { bottomNavHtml } from "../components/nav.js";
import { openModal, confirmDialog, escapeHtml } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { openSpaceForm } from "../components/space-form.js";
import { renderLock } from "./lock.js";
import { appState, applyTheme, bus } from "../state.js";
import { navigate } from "../router.js";
import { formatMoney } from "../format.js";

export async function renderProfile(container) {
  if (typeof container._cleanup === "function") {
    container._cleanup();
    container._cleanup = null;
  }

  async function paint() {
    const profile = await getProfile();
    const spaces = await listSpaces({ includeArchived: true });
    const activeSpaces = spaces.filter((s) => !s.archived);
    const archivedSpaces = spaces.filter((s) => s.archived);
    const categories = await listCategories({});
    const gastoCats = categories.filter((c) => c.type === "gasto");
    const ingresoCats = categories.filter((c) => c.type === "ingreso");
    const theme = appState.get().theme;

    container.innerHTML = `
      <div class="page">
        <div class="topbar"><h1>Perfil</h1></div>

        <div class="card" style="display:flex;align-items:center;gap:14px">
          <div class="avatar-circle">${(profile?.name || "?").charAt(0).toUpperCase()}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:1.05rem">${escapeHtml(profile?.name || "Sin nombre")}</div>
            <div style="font-size:0.8rem;color:var(--ink-secondary)">Moneda: ${escapeHtml(profile?.currency || "COP")}</div>
          </div>
          <button type="button" class="icon-btn" id="edit-name">✏️</button>
        </div>

        <div class="section-title">Apariencia</div>
        <div class="card">
          <div class="segmented">
            <button type="button" data-theme="light" class="${theme === "light" ? "active" : ""}">☀️ Claro</button>
            <button type="button" data-theme="dark" class="${theme === "dark" ? "active" : ""}">🌙 Oscuro</button>
            <button type="button" data-theme="system" class="${theme === "system" ? "active" : ""}">⚙️ Auto</button>
          </div>
        </div>

        <div class="section-title">Seguridad</div>
        <div class="card">
          <button type="button" class="settings-row" id="pin-row">
            <span class="emoji">🔒</span>
            <span class="txt"><span class="t">${profile?.pinHash ? "Cambiar PIN" : "Crear PIN de acceso"}</span><span class="s">Candado local, no es una cuenta en la nube</span></span>
            <span class="chev">›</span>
          </button>
          ${
            profile?.pinHash
              ? `<button type="button" class="settings-row" id="remove-pin-row">
                  <span class="emoji">🔓</span>
                  <span class="txt"><span class="t">Quitar PIN</span></span>
                  <span class="chev">›</span>
                </button>`
              : ""
          }
        </div>

        <div class="section-title">Espacios de dinero (${activeSpaces.length})</div>
        <div class="card">
          ${activeSpaces
            .map(
              (s) => `
            <button type="button" class="settings-row" data-open-space="${s.id}">
              <span class="emoji">${s.icon}</span>
              <span class="txt"><span class="t">${escapeHtml(s.name)}</span><span class="s">${formatMoney(s.balance)}${s.includeInTotal ? "" : " · no incluido en el total"}</span></span>
              <span class="chev">›</span>
            </button>`
            )
            .join("")}
          <button type="button" class="settings-row" id="new-space-row">
            <span class="emoji">➕</span>
            <span class="txt"><span class="t">Nuevo espacio</span></span>
          </button>
        </div>

        ${
          archivedSpaces.length
            ? `<div class="section-title">Espacios archivados (${archivedSpaces.length})</div>
               <div class="card">${archivedSpaces
                 .map(
                   (s) => `
                <div class="settings-row" style="cursor:default">
                  <span class="emoji">${s.icon}</span>
                  <span class="txt"><span class="t">${escapeHtml(s.name)}</span><span class="s">${formatMoney(s.balance)}</span></span>
                  <button type="button" class="btn btn-sm btn-secondary" data-reactivate="${s.id}">Reactivar</button>
                </div>`
                 )
                 .join("")}</div>`
            : ""
        }

        <div class="section-title">Categorías</div>
        <div class="card">
          <p style="font-size:0.8rem;color:var(--ink-secondary);margin:0 0 8px">Gastos</p>
          <div class="filter-row" style="margin-bottom:12px">
            ${gastoCats.map((c) => categoryChip(c)).join("")}
          </div>
          <p style="font-size:0.8rem;color:var(--ink-secondary);margin:0 0 8px">Ingresos</p>
          <div class="filter-row" style="margin-bottom:12px">
            ${ingresoCats.map((c) => categoryChip(c)).join("")}
          </div>
          <button type="button" class="btn btn-secondary btn-block" id="add-category">+ Agregar categoría</button>
        </div>

        <div class="section-title">Tus datos</div>
        <div class="card">
          <button type="button" class="settings-row" id="recalc-row">
            <span class="emoji">🧮</span>
            <span class="txt"><span class="t">Recalcular saldos</span><span class="s">Corrige cualquier descuadre revisando todo el historial</span></span>
            <span class="chev">›</span>
          </button>
          <button type="button" class="settings-row" id="export-row">
            <span class="emoji">⬇️</span>
            <span class="txt"><span class="t">Exportar respaldo (JSON)</span><span class="s">Guárdalo en un lugar seguro — es tu única copia</span></span>
            <span class="chev">›</span>
          </button>
          <button type="button" class="settings-row" id="import-row">
            <span class="emoji">⬆️</span>
            <span class="txt"><span class="t">Restaurar desde un respaldo</span><span class="s">Reemplaza todos los datos actuales</span></span>
            <span class="chev">›</span>
          </button>
          <input type="file" id="import-file" accept="application/json" style="display:none" />
        </div>

        <div class="section-title">Zona de peligro</div>
        <div class="card">
          <button type="button" class="settings-row" id="wipe-row" style="color:var(--status-critical)">
            <span class="emoji">🗑️</span>
            <span class="txt"><span class="t" style="color:var(--status-critical)">Borrar todos los datos</span><span class="s">Empezar de cero en este dispositivo</span></span>
            <span class="chev">›</span>
          </button>
        </div>
      </div>
      ${bottomNavHtml("/perfil")}
    `;

    wire(profile);
  }

  function categoryChip(c) {
    return `<span class="chip" style="cursor:default;display:inline-flex;align-items:center;gap:6px">${c.icon} ${escapeHtml(c.name)}${c.custom ? `<button type="button" data-del-cat="${c.id}" style="border:none;background:none;color:var(--ink-muted);cursor:pointer;padding:0;font-size:0.9rem">✕</button>` : ""}</span>`;
  }

  function wire(profile) {
    container.querySelector("#edit-name").addEventListener("click", () => editName(profile));

    container.querySelectorAll("[data-theme]").forEach((btn) =>
      btn.addEventListener("click", () => {
        applyTheme(btn.dataset.theme);
        paint();
      })
    );

    container.querySelector("#pin-row").addEventListener("click", () => changePin());
    const removePinRow = container.querySelector("#remove-pin-row");
    if (removePinRow) removePinRow.addEventListener("click", () => removePin());

    container.querySelectorAll("[data-open-space]").forEach((btn) => btn.addEventListener("click", () => navigate(`/espacio/${btn.dataset.openSpace}`)));
    container.querySelector("#new-space-row").addEventListener("click", () => openSpaceForm({ onSaved: paint }));
    container.querySelectorAll("[data-reactivate]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        await updateSpace(btn.dataset.reactivate, { archived: false });
        showToast("Espacio reactivado");
        bus.emit("data:changed");
        paint();
      })
    );

    container.querySelectorAll("[data-del-cat]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog({
          title: "Eliminar categoría",
          message: "Los movimientos ya guardados con esta categoría no se modifican, solo dejará de aparecer para elegirla en nuevos movimientos.",
          okText: "Eliminar",
          danger: true,
        });
        if (!ok) return;
        await deleteCategory(btn.dataset.delCat);
        paint();
      })
    );
    container.querySelector("#add-category").addEventListener("click", () => addCategory());

    container.querySelector("#recalc-row").addEventListener("click", async () => {
      await recalcAllBalances();
      showToast("Saldos recalculados");
      bus.emit("data:changed");
    });
    container.querySelector("#export-row").addEventListener("click", async () => {
      const data = await exportAllData();
      downloadJson(data, `mis-finanzas-respaldo-${new Date().toISOString().slice(0, 10)}.json`);
      showToast("Respaldo descargado");
    });
    container.querySelector("#import-row").addEventListener("click", () => container.querySelector("#import-file").click());
    container.querySelector("#import-file").addEventListener("change", (e) => handleImport(e));

    container.querySelector("#wipe-row").addEventListener("click", () => wipeEverything());
  }

  async function editName(profile) {
    const body = document.createElement("div");
    body.innerHTML = `<div class="field"><label for="pf-name">Nombre</label><input type="text" id="pf-name" maxlength="30" value="${escapeHtml(profile?.name || "")}" /></div>`;
    const { close } = openModal({
      title: "Editar nombre",
      content: body,
      actions: [
        {
          label: "Guardar",
          className: "btn-primary",
          onClick: async (c) => {
            const name = body.querySelector("#pf-name").value.trim();
            if (!name) return;
            await saveProfile({ name });
            appState.set({ profile: await getProfile() });
            c();
            paint();
          },
        },
      ],
    });
  }

  function changePin() {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "70";
    overlay.style.background = "var(--page)";
    document.body.appendChild(overlay);
    renderLock(overlay, {
      mode: "create",
      onCancel: () => overlay.remove(),
      onSuccess: async (hashBundle) => {
        await saveProfile(hashBundle);
        overlay.remove();
        showToast("PIN actualizado");
        paint();
      },
    });
  }

  async function removePin() {
    const ok = await confirmDialog({
      title: "Quitar PIN",
      message: "Tu app quedará sin candado de acceso. Cualquiera que abra este dispositivo podrá ver tus finanzas.",
      okText: "Quitar PIN",
      danger: true,
    });
    if (!ok) return;
    await saveProfile({ pinHash: null, pinSalt: null, pinIterations: null });
    showToast("PIN eliminado");
    paint();
  }

  function addCategory() {
    const body = document.createElement("div");
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.gap = "14px";
    body.innerHTML = `
      <div class="segmented">
        <button type="button" class="gasto active" data-ctype="gasto">↓ Gasto</button>
        <button type="button" class="ingreso" data-ctype="ingreso">↑ Ingreso</button>
      </div>
      <div class="field"><label for="cat-name">Nombre</label><input type="text" id="cat-name" maxlength="24" placeholder="Ej. Mascotas" /></div>
      <div class="field"><label for="cat-icon">Ícono (un emoji)</label><input type="text" id="cat-icon" maxlength="4" placeholder="🏷️" /></div>
      <div id="cat-error" class="field-error"></div>
    `;
    let ctype = "gasto";
    body.querySelectorAll("[data-ctype]").forEach((btn) =>
      btn.addEventListener("click", () => {
        ctype = btn.dataset.ctype;
        body.querySelectorAll("[data-ctype]").forEach((b) => b.classList.toggle("active", b === btn));
      })
    );
    openModal({
      title: "Nueva categoría",
      content: body,
      actions: [
        {
          label: "Crear",
          className: "btn-primary",
          onClick: async (close) => {
            const name = body.querySelector("#cat-name").value.trim();
            if (!name) {
              body.querySelector("#cat-error").textContent = "Ponle un nombre";
              return;
            }
            const icon = body.querySelector("#cat-icon").value.trim() || "🏷️";
            await createCategory({ name, icon, type: ctype });
            close();
            showToast("Categoría creada");
            paint();
          },
        },
      ],
    });
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      showToast("El archivo no es un respaldo válido");
      return;
    }
    const current = await exportAllData();
    downloadJson(current, `mis-finanzas-antes-de-restaurar-${new Date().toISOString().slice(0, 10)}.json`);
    const ok = await confirmDialog({
      title: "Restaurar respaldo",
      message: "Esto reemplazará TODOS tus datos actuales con lo del archivo. Ya descargamos un respaldo de tus datos actuales por si acaso. ¿Continuar?",
      okText: "Reemplazar todo",
      danger: true,
    });
    if (!ok) return;
    try {
      await importAllData(payload);
      showToast("Datos restaurados");
      location.reload();
    } catch (err) {
      showToast("No se pudo restaurar: " + err.message);
    }
  }

  async function wipeEverything() {
    const ok = await confirmDialog({
      title: "Borrar todos los datos",
      message: "Se eliminarán todos tus espacios, movimientos, metas y recurrentes de este dispositivo. Esta acción no se puede deshacer. Considera exportar un respaldo antes.",
      okText: "Borrar todo",
      danger: true,
    });
    if (!ok) return;
    await wipeAllData();
    location.reload();
  }

  await paint();
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
