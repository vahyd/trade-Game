import { useGameStore } from '../store/gameStore';

export function RankingsPanel() {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const rankings = Object.values(state.countries)
    .sort((a, b) => b.economicScore - a.economicScore);

  const getMedal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-white">🏆 Global Rankings</h2>

      <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="text-left px-4 py-2 text-slate-400 text-xs w-12">#</th>
              <th className="text-left px-4 py-2 text-slate-400 text-xs">Country</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Score</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">GDP</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Trade</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Reserves</th>
              <th className="text-right px-4 py-2 text-slate-400 text-xs">Inflation</th>
              <th className="text-center px-4 py-2 text-slate-400 text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((c, i) => (
              <tr key={c.id} className={`border-t border-slate-700/50 ${c.isHuman ? 'bg-emerald-500/10' : ''}`}>
                <td className="px-4 py-2.5 font-bold text-slate-400">
                  {getMedal(i)} {i + 1}
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-white">{c.name}</span>
                  {c.isHuman && <span className="text-emerald-400 text-xs ml-1">(You)</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-yellow-400">{c.economicScore}</td>
                <td className="px-4 py-2.5 text-right text-slate-300">${c.gdp.toFixed(0)}B</td>
                <td className={`px-4 py-2.5 text-right ${c.tradeBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {c.tradeBalance >= 0 ? '+' : ''}{c.tradeBalance.toFixed(1)}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-300">${c.fxReserves.toFixed(0)}B</td>
                <td className={`px-4 py-2.5 text-right ${c.inflation > 6 ? 'text-red-400' : 'text-slate-300'}`}>
                  {c.inflation.toFixed(1)}%
                </td>
                <td className="px-4 py-2.5 text-center">
                  {c.inCrisis ? <span className="text-xs text-red-400">⚠ Crisis</span> : <span className="text-xs text-emerald-400">OK</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Currency comparison */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Exchange Rates (1 GTU =)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.values(state.countries).map(c => (
            <div key={c.id} className={`rounded-lg px-3 py-2 ${c.isHuman ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/30'}`}>
              <div className="text-xs text-slate-400">{c.name}</div>
              <div className="text-sm font-mono text-white">{c.currencyValue} {c.currency}</div>
              <div className="text-xs text-slate-500">FX: ${c.fxReserves.toFixed(0)}B</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
