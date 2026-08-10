import { useGameStore } from '../store/gameStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function ResultsScreen() {
  const state = useGameStore(s => s.state);
  const startGame = useGameStore(s => s.startGame);
  const deleteSave = useGameStore(s => s.deleteSave);

  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  // Final rankings
  const rankings = Object.values(state.countries)
    .sort((a, b) => b.economicScore - a.economicScore);

  const chartData = rankings.map(c => ({
    name: c.name,
    score: c.economicScore,
    gdp: c.gdp,
    isHuman: c.isHuman,
  }));

  const objectivesCompleted = state.playerObjectives.filter(o => o.completed).length;
  const humanRank = rankings.findIndex(c => c.id === human.id) + 1;

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Game Over</h1>
          <p className="text-slate-400">
            {humanRank === 1
              ? '🏆 Congratulations! You led your economy to the top!'
              : humanRank <= 3
              ? `Great performance — you ranked #${humanRank}!`
              : `You ranked #${humanRank}. Study the results and try a different strategy.`}
          </p>
        </div>

        {/* Final Score */}
        <div className="text-center">
          <div className="text-6xl font-bold text-yellow-400">{human.economicScore}</div>
          <div className="text-slate-400 text-sm">Economic Performance Score</div>
        </div>

        {/* Rankings */}
        <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-bold text-white mb-4">Final Rankings</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
              <YAxis tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
              <Bar dataKey="score" name="Economic Score" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Rankings */}
        <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="text-left px-4 py-2 text-slate-400 text-xs">Rank</th>
                <th className="text-left px-4 py-2 text-slate-400 text-xs">Country</th>
                <th className="text-right px-4 py-2 text-slate-400 text-xs">Score</th>
                <th className="text-right px-4 py-2 text-slate-400 text-xs">GDP</th>
                <th className="text-right px-4 py-2 text-slate-400 text-xs">Trade Balance</th>
                <th className="text-right px-4 py-2 text-slate-400 text-xs">FX Reserves</th>
                <th className="text-right px-4 py-2 text-slate-400 text-xs">Inflation</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((c, i) => (
                <tr key={c.id} className={`border-t border-slate-700/50 ${c.isHuman ? 'bg-emerald-500/10' : ''}`}>
                  <td className="px-4 py-2">
                    <span className="font-bold">{getRankEmoji(i + 1)} #{i + 1}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-white">{c.name}</span>
                    {c.isHuman && <span className="text-emerald-400 text-xs ml-1">(You)</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-yellow-400">{c.economicScore}</td>
                  <td className="px-4 py-2 text-right text-slate-300">${c.gdp.toFixed(0)}B</td>
                  <td className={`px-4 py-2 text-right ${c.tradeBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {c.tradeBalance >= 0 ? '+' : ''}{c.tradeBalance.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-300">${c.fxReserves.toFixed(0)}B</td>
                  <td className={`px-4 py-2 text-right ${c.inflation > 6 ? 'text-red-400' : 'text-slate-300'}`}>{c.inflation.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Objectives */}
        <div className="bg-slate-800/60 rounded-xl p-6 border border-slate-700">
          <h2 className="text-lg font-bold text-white mb-3">Objectives Completed: {objectivesCompleted}/{state.playerObjectives.length}</h2>
          <div className="space-y-2">
            {state.playerObjectives.map(obj => (
              <div key={obj.id} className="flex items-center justify-between">
                <span className="text-sm">{obj.completed ? '✅' : '❌'} {obj.name}</span>
                <span className="text-xs text-slate-400">{obj.description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => {
              deleteSave();
              startGame({
                seed: Math.floor(Math.random() * 1000000),
                rounds: state.config.rounds,
                difficulty: state.config.difficulty,
                humanCountryId: '',
              });
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold text-lg transition"
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}
