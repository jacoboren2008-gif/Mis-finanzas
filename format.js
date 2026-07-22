// Formato de moneda y utilidades de fecha (es-CO). Fechas siempre como string local
// "YYYY-MM-DD" — nunca Date/ISO-UTC, para que no se corran de día cerca de medianoche.

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatMoney(amount) {
  return currencyFormatter.format(amount || 0);
}

export function formatMoneySigned(amount) {
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return sign + currencyFormatter.format(Math.abs(amount || 0));
}

export function formatCompact(amount) {
  const abs = Math.abs(amount || 0);
  if (abs >= 1_000_000) return (amount / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (amount / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(amount || 0));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentYearMonth() {
  return todayStr().slice(0, 7);
}

export function yearMonthOf(dateStr) {
  return dateStr.slice(0, 7);
}

export function yearOf(dateStr) {
  return dateStr.slice(0, 4);
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function addMonthsToYearMonth(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function compareYearMonth(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function resolvedDayNumber(dayOfMonth, ym) {
  const [y, m] = ym.split("-").map(Number);
  const dim = daysInMonth(y, m);
  if (dayOfMonth === "last") return dim;
  return Math.min(Number(dayOfMonth), dim);
}

export function resolvedDateForYearMonth(dayOfMonth, ym) {
  const day = resolvedDayNumber(dayOfMonth, ym);
  return `${ym}-${pad(day)}`;
}

export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function monthShortLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
}

export function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const label = date.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  return label;
}

export function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(".", "");
}

export function relativeDay(dateStr) {
  if (dateStr === todayStr()) return "Hoy";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
  if (dateStr === yStr) return "Ayer";
  return formatDateShort(dateStr);
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
