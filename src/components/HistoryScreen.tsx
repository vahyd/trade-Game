import { useGameStore } from '../store/gameStore';
import { Card } from './ui';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompact, formatSignedCompact } from '../format';

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '10px',
  fontSize: '12px',
  color: '#e2e8f0',
};

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
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-200">Cash position</h3>
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="cash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => formatCompact(Number(v))}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCompact(Number(v))} />
                  <Area type="monotone" dataKey="Cash" name="Cash" stroke="#34d399" strokeWidth={2.5} fill="url(#cash)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-200">Revenue &amp; profit per month</h3>
            <div className="mt-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => formatCompact(Number(v))}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCompact(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} iconType="circle" iconSize={8} />
                  <Bar dataKey="Profit" name="Profit" fill="#34d399" opacity={0.55} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="Revenue" name="Revenue" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-200">Risk score</h3>
            <div className="mt-2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="risk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} width={40} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="Risk" name="Risk" stroke="#fb7185" strokeWidth={2.5} fill="url(#risk)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-x-auto p-5">
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
