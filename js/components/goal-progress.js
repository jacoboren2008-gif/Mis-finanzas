import { listTransactions } from "../db.js";
import { formatMoney, currentYearMonth } from "../format.js";

// La meta de "ahorro" se calcula del saldo actual (síncrono). La de
// "límite de gasto" se reinicia cada mes calendario, así que necesita
// consultar los movimientos del mes en curso (por eso esta función es async).
export async function getGoalProgress(space) {
  if (!space.goal) return null;
  const goal = space.goal;

  if (goal.type === "ahorro") {
    const rawPct = goal.amount > 0 ? space.balance / goal.amount : 0;
    return {
      type: "ahorro",
      pct: Math.max(0, Math.min(1, rawPct)),
      rawPct,
      label: `Ahorro: ${formatMoney(Math.max(space.balance, 0))} de ${formatMoney(goal.amount)}`,
      colorValue: "var(--space-color)",
    };
  }

  const ym = currentYearMonth();
  const txs = await listTransactions({ spaceId: space.id, dateFrom: `${ym}-01`, dateTo: `${ym}-31`, type: "gasto" });
  const spent = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const rawPct = goal.amount > 0 ? spent / goal.amount : 0;
  const pct = Math.max(0, Math.min(1, rawPct));
  const colorValue = rawPct >= 1 ? "var(--status-critical)" : rawPct >= 0.75 ? "var(--status-warning)" : "var(--status-good)";
  return {
    type: "limite_gasto",
    pct,
    rawPct,
    label: `Límite del mes: ${formatMoney(spent)} de ${formatMoney(goal.amount)}`,
    colorValue,
  };
}

export function renderMeterHtml(progress) {
  if (!progress) return "";
  const pctDisplay = Math.round(progress.pct * 100);
  const overBadge = progress.rawPct >= 1 && progress.type === "limite_gasto" ? " ⚠️ superado" : "";
  return `
    <div class="meter" style="--meter-color:${progress.colorValue}">
      <div class="meter-row"><span>${progress.label}${overBadge}</span><span>${pctDisplay}%</span></div>
      <div class="meter-track"><div class="meter-fill" style="width:${pctDisplay}%"></div></div>
    </div>
  `;
}
