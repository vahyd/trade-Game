import { useGameStore } from '../store/gameStore';
import { Card } from './ui';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatSignedCompact } from '../format';

export function HistoryScreen() {
  const game = useGameStore((s) => s.game)!;

  const data = game.history.map((h) => ({
    month: h.month,
    Cash: Math.round(h.cashAfter),
    Profit: Math.round(h.profit),
    Revenue: Math.round(h.revenue),
    Risk: h.riskScore,
  }));

  return (
    <div className="space-y-6">
      {data.length === 0 ? (
        <Card className="p-6 text-sm text-slate-400">
          No history yet. Complete your first month to see performance charts.
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Cash position</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="cash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => formatCompact(Number(v))} />
                  <Tooltip formatter={(v) => formatCompact(Number(v))} />
                  <Area type="monotone" dataKey="Cash" stroke="#34d399" fill="url(#cash)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Revenue &amp; profit per month</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => formatCompact(Number(v))} />
                  <Tooltip formatter={(v) => formatCompact(Number(v))} />
                  <Line type="monotone" dataKey="Revenue" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Bar dataKey="Profit" fill="#34d399" opacity={0.6} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Risk score</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Risk" stroke="#fb7185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-x-auto p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Monthly history</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Month</th>
                  <th className="py-2 pr-4">Revenue</th>
                  <th className="py-2 pr-4">Profit</th>
                  <th className="py-2 pr-4">Cash</th>
                  <th className="py-2 pr-4">Risk</th>
                  <th className="py-2">Rating</th>
                </tr>
              </thead>
              <tbody>
                {game.history.map((h) => (
                  <tr key={h.month} className="border-b border-slate-800/60 text-slate-300">
                    <td className="py-1.5 pr-4">{h.month}</td>
                    <td className="py-1.5 pr-4">{formatCompact(h.revenue)}</td>
                    <td className={`py-1.5 pr-4 ${h.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatSignedCompact(h.profit)}
                    </td>
                    <td className="py-1.5 pr-4">{formatCompact(h.cashAfter)}</td>
                    <td className="py-1.5 pr-4">{h.riskScore}</td>
                    <td className="py-1.5">{h.creditRating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
