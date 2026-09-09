import { useGameStore } from '../store/gameStore';
import { Card } from './ui';
import { formatCompact, formatSignedCompact } from '../format';

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-slate-100' : 'text-slate-400'}`}>
      <span>{label}</span>
      <span className={bold ? 'text-slate-100' : 'text-slate-300'}>{value}</span>
    </div>
  );
}

export function OutcomeReport() {
  const game = useGameStore((s) => s.game)!;
  const last = game.lastResult;

  if (!last) return null;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-100">Month {last.month} Results</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-slate-800 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Income statement</div>
            <Row label="Revenue" value={formatCompact(last.revenue)} />
            <Row label="Cost of goods sold" value={`−${formatCompact(last.cogs)}`} />
            <Row label="Salaries" value={`−${formatCompact(last.salaries)}`} />
            <Row label="Overhead" value={`−${formatCompact(last.overhead)}`} />
            <Row label="Shipping" value={`−${formatCompact(last.shipping)}`} />
            <Row label="Interest" value={`−${formatCompact(last.interest)}`} />
            <Row label="Inventory carrying" value={`−${formatCompact(last.carrying)}`} />
            <Row label="Tariffs" value={`−${formatCompact(last.tariff)}`} />
            <Row
              label="FX impact"
              value={last.fxImpact >= 0 ? formatSignedCompact(last.fxImpact) : `−${formatCompact(Math.abs(last.fxImpact))}`}
            />
            <Row label="Net profit" value={formatSignedCompact(last.profit)} bold />
          </div>

          <div className="space-y-2 rounded-lg border border-slate-800 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Balance sheet</div>
            <Row label="Cash (start)" value={formatCompact(last.cashBefore)} />
            <Row label="Cash (end)" value={formatCompact(last.cashAfter)} bold />
            <Row label="Debt (start)" value={formatCompact(last.debtBefore)} />
            <Row label="Debt (end)" value={formatCompact(last.debtAfter)} />
            <Row label="Credit rating" value={last.creditRating} bold />
            <Row label="Risk score" value={`${last.riskScore}/100`} bold />
          </div>
        </div>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">What happened</h3>
        <div className="space-y-3">
          {last.outcomes.map((o, i) => (
            <div
              key={i}
              className={`rounded-xl border p-4 ${
                o.good ? 'border-emerald-800/60 bg-emerald-900/10' : 'border-rose-800/60 bg-rose-900/10'
              }`}
            >
              <div className={`text-sm font-semibold ${o.good ? 'text-emerald-300' : 'text-rose-300'}`}>
                {o.title}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{o.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
