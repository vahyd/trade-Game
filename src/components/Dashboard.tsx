import { useGameStore } from '../store/gameStore';
import { Card, StatCard } from './ui';
import { generateAdvisorBoard } from '../engine/advisors';
import { formatCompact, formatMoney, formatPercent, formatRisk, formatSigned } from '../format';
import { STARTING } from '../engine/constants';
import type { CreditRating, Impact } from '../engine/types';

function ratingTone(r: CreditRating): 'pos' | 'neg' | 'neutral' {
  if (r === 'AAA' || r === 'AA' || r === 'A' || r === 'BBB') return 'pos';
  if (r === 'BB' || r === 'B') return 'neutral';
  return 'neg';
}

function impactColor(impact: Impact): string {
  if (impact === 'positive') return 'text-emerald-400';
  if (impact === 'negative') return 'text-rose-400';
  return 'text-slate-400';
}

export function Dashboard() {
  const game = useGameStore((s) => s.game)!;
  const c = game.company;
  const m = game.market;
  const last = game.lastResult;
  const advisors = generateAdvisorBoard(c, m);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Cash"
          value={formatMoney(c.cash)}
          sub={`${c.cash >= STARTING.cash ? '+' : ''}${formatCompact(c.cash - STARTING.cash)} vs start`}
          tone={c.cash < 0 ? 'neg' : 'pos'}
        />
        <StatCard
          label="Revenue / mo"
          value={formatMoney(last?.revenue ?? c.monthlyRevenue)}
          sub={`capacity ${formatCompact(c.monthlyRevenue)}`}
        />
        <StatCard
          label="Profit (last mo)"
          value={formatSigned(last?.profit ?? 0)}
          sub={`cumulative ${formatSigned(c.cumulativeProfit)}`}
          tone={c.cumulativeProfit >= 0 ? 'pos' : 'neg'}
        />
        <StatCard label="Debt" value={formatMoney(c.debt)} />
        <StatCard label="Inventory" value={formatMoney(c.inventory)} />
        <StatCard label="Credit Rating" value={c.creditRating} tone={ratingTone(c.creditRating)} />
        <StatCard
          label="Risk Score"
          value={formatRisk(c.riskScore)}
          tone={c.riskScore < 40 ? 'pos' : c.riskScore < 70 ? 'neutral' : 'neg'}
        />
        <StatCard label="Employees" value={String(c.employees)} sub={`${c.markets.join(', ')} · ${c.suppliers.join(', ')}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-200">Market Conditions</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">USD change</dt>
              <dd className={m.usdChange > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {m.usdChange > 0 ? '+' : ''}
                {formatPercent(m.usdChange)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Shipping costs</dt>
              <dd className={m.shippingMultiplier > 1 ? 'text-rose-400' : 'text-emerald-400'}>
                {m.shippingMultiplier.toFixed(2)}×
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Import tariff</dt>
              <dd className="text-slate-200">{formatPercent(m.tariffRate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Demand index</dt>
              <dd className="text-slate-200">{Math.round(m.demandIndex)}/100</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Recession risk</dt>
              <dd className="text-slate-200">{Math.round(m.recessionRisk)}/100</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-200">Advisor Board</h3>
          <ul className="mt-3 space-y-3">
            {advisors.map((a) => (
              <li key={a.advisor} className="flex gap-3">
                <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {a.advisor}
                </span>
                <span className="text-sm text-slate-200">{a.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-200">Market News</h3>
        <ul className="mt-3 space-y-2">
          {game.news.map((n) => (
            <li key={n.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${impactColor(n.impact)}`} />
              <span className="text-slate-300">{n.headline}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
