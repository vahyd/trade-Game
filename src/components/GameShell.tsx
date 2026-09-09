import { useGameStore } from '../store/gameStore';
import { DecisionsScreen } from './DecisionsScreen';
import { OutcomeReport } from './OutcomeReport';
import { HistoryScreen } from './HistoryScreen';
import { formatCompact, formatRisk } from '../format';
import { ratingColor } from './ui';
import { TOTAL_MONTHS } from '../engine/constants';

export function GameShell() {
  const game = useGameStore((s) => s.game)!;

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

      <div className="mt-4 space-y-6">
        <DecisionsScreen key={game.month} />
        <OutcomeReport />
        <HistoryScreen />
      </div>
    </div>
  );
}
