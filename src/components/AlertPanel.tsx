import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';

export function AlertPanel() {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const alerts: { text: string; type: 'danger' | 'warning' | 'success' }[] = [];

  // Low inventory alerts
  for (const cons of human.consumption) {
    const inv = human.inventory.find(i => i.commodityId === cons.commodityId);
    const level = cons.consumption > 0 ? ((inv?.quantity ?? 0) / cons.consumption) * 100 : 100;
    const commodity = COMMODITIES.find(c => c.id === cons.commodityId);
    if (cons.required && level < 50) {
      alerts.push({
        text: `⚠ ${commodity?.name} inventory low (${level.toFixed(0)}%)`,
        type: level < 20 ? 'danger' : 'warning',
      });
    }
  }

  // Currency alert
  const lastResult = state.roundHistory[state.roundHistory.length - 1];
  if (lastResult) {
    const dep = lastResult.exchangeRateChanges[human.id];
    if (dep !== undefined) {
      if (dep > 5) alerts.push({ text: `📉 ${human.currency} depreciated ${dep.toFixed(1)}%`, type: 'danger' });
      else if (dep > 3) alerts.push({ text: `↓ ${human.currency} down ${dep.toFixed(1)}%`, type: 'warning' });
      else if (dep < -3) alerts.push({ text: `📈 ${human.currency} appreciated ${Math.abs(dep).toFixed(1)}%`, type: 'success' });
    }
  }

  // Crisis alert
  if (human.inCrisis) {
    alerts.unshift({ text: '🚨 ECONOMIC CRISIS ACTIVE', type: 'danger' });
  }

  // Price surge alerts
  for (const c of COMMODITIES) {
    const commodity = state.commodities[c.id];
    if (!commodity) continue;
    const change = ((commodity.currentGlobalPrice - c.globalBasePrice) / c.globalBasePrice) * 100;
    const isImport = human.consumption.some(co => co.commodityId === c.id && co.required);
    if (isImport && change > 20) {
      alerts.push({ text: `📈 ${c.name} prices +${change.toFixed(0)}%`, type: 'warning' });
    }
    if (!isImport && change < -15 && human.production.some(p => p.commodityId === c.id)) {
      alerts.push({ text: `📉 ${c.name} prices ${change.toFixed(0)}% (export revenue risk)`, type: 'warning' });
    }
  }

  const typeColors = {
    danger: 'border-red-500/30 bg-red-500/10 text-red-300',
    warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  };

  return (
    <aside className="w-60 bg-slate-800/50 border-l border-slate-700 p-3 overflow-y-auto shrink-0">
      <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">⚠ Alerts</h3>
      <div className="space-y-2">
        {alerts.length === 0 && (
          <p className="text-xs text-slate-500">No alerts.</p>
        )}
        {alerts.map((alert, i) => (
          <div key={i} className={`text-xs rounded-lg px-2 py-1.5 border ${typeColors[alert.type]}`}>
            {alert.text}
          </div>
        ))}
      </div>

      {/* Active shocks */}
      {state.activeShocks.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Active Shocks</h4>
          {state.activeShocks.map(s => (
            <div key={s.id} className="text-xs text-slate-400 mb-1">
              {s.name} ({s.effects.duration}r left)
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
