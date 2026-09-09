import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { fetchLeaderboard, submitScore, type LeaderboardEntry } from '../api/client';
import { Card } from './ui';
import { formatMoney } from '../format';

function MetricBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400">
          {value} / 100 · {weight}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

export function ResultsScreen() {
  const game = useGameStore((s) => s.game)!;
  const newGame = useGameStore((s) => s.newGame);
  const backToTitle = useGameStore((s) => s.backToTitle);

  const score = game.finalScore!;
  const [name, setName] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetchLeaderboard().then(setLeaderboard);
  }, []);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitState('saving');
    const res = await submitScore(name.trim(), score);
    if (res.ok) {
      setSubmitState('done');
      setSubmitMsg('Score submitted to the leaderboard.');
      fetchLeaderboard().then(setLeaderboard);
    } else {
      setSubmitState('error');
      setSubmitMsg(res.error ?? 'Failed to submit.');
    }
  }

  const rankColor =
    score.ranking === 'Expert CFO'
      ? 'text-emerald-400'
      : score.ranking === 'Good CFO'
        ? 'text-lime-400'
        : score.ranking === 'Average CFO'
          ? 'text-amber-400'
          : 'text-rose-400';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Card className="p-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          {game.bankrupt ? 'Company bankrupt' : 'Simulation complete'}
        </div>
        <div className="mt-2 text-6xl font-black text-slate-50">{score.score}</div>
        <div className={`mt-2 text-2xl font-bold ${rankColor}`}>{score.ranking}</div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-200">Score breakdown</h3>
        <div className="space-y-4">
          <MetricBar label="Cash Growth" value={score.cashGrowth} weight="30%" />
          <MetricBar label="Profit Growth" value={score.profitGrowth} weight="30%" />
          <MetricBar label="Risk Management" value={score.riskManagement} weight="20%" />
          <MetricBar label="Credit Rating" value={score.creditScore} weight="10%" />
          <MetricBar label="Survival" value={score.survival} weight="10%" />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Company value</div>
          <div className="mt-1 text-lg font-bold text-slate-100">{formatMoney(score.finalCompanyValue)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Total profit</div>
          <div className={`mt-1 text-lg font-bold ${score.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatMoney(score.totalProfit)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Final cash</div>
          <div className="mt-1 text-lg font-bold text-slate-100">{formatMoney(score.totalCash)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Risk / Rating</div>
          <div className="mt-1 text-lg font-bold text-slate-100">
            {score.riskScore} <span className="text-sm text-slate-400">/ {score.creditRating}</span>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-200">Save to leaderboard</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitState === 'saving'}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitState === 'saving' ? 'Saving…' : 'Submit'}
          </button>
        </div>
        {submitMsg && <p className={`mt-2 text-xs ${submitState === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>{submitMsg}</p>}
      </Card>

      {leaderboard.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Leaderboard</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Ranking</th>
                <th className="py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((e, i) => (
                <tr key={e.id} className="border-b border-slate-800/60 text-slate-300">
                  <td className="py-1.5 pr-3">{i + 1}</td>
                  <td className="py-1.5 pr-3">{e.name}</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-100">{e.score}</td>
                  <td className="py-1.5 pr-3">{e.ranking}</td>
                  <td className="py-1.5">{formatMoney(e.total_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => newGame()}
          className="flex-1 rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Play again
        </button>
        <button
          onClick={backToTitle}
          className="flex-1 rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
        >
          Back to title
        </button>
      </div>
    </div>
  );
}
