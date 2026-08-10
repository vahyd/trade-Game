import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';

export function IntelligenceScreen() {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">🔍 Economic Intelligence</h2>
      <p className="text-sm text-slate-400">
        Price forecasts based on current market conditions. Confidence varies with volatility.
      </p>

      {/* Commodity Forecasts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {COMMODITIES.map(c => {
          const commodity = state.commodities[c.id];
          if (!commodity) return null;
          const price = commodity.currentGlobalPrice;
          const vol = c.volatility;
          const range = price * vol * 0.5;
          const demandPressure = commodity.supply > 0 ? (commodity.demand - commodity.supply) / commodity.supply : 0;
          const mid = price * (1 + demandPressure * 0.2);
          const min = Math.round(mid - range);
          const max = Math.round(mid + range);
          const confidence = Math.round((1 - vol) * 100);

          return (
            <div key={c.id} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <div className="text-sm font-medium text-white mb-2">{c.name}</div>
              <div className="text-2xl font-bold text-white mb-1">${price.toFixed(1)}</div>
              <div className="text-xs text-slate-400 mb-2">
                Forecast: ${min} – ${max}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{confidence}%</span>
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {demandPressure > 0.1 ? '📈 Demand pressure building' :
                 demandPressure < -0.1 ? '📉 Supply exceeds demand' :
                 '↔️ Market balanced'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Country Rankings */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Global Economic Rankings</h3>
        <div className="space-y-2">
          {Object.values(state.countries)
            .sort((a, b) => b.economicScore - a.economicScore)
            .map((c, i) => (
              <div key={c.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${c.isHuman ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-slate-700/30'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${i === 0 ? 'text-yellow-400' : 'text-slate-400'}`}>#{i + 1}</span>
                  <span className="text-white text-sm">{c.name}</span>
                  {c.isHuman && <span className="text-emerald-400 text-xs">(You)</span>}
                  {c.inCrisis && <span className="text-red-400 text-xs">⚠ Crisis</span>}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">GDP: ${c.gdp.toFixed(0)}B</span>
                  <span className="text-slate-400">Trade: {c.tradeBalance >= 0 ? '+' : ''}{c.tradeBalance.toFixed(1)}</span>
                  <span className="text-yellow-400 font-bold">{c.economicScore}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Supply Chain Risk */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Supply Chain Risk Analysis</h3>
        {Object.entries(human.supplierConcentration).length === 0 ? (
          <p className="text-sm text-slate-500">No significant import dependencies detected.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(human.supplierConcentration).map(([commodityId, suppliers]) => {
              const commodity = COMMODITIES.find(c => c.id === commodityId);
              const dominant = suppliers.find(s => s.share > 0.5);
              return (
                <div key={commodityId} className="bg-slate-700/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium">{commodity?.name}</span>
                    {dominant && (
                      <span className="text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded">
                        ⚠ {Math.round(dominant.share * 100)}% from {state.countries[dominant.supplier]?.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {suppliers.map(s => (
                      <div
                        key={s.supplier}
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${s.share * 100}%` }}
                        title={`${state.countries[s.supplier]?.name}: ${Math.round(s.share * 100)}%`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
