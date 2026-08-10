import type { Shock } from '../engine/types';
import { COMMODITIES } from '../engine/data';

const severityColors: Record<string, string> = {
  minor: 'border-yellow-500/50 bg-yellow-500/5',
  moderate: 'border-orange-500/50 bg-orange-500/5',
  major: 'border-red-500/50 bg-red-500/5',
  crisis: 'border-red-600 bg-red-600/10',
};

const severityLabels: Record<string, string> = {
  minor: '⚠ Minor',
  moderate: '⚠️ Moderate',
  major: '🔴 Major',
  crisis: '🚨 CRISIS',
};

export function ShockCard({ shock }: { shock: Shock }) {
  return (
    <div className={`rounded-xl border-2 p-4 mb-4 ${severityColors[shock.severity]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{severityLabels[shock.severity].split(' ')[0]}</span>
          <h3 className="text-lg font-bold text-white">{shock.name}</h3>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          shock.severity === 'crisis' ? 'bg-red-600 text-white' :
          shock.severity === 'major' ? 'bg-red-500/20 text-red-300' :
          shock.severity === 'moderate' ? 'bg-orange-500/20 text-orange-300' :
          'bg-yellow-500/20 text-yellow-300'
        }`}>
          {severityLabels[shock.severity]}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-3">{shock.description}</p>

      {/* Effects */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-3">
        {shock.effects.commodityPriceModifiers && Object.entries(shock.effects.commodityPriceModifiers).map(([cid, mod]) => {
          if (mod == null) return null;
          const c = COMMODITIES.find(c => c.id === cid);
          return (
            <div key={cid} className="bg-slate-800/60 rounded-lg px-2 py-1">
              <span className="text-slate-400">{c?.name}: </span>
              <span className={mod > 0 ? 'text-red-400' : 'text-emerald-400'}>
                {mod > 0 ? '+' : ''}{mod}%
              </span>
            </div>
          );
        })}
        {shock.effects.shippingCostModifier && (
          <div className="bg-slate-800/60 rounded-lg px-2 py-1">
            <span className="text-slate-400">Shipping: </span>
            <span className="text-red-400">{shock.effects.shippingCostModifier > 0 ? '+' : ''}{shock.effects.shippingCostModifier}%</span>
          </div>
        )}
        {shock.effects.exchangeRateModifiers && Object.entries(shock.effects.exchangeRateModifiers).map(([cid, mod]) => {
          if (mod == null) return null;
          return (
            <div key={cid} className="bg-slate-800/60 rounded-lg px-2 py-1">
              <span className="text-slate-400">{cid}: </span>
              <span className={mod > 0 ? 'text-red-400' : 'text-emerald-400'}>
                {mod > 0 ? '+' : ''}{mod}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Affected */}
      <div className="flex gap-4 text-xs text-slate-400">
        <span>Duration: {shock.effects.duration} rounds</span>
        {shock.affectedCountries.length > 0 && (
          <span>Affected: {shock.affectedCountries.join(', ')}</span>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-2 italic">How will you respond?</p>
    </div>
  );
}
