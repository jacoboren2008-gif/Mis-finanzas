// Capa de persistencia — IndexedDB nativo, sin librerías.
// Invariante importante: el saldo de cada espacio (spaces.balance) se mantiene
// por DELTA dentro de la misma transacción IndexedDB que crea/edita/borra un
// movimiento, así nunca puede desincronizarse por un corte a medias. recalcAllBalances()
// existe como auto-reparación por si acaso (botón "Recalcular saldos" en Perfil).
import { uid, resolvedDateForYearMonth, currentYearMonth, addMonthsToYearMonth, compareYearMonth, resolvedDayNumber, todayStr } from "./format.js";

const DB_NAME = "MisFinanzasDB";
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        db.createObjectStore("profile", { keyPath: "id" });

        const spaces = db.createObjectStore("spaces", { keyPath: "id" });
        spaces.createIndex("archived", "archived");
        spaces.createIndex("order", "order");

        const tx = db.createObjectStore("transactions", { keyPath: "id" });
        tx.createIndex("spaceId", "spaceId");
        tx.createIndex("date", "date");
        tx.createIndex("spaceId_date", ["spaceId", "date"]);

        const recurring = db.createObjectStore("recurring", { keyPath: "id" });
        recurring.createIndex("spaceId", "spaceId");

        const categories = db.createObjectStore("categories", { keyPath: "id" });
        categories.createIndex("type", "type");
        seedCategories(categories);
      }
    };

    req.onblocked = () => {
      console.warn("[DB] Actualización bloqueada — cierra otras pestañas de la app.");
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function seedCategories(store) {
  const gastos = [
    ["Comida", "🍔"], ["Transporte", "🚌"], ["Vivienda", "🏠"], ["Servicios", "💡"],
    ["Salud", "🩺"], ["Entretenimiento", "🎮"], ["Ropa", "👕"], ["Educación", "📚"],
    ["Deudas", "💳"], ["Suscripciones", "🔁"], ["Otros", "🧾"],
  ];
  const ingresos = [
    ["Salario", "💼"], ["Independiente", "🧑‍💻"], ["Ventas", "🛒"], ["Regalo", "🎁"], ["Otros", "💰"],
  ];
  for (const [name, icon] of gastos) {
    store.add({ id: uid(), name, icon, type: "gasto", custom: false });
  }
  for (const [name, icon] of ingresos) {
    store.add({ id: uid(), name, icon, type: "ingreso", custom: false });
  }
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAllFromStore(db, name) {
  const tx = db.transaction(name, "readonly");
  const result = await reqToPromise(tx.objectStore(name).getAll());
  await txDone(tx);
  return result;
}

/* ---------------------------- Perfil ---------------------------- */

export async function getProfile() {
  const db = await openDB();
  const tx = db.transaction("profile", "readonly");
  const result = await reqToPromise(tx.objectStore("profile").get(1));
  await txDone(tx);
  return result || null;
}

export async function saveProfile(patch) {
  const db = await openDB();
  const tx = db.transaction("profile", "readwrite");
  const store = tx.objectStore("profile");
  const existing = (await reqToPromise(store.get(1))) || { id: 1, createdAt: Date.now() };
  const updated = { ...existing, ...patch, id: 1 };
  await reqToPromise(store.put(updated));
  await txDone(tx);
  return updated;
}

/* ---------------------------- Espacios ---------------------------- */

export async function listSpaces({ includeArchived = false } = {}) {
  const db = await openDB();
  const all = await getAllFromStore(db, "spaces");
  const filtered = includeArchived ? all : all.filter((s) => !s.archived);
  return filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getSpace(id) {
  const db = await openDB();
  const tx = db.transaction("spaces", "readonly");
  const result = await reqToPromise(tx.objectStore("spaces").get(id));
  await txDone(tx);
  return result || null;
}

export async function createSpace(data) {
  const db = await openDB();
  const tx = db.transaction("spaces", "readwrite");
  const store = tx.objectStore("spaces");
  const existing = await reqToPromise(store.getAll());
  const maxOrder = existing.reduce((m, s) => Math.max(m, s.order ?? 0), 0);
  const record = {
    id: uid(),
    name: data.name,
    icon: data.icon || "💰",
    colorSlot: data.colorSlot || 1,
    includeInTotal: data.includeInTotal !== false,
    archived: false,
    order: maxOrder + 1,
    balance: data.balance || 0,
    goal: data.goal || null,
    createdAt: Date.now(),
  };
  await reqToPromise(store.add(record));
  await txDone(tx);
  return record;
}

export async function updateSpace(id, patch) {
  const db = await openDB();
  const tx = db.transaction("spaces", "readwrite");
  const store = tx.objectStore("spaces");
  const existing = await reqToPromise(store.get(id));
  if (!existing) {
    await txDone(tx);
    throw new Error("Espacio no encontrado");
  }
  const updated = { ...existing, ...patch, id };
  await reqToPromise(store.put(updated));
  await txDone(tx);
  return updated;
}

export async function setSpacesOrder(orderedIds) {
  const db = await openDB();
  const tx = db.transaction("spaces", "readwrite");
  const store = tx.objectStore("spaces");
  for (let i = 0; i < orderedIds.length; i++) {
    const rec = await reqToPromise(store.get(orderedIds[i]));
    if (rec) {
      rec.order = i;
      await reqToPromise(store.put(rec));
    }
  }
  await txDone(tx);
}

/* ---------------------------- Movimientos ---------------------------- */

export async function listTransactions(filters = {}) {
  const db = await openDB();
  const tx = db.transaction("transactions", "readonly");
  const store = tx.objectStore("transactions");
  let results;
  if (filters.spaceId) {
    results = await reqToPromise(store.index("spaceId").getAll(filters.spaceId));
  } else if (filters.dateFrom || filters.dateTo) {
    const lower = filters.dateFrom || "0000-01-01";
    const upper = filters.dateTo || "9999-12-31";
    results = await reqToPromise(store.index("date").getAll(IDBKeyRange.bound(lower, upper)));
  } else {
    results = await reqToPromise(store.getAll());
  }
  await txDone(tx);

  if (filters.spaceId && (filters.dateFrom || filters.dateTo)) {
    const lower = filters.dateFrom || "0000-01-01";
    const upper = filters.dateTo || "9999-12-31";
    results = results.filter((t) => t.date >= lower && t.date <= upper);
  }
  if (filters.type) results = results.filter((t) => t.type === filters.type);
  if (filters.category) results = results.filter((t) => t.category === filters.category);
  if (filters.spaceIds) results = results.filter((t) => filters.spaceIds.includes(t.spaceId));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.note || "").toLowerCase().includes(q)
    );
  }
  results.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
  return results;
}

export async function addTransaction(data) {
  const db = await openDB();
  const tx = db.transaction(["transactions", "spaces"], "readwrite");
  const txStore = tx.objectStore("transactions");
  const spaceStore = tx.objectStore("spaces");
  const record = {
    id: uid(),
    spaceId: data.spaceId,
    amount: data.amount,
    date: data.date || todayStr(),
    name: data.name,
    category: data.category || "Otros",
    type: data.type,
    note: data.note || "",
    recurringId: data.recurringId || null,
    createdAt: Date.now(),
  };
  await reqToPromise(txStore.add(record));
  const space = await reqToPromise(spaceStore.get(record.spaceId));
  if (space) {
    space.balance = (space.balance || 0) + record.amount;
    await reqToPromise(spaceStore.put(space));
  }
  await txDone(tx);
  return record;
}

export async function updateTransaction(id, patch) {
  const db = await openDB();
  const tx = db.transaction(["transactions", "spaces"], "readwrite");
  const txStore = tx.objectStore("transactions");
  const spaceStore = tx.objectStore("spaces");
  const existing = await reqToPromise(txStore.get(id));
  if (!existing) {
    await txDone(tx);
    throw new Error("Movimiento no encontrado");
  }
  const updated = { ...existing, ...patch, id };
  await reqToPromise(txStore.put(updated));

  if (existing.spaceId === updated.spaceId) {
    if (existing.amount !== updated.amount) {
      const space = await reqToPromise(spaceStore.get(updated.spaceId));
      if (space) {
        space.balance = (space.balance || 0) - existing.amount + updated.amount;
        await reqToPromise(spaceStore.put(space));
      }
    }
  } else {
    const oldSpace = await reqToPromise(spaceStore.get(existing.spaceId));
    if (oldSpace) {
      oldSpace.balance = (oldSpace.balance || 0) - existing.amount;
      await reqToPromise(spaceStore.put(oldSpace));
    }
    const newSpace = await reqToPromise(spaceStore.get(updated.spaceId));
    if (newSpace) {
      newSpace.balance = (newSpace.balance || 0) + updated.amount;
      await reqToPromise(spaceStore.put(newSpace));
    }
  }
  await txDone(tx);
  return updated;
}

export async function deleteTransaction(id) {
  const db = await openDB();
  const tx = db.transaction(["transactions", "spaces"], "readwrite");
  const txStore = tx.objectStore("transactions");
  const spaceStore = tx.objectStore("spaces");
  const existing = await reqToPromise(txStore.get(id));
  if (!existing) {
    await txDone(tx);
    return;
  }
  await reqToPromise(txStore.delete(id));
  const space = await reqToPromise(spaceStore.get(existing.spaceId));
  if (space) {
    space.balance = (space.balance || 0) - existing.amount;
    await reqToPromise(spaceStore.put(space));
  }
  await txDone(tx);
}

export async function recalcAllBalances() {
  const db = await openDB();
  const spaces = await getAllFromStore(db, "spaces");
  const sums = new Map();

  const readTx = db.transaction("transactions", "readonly");
  await new Promise((resolve, reject) => {
    const cursorReq = readTx.objectStore("transactions").openCursor();
    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const t = cursor.value;
        sums.set(t.spaceId, (sums.get(t.spaceId) || 0) + t.amount);
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  await txDone(readTx);

  const writeTx = db.transaction("spaces", "readwrite");
  const wstore = writeTx.objectStore("spaces");
  for (const space of spaces) {
    space.balance = sums.get(space.id) || 0;
    wstore.put(space);
  }
  await txDone(writeTx);
  return spaces;
}

/* ---------------------------- Recurrentes ---------------------------- */

export async function listRecurring({ activeOnly = false } = {}) {
  const db = await openDB();
  const all = await getAllFromStore(db, "recurring");
  return activeOnly ? all.filter((r) => r.active) : all;
}

export async function createRecurring(data) {
  const db = await openDB();
  const tx = db.transaction("recurring", "readwrite");
  const store = tx.objectStore("recurring");
  const record = {
    id: uid(),
    name: data.name,
    amount: Math.abs(data.amount),
    type: data.type,
    spaceId: data.spaceId,
    dayOfMonth: data.dayOfMonth,
    category: data.category || "Otros",
    active: true,
    startYearMonth: currentYearMonth(),
    lastAppliedYearMonth: null,
    skippedMonths: [],
    createdAt: Date.now(),
  };
  await reqToPromise(store.add(record));
  await txDone(tx);
  return record;
}

export async function updateRecurring(id, patch) {
  const db = await openDB();
  const tx = db.transaction("recurring", "readwrite");
  const store = tx.objectStore("recurring");
  const existing = await reqToPromise(store.get(id));
  if (!existing) {
    await txDone(tx);
    throw new Error("Recurrente no encontrado");
  }
  const updated = { ...existing, ...patch, id };
  await reqToPromise(store.put(updated));
  await txDone(tx);
  return updated;
}

export async function deleteRecurring(id) {
  const db = await openDB();
  const tx = db.transaction("recurring", "readwrite");
  await reqToPromise(tx.objectStore("recurring").delete(id));
  await txDone(tx);
}

export function computePendingYearMonths(recurring, todayYM = currentYearMonth(), todayDayNum = new Date().getDate()) {
  const start = recurring.lastAppliedYearMonth
    ? addMonthsToYearMonth(recurring.lastAppliedYearMonth, 1)
    : recurring.startYearMonth;
  const months = [];
  let ym = start;
  while (compareYearMonth(ym, todayYM) < 0) {
    months.push(ym);
    ym = addMonthsToYearMonth(ym, 1);
  }
  if (compareYearMonth(ym, todayYM) === 0) {
    const dueDay = resolvedDayNumber(recurring.dayOfMonth, ym);
    if (todayDayNum >= dueDay) months.push(ym);
  }
  return months;
}

export async function getAllPending() {
  const recurring = await listRecurring({ activeOnly: true });
  const todayYM = currentYearMonth();
  const todayDay = new Date().getDate();
  const pending = [];
  for (const rec of recurring) {
    const months = computePendingYearMonths(rec, todayYM, todayDay);
    for (const ym of months) {
      pending.push({ recurring: rec, yearMonth: ym, dueDate: resolvedDateForYearMonth(rec.dayOfMonth, ym) });
    }
  }
  pending.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  return pending;
}

export async function applyRecurring(recurringId, yearMonth) {
  const db = await openDB();
  const tx = db.transaction(["recurring", "transactions", "spaces"], "readwrite");
  const recStore = tx.objectStore("recurring");
  const txStore = tx.objectStore("transactions");
  const spaceStore = tx.objectStore("spaces");

  const rec = await reqToPromise(recStore.get(recurringId));
  if (!rec) {
    await txDone(tx);
    throw new Error("Recurrente no encontrado");
  }
  const signedAmount = rec.type === "gasto" ? -Math.abs(rec.amount) : Math.abs(rec.amount);
  const date = resolvedDateForYearMonth(rec.dayOfMonth, yearMonth);
  const record = {
    id: uid(),
    spaceId: rec.spaceId,
    amount: signedAmount,
    date,
    name: rec.name,
    category: rec.category,
    type: rec.type,
    note: "Generado desde recurrente",
    recurringId: rec.id,
    createdAt: Date.now(),
  };
  await reqToPromise(txStore.add(record));

  const space = await reqToPromise(spaceStore.get(rec.spaceId));
  if (space) {
    space.balance = (space.balance || 0) + signedAmount;
    await reqToPromise(spaceStore.put(space));
  }

  rec.lastAppliedYearMonth = yearMonth;
  await reqToPromise(recStore.put(rec));
  await txDone(tx);
  return record;
}

export async function skipRecurring(recurringId, yearMonth) {
  const db = await openDB();
  const tx = db.transaction("recurring", "readwrite");
  const store = tx.objectStore("recurring");
  const rec = await reqToPromise(store.get(recurringId));
  if (!rec) {
    await txDone(tx);
    return;
  }
  rec.lastAppliedYearMonth = yearMonth;
  rec.skippedMonths = [...(rec.skippedMonths || []), yearMonth];
  await reqToPromise(store.put(rec));
  await txDone(tx);
}

/* ---------------------------- Categorías ---------------------------- */

export async function listCategories({ type } = {}) {
  const db = await openDB();
  const all = await getAllFromStore(db, "categories");
  const filtered = type ? all.filter((c) => c.type === type) : all;
  return filtered.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function createCategory(data) {
  const db = await openDB();
  const tx = db.transaction("categories", "readwrite");
  const store = tx.objectStore("categories");
  const record = { id: uid(), name: data.name, icon: data.icon || "🏷️", type: data.type, custom: true };
  await reqToPromise(store.add(record));
  await txDone(tx);
  return record;
}

export async function deleteCategory(id) {
  const db = await openDB();
  const tx = db.transaction("categories", "readwrite");
  await reqToPromise(tx.objectStore("categories").delete(id));
  await txDone(tx);
}

/* ---------------------------- Backup / restauración ---------------------------- */

export async function exportAllData() {
  const db = await openDB();
  const [profile, spaces, transactions, recurring, categories] = await Promise.all([
    getProfile(),
    getAllFromStore(db, "spaces"),
    getAllFromStore(db, "transactions"),
    getAllFromStore(db, "recurring"),
    getAllFromStore(db, "categories"),
  ]);
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    spaces,
    transactions,
    recurring,
    categories,
  };
}

export async function importAllData(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Archivo inválido");
  if (!payload.formatVersion) throw new Error("Archivo inválido: falta formatVersion");

  const db = await openDB();
  const storeNames = ["profile", "spaces", "transactions", "recurring", "categories"];
  const tx = db.transaction(storeNames, "readwrite");
  for (const name of storeNames) {
    await reqToPromise(tx.objectStore(name).clear());
  }
  if (payload.profile) await reqToPromise(tx.objectStore("profile").put(payload.profile));
  for (const [key, storeName] of [
    ["spaces", "spaces"],
    ["transactions", "transactions"],
    ["recurring", "recurring"],
    ["categories", "categories"],
  ]) {
    const store = tx.objectStore(storeName);
    for (const record of payload[key] || []) await reqToPromise(store.put(record));
  }
  await txDone(tx);
  await recalcAllBalances();
}

export async function wipeAllData() {
  const db = await openDB();
  const storeNames = ["profile", "spaces", "transactions", "recurring", "categories"];
  const tx = db.transaction(storeNames, "readwrite");
  for (const name of storeNames) {
    await reqToPromise(tx.objectStore(name).clear());
  }
  await txDone(tx);
  dbPromise = null;
}
