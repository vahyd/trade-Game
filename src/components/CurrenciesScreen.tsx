import { useGameStore } from '../store/gameStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function CurrenciesScreen() {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const currencyData = Object.values(state.countries).map(c => ({
    name: c.name,
    currency: c.currency,
    value: c.currencyValue,
    reserves: c.fxReserves,
    isHuman: c.isHuman,
  }));

  // FX reserve composition for human
  const totalReserves = human.fxReserves + human.goldReserves;
  const fxPct = totalReserves > 0 ? (human.fxReserves / totalReserves) * 100 : 0;
  const goldPct = totalReserves > 0 ? (human.goldReserves / totalReserves) * 100 : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">💱 Currencies & FX</h2>

      {/* My Currency */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">My Currency: {human.currency} ({human.currencyName})</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-slate-400">1 GTU =</div>
            <div className="text-2xl font-bold text-white">{human.currencyValue} {human.currency}</div>
          </div>
          <div>
            <div className="text-slate-400">FX Reserves</div>
            <div className="text-xl font-bold text-emerald-400">${human.fxReserves.toFixed(0)}B</div>
          </div>
          <div>
            <div className="text-slate-400">Gold Reserves</div>
            <div className="text-xl font-bold text-yellow-400">${human.goldReserves.toFixed(0)}B</div>
          </div>
          <div>
            <div className="text-slate-400">Inflation</div>
            <div className={`text-xl font-bold ${human.inflation > 6 ? 'text-red-400' : 'text-yellow-400'}`}>
              {human.inflation.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Reserve composition */}
        <div className="mt-4">
          <div className="text-xs text-slate-400 mb-2">Reserve Composition</div>
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
            <div className="bg-emerald-500 h-full" style={{ width: `${fxPct}%` }} />
            <div className="bg-yellow-500 h-full" style={{ width: `${goldPct}%` }} />
          </div>
          <div className="flex gap-4 mt-1 text-xs">
            <span className="text-emerald-400">FX: {fxPct.toFixed(0)}%</span>
            <span className="text-yellow-400">Gold: {goldPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* All Currencies */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Global Exchange Rates (vs GTU)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={currencyData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
              formatter={(value: any) => [`${Number(value).toFixed(2)}`, '1 GTU =']}
            />
            <Bar
              dataKey="value"
              fill="#60a5fa"
              radius={[0, 4, 4, 0]}
              label={({ value, currency }: any) => `${Number(value).toFixed(2)}`}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Currency Details Table */}
      <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="text-left px-4 py-2 text-slate-400 text-xs">Country</th>
              <th className="text-left px-4 py-2 text-slate-400 text-xs">Currency</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">1 GTU =</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">FX Reserves</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Inflation</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Debt/GDP</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(state.countries).map(c => (
              <tr key={c.id} className={`border-t border-slate-700/50 ${c.isHuman ? 'bg-emerald-500/5' : ''}`}>
                <td className="px-4 py-2">
                  <span className="text-white">{c.name}</span>
                  {c.isHuman && <span className="text-emerald-400 text-xs ml-1">(You)</span>}
                </td>
                <td className="px-4 py-2 text-slate-300">{c.currency}</td>
                <td className="px-4 py-2 text-right font-mono text-white">{c.currencyValue.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-slate-300">${c.fxReserves.toFixed(0)}B</td>
                <td className={`px-4 py-2 text-right ${c.inflation > 6 ? 'text-red-400' : 'text-slate-300'}`}>{c.inflation.toFixed(1)}%</td>
                <td className="px-4 py-2 text-right text-slate-300">{(c.debtToGDP * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
