import { useGameStore } from '../store/gameStore';
import type { CountryId } from '../engine/types';
import { COUNTRIES, COMMODITIES } from '../engine/data';

export function CountrySelect() {
  const state = useGameStore(s => s.state);
  const selectCountry = useGameStore(s => s.selectCountry);

  if (!state) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Select Your Country</h1>
        <p className="text-slate-400 mb-8">Choose the nation you will lead through the global economy.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COUNTRIES.map(country => {
            const isSelected = state.config.humanCountryId === country.id;
            return (
              <button
                key={country.id}
                onClick={() => selectCountry(country.id as CountryId)}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02]'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{country.name}</h3>
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                    {country.currency}
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">GDP</span>
                    <span className="text-slate-200">${country.gdp}B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reserves</span>
                    <span className="text-slate-200">${country.fxReserves}B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Inflation</span>
                    <span className={country.inflation > 5 ? 'text-red-400' : 'text-slate-200'}>
                      {country.inflation}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">1 GTU =</span>
                    <span className="text-slate-200">{country.currencyValue} {country.currency}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700">
                  <div className="text-xs text-slate-500 mb-1">Exports</div>
                  <div className="flex flex-wrap gap-1">
                    {country.production.slice(0, 3).map(p => (
                      <span key={p.commodityId} className="text-xs bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded">
                        {COMMODITIES.find(c => c.id === p.commodityId)?.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">Imports</div>
                  <div className="flex flex-wrap gap-1">
                    {country.consumption.filter(c => c.required).slice(0, 3).map(c => (
                      <span key={c.commodityId} className="text-xs bg-red-900/40 text-red-300 px-2 py-0.5 rounded">
                        {COMMODITIES.find(cm => cm.id === c.commodityId)?.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-500 capitalize">
                  Strategy: {country.aiPersonality.replace(/-/g, ' ')}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
