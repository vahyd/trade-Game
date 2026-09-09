import { useGameStore } from '../store/gameStore';
import { DecisionsScreen } from './DecisionsScreen';
import { OutcomeReport } from './OutcomeReport';
import { HistoryScreen } from './HistoryScreen';
import { formatCompact, formatPercent, formatRisk } from '../format';
import { ratingColor } from './ui';
import { TOTAL_MONTHS } from '../engine/constants';

function Indicator({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'pos' | 'warn' | 'neg' | 'neutral';
}) {
  const color =
    tone === 'pos'
      ? 'text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-400'
        : tone === 'neg'
          ? 'text-rose-400'
          : 'text-slate-200';
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

export function GameShell() {
  const game = useGameStore((s) => s.game)!;
  const m = game.market;

  return (
    <div className="mx-auto max-w-6xl p-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <div className="text-lg font-bold text-slate-50">Trade CFO</div>
          <div className="text-xs text-slate-400">
            Month {game.month} of {TOTAL_MONTHS}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-slate-400">Cash </span>
            <span className={`font-semibold ${game.company.cash < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {formatCompact(game.company.cash)}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Risk </span>
            <span className="font-semibold text-slate-100">{formatRisk(game.company.riskScore)}</span>
          </div>
          <div>
            <span className="text-slate-400">Rating </span>
            <span className={`font-semibold ${ratingColor(game.company.creditRating)}`}>
              {game.company.creditRating}
            </span>
          </div>
        </div>
      </div>

      {game.event && (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            game.event.impact === 'negative'
              ? 'border-rose-800/60 bg-rose-900/10'
              : 'border-emerald-800/60 bg-emerald-900/10'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Monthly event · {game.event.category}
          </div>
          <div className={`mt-1 text-base font-semibold ${game.event.impact === 'negative' ? 'text-rose-300' : 'text-emerald-300'}`}>
            {game.event.name}
          </div>
          <p className="mt-1 text-sm text-slate-300">{game.event.description}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Indicator
          label="Currency (FX)"
          value={`${m.usdChange > 0 ? '+' : ''}${formatPercent(m.usdChange)}`}
          tone={Math.abs(m.usdChange) > 0.05 ? 'neg' : 'neutral'}
        />
        <Indicator
          label="Credit Climate"
          value={`${Math.round(m.recessionRisk)}/100`}
          tone={m.recessionRisk > 60 ? 'neg' : m.recessionRisk > 35 ? 'warn' : 'pos'}
        />
        <Indicator
          label="Supply Chain"
          value={`Ship ${m.shippingMultiplier.toFixed(1)}× · Tariff ${Math.round(m.tariffRate * 100)}%`}
          tone={m.shippingMultiplier > 1.2 || m.tariffRate > 0.1 ? 'neg' : 'pos'}
        />
      </div>

      <div className="mt-4 space-y-6">
        <DecisionsScreen key={game.month} />
        <OutcomeReport />
        <HistoryScreen />
      </div>
    </div>
  );
}
