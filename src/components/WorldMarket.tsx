import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function WorldMarket() {
  const state = useGameStore(s => s.state);
  const [selectedCommodity, setSelectedCommodity] = useState<string | null>(null);

  if (!state) return null;

  const commodity = selectedCommodity ? state.commodities[selectedCommodity] : null;

  // Price history
  const priceHistory = state.roundHistory.map(r => {
    const entry: any = { round: r.round };
    for (const cid of Object.keys(state.commodities)) {
      entry[cid] = state.commodities[cid]?.currentGlobalPrice ?? 0;
    }
    return entry;
  });

  if (priceHistory.length > 0) {
    const r0: any = { round: 0 };
    for (const c of COMMODITIES) r0[c.id] = c.globalBasePrice;
    priceHistory.unshift(r0);
  }

  // Supply/demand data for selected commodity
  const supplyDemandData = commodity ? (() => {
    const data: { country: string; supply: number; demand: number }[] = [];
    for (const c of Object.values(state.countries)) {
      const prod = c.production.find(p => p.commodityId === commodity.id);
      const cons = c.consumption.find(co => co.commodityId === commodity.id);
      if ((prod?.production ?? 0) > 0 || (cons?.consumption ?? 0) > 0) {
        data.push({
          country: c.name,
          supply: prod?.production ?? 0,
          demand: cons?.consumption ?? 0,
        });
      }
    }
    return data.sort((a, b) => b.supply - a.supply);
  })() : [];

  // Price trend data for selected commodity
  const selectedPriceData = commodity ? priceHistory.map((r: any) => ({
    round: r.round,
    price: r[commodity.id] ?? commodity.globalBasePrice,
  })) : [];

  const demandPressure = commodity && commodity.supply > 0 ? commodity.demand / commodity.supply : 0;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-white">🌍 World Market</h2>

      {/* Price Trend Chart — all commodities */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Commodity Price Trends</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={priceHistory.length > 0 ? priceHistory : [{ round: 0, oil: 70, gas: 40, wheat: 25, food: 30, steel: 50, copper: 60, electronics: 100, machinery: 80 }]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="round" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            {COMMODITIES.slice(0, 4).map((c, i) => (
              <Line key={c.id} type="monotone" dataKey={c.id} name={c.name}
                stroke={['#f59e0b', '#3b82f6', '#10b981', '#ef4444'][i]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Commodity Table */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="text-left px-4 py-2 text-slate-400 text-xs">Commodity</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Price</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Δ</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Supply</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Demand</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">S/D Ratio</th>
              <th className="text-center px-4 py-2 text-slate-400 text-xs">Trend</th>
            </tr>
          </thead>
          <tbody>
            {COMMODITIES.map(c => {
              const current = state.commodities[c.id];
              if (!current) return null;
              const change = ((current.currentGlobalPrice - c.globalBasePrice) / c.globalBasePrice) * 100;
              const ratio = current.supply > 0 ? current.demand / current.supply : 0;
              const trend = ratio > 1.05 ? '↑' : ratio < 0.95 ? '↓' : '→';
              const ratioColor = ratio > 1.1 ? 'text-red-400' : ratio < 0.9 ? 'text-emerald-400' : 'text-slate-300';

              return (
                <tr key={c.id}
                  onClick={() => setSelectedCommodity(selectedCommodity === c.id ? null : c.id)}
                  className={`border-t border-slate-700/50 cursor-pointer hover:bg-slate-700/30 transition ${
                    selectedCommodity === c.id ? 'bg-slate-700/40' : ''
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-white">{c.name}</span>
                    <span className="text-xs text-slate-500 ml-1.5">{c.unit}</span>
                  </td>
                  <td className="text-right px-4 py-2.5 font-mono text-white text-xs">{current.currentGlobalPrice.toFixed(1)}</td>
                  <td className={`text-right px-4 py-2.5 text-xs ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </td>
                  <td className="text-right px-4 py-2.5 text-slate-400 text-xs">{current.supply.toFixed(0)}</td>
                  <td className="text-right px-4 py-2.5 text-slate-400 text-xs">{current.demand.toFixed(0)}</td>
                  <td className={`text-right px-4 py-2.5 text-xs font-mono ${ratioColor}`}>{ratio.toFixed(2)}</td>
                  <td className="text-center px-4 py-2.5 text-xs">{trend}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Commodity Detail */}
      {commodity && (
        <div className="space-y-4">
          {/* Price Trend for selected */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              {COMMODITIES.find(c => c.id === commodity.id)?.name} — Price History
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={selectedPriceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="round" tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'Quarter', position: 'insideBottom', fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  formatter={(v: any) => [`${Number(v).toFixed(1)} GTU`, 'Price']} />
                <Line type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Supply vs Demand by Country */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Supply vs Demand by Country
              {demandPressure !== undefined && (
                <span className={`ml-2 text-xs ${demandPressure > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                  (Market: {demandPressure > 1.05 ? 'Shortage' : demandPressure < 0.95 ? 'Surplus' : 'Balanced'})
                </span>
              )}
            </h3>
            {supplyDemandData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={supplyDemandData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis dataKey="country" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
                  <Bar dataKey="supply" fill="#34d399" name="Supply" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="demand" fill="#f87171" name="Demand" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-500">No country-level data available.</p>
            )}
          </div>

          {/* Stats */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div><span className="text-slate-400">Price:</span> <span className="text-white font-mono">{commodity.currentGlobalPrice.toFixed(1)} GTU</span></div>
              <div><span className="text-slate-400">Base:</span> <span className="text-white font-mono">{commodity.globalBasePrice} GTU</span></div>
              <div><span className="text-slate-400">Global Supply:</span> <span className="text-white">{commodity.supply.toFixed(0)}</span></div>
              <div><span className="text-slate-400">Global Demand:</span> <span className="text-white">{commodity.demand.toFixed(0)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
