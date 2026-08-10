import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function Dashboard() {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const tradeColor = human.tradeBalance >= 0 ? '#34d399' : '#f87171';

  // Production/consumption data
  const resourceData = COMMODITIES.map(c => {
    const prod = human.production.find(p => p.commodityId === c.id);
    const cons = human.consumption.find(p => p.commodityId === c.id);
    const inv = human.inventory.find(i => i.commodityId === c.id);
    return {
      name: c.name,
      production: prod?.production ?? 0,
      consumption: cons?.consumption ?? 0,
      inventory: inv?.quantity ?? 0,
    };
  });

  // Alerts
  const alerts: string[] = [];
  for (const cons of human.consumption) {
    const inv = human.inventory.find(i => i.commodityId === cons.commodityId);
    const level = cons.consumption > 0 ? ((inv?.quantity ?? 0) / cons.consumption) * 100 : 100;
    if (cons.required && level < 40) {
      const c = COMMODITIES.find(c => c.id === cons.commodityId);
      alerts.push(`⚠ ${c?.name} inventory critical (${level.toFixed(0)}%)`);
    }
  }
  if (human.inCrisis) alerts.unshift('🚨 ECONOMIC CRISIS');
  if (human.inflation > 10) alerts.push(`📈 Inflation at ${human.inflation.toFixed(0)}%`);

  // Currency overview
  const fxRatio = human.fxReserves + human.goldReserves > 0
    ? (human.fxReserves / (human.fxReserves + human.goldReserves)) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">📊 Dashboard</h2>
        {alerts.length > 0 && (
          <div className="flex gap-2">
            {alerts.slice(0, 2).map((a, i) => (
              <span key={i} className="text-xs bg-red-500/10 border border-red-500/30 text-red-300 px-2 py-0.5 rounded">{a}</span>
            ))}
          </div>
        )}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="GDP" value={`$${human.gdp.toFixed(0)}B`} sub={`Rank #${getRank(human.id, state.roundHistory)}`} />
        <StatCard label="Trade Balance" value={`${human.tradeBalance >= 0 ? '+' : ''}${human.tradeBalance.toFixed(1)} GTU`} sub={`Exports: ${human.exportRevenue.toFixed(0)} / Imports: ${human.importCost.toFixed(0)}`} color={tradeColor} />
        <StatCard label="Currency" value={`1 GTU = ${human.currencyValue} ${human.currency}`} sub={`Inflation: ${human.inflation.toFixed(1)}%`} />
        <StatCard label="Score" value={`${human.economicScore}`} sub={`${state.playerObjectives.filter(o => o.completed).length}/${state.playerObjectives.length} objectives`} color="#fbbf24" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="FX Reserves" value={`$${human.fxReserves.toFixed(0)}B`} sub={`Gold: $${human.goldReserves}B`} />
        <StatCard label="Debt/GDP" value={`${(human.debtToGDP * 100).toFixed(0)}%`} sub={`Debt: $${human.debt}B`} />
        <StatCard label="Supply Resilience" value={`${(human.supplyChainResilience * 100).toFixed(0)}%`} sub="Supplier diversity" />
        <StatCard label="Reserves Mix" value={`${fxRatio.toFixed(0)}% FX`} sub={`${(100 - fxRatio).toFixed(0)}% Gold`} />
      </div>

      {/* Resource Chart */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Production vs Consumption</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={resourceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            <Bar dataKey="production" fill="#34d399" name="Production" />
            <Bar dataKey="consumption" fill="#f87171" name="Consumption" />
            <Bar dataKey="inventory" fill="#60a5fa" name="Inventory" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Inventory + Objectives side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Inventory */}
        <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Inventory</h3>
          <div className="space-y-1.5">
            {human.inventory.map(inv => {
              const commodity = COMMODITIES.find(c => c.id === inv.commodityId);
              const cons = human.consumption.find(c => c.commodityId === inv.commodityId);
              const coverage = cons?.consumption ? (inv.quantity / cons.consumption) : 0;
              const barColor = coverage > 2 ? 'bg-emerald-500' : coverage > 1 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <div key={inv.commodityId} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20">{commodity?.name}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(100, coverage * 50)}%` }} />
                  </div>
                  <span className="text-xs text-white w-8 text-right">{inv.quantity}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Objectives */}
        <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-300 mb-2">Objectives</h3>
          <div className="space-y-2">
            {state.playerObjectives.map(obj => (
              <div key={obj.id} className="flex items-center justify-between">
                <span className="text-sm">{obj.completed ? '✅' : '🎯'} <span className="text-slate-300">{obj.name}</span></span>
                <span className="text-xs text-slate-400">{obj.current.toFixed(0)}% / {obj.target}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = '#e2e8f0' }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}

function getRank(countryId: string, history: any[]): number {
  if (history.length === 0) return 1;
  const last = history[history.length - 1];
  const scores = Object.entries(last.countryScores).sort(([, a], [, b]) => (b as number) - (a as number));
  const idx = scores.findIndex(([id]) => id === countryId);
  return idx >= 0 ? idx + 1 : 1;
}
