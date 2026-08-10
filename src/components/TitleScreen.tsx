import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { GameConfig } from '../engine/types';

export function TitleScreen() {
  const startGame = useGameStore(s => s.startGame);
  const loadGame = useGameStore(s => s.loadGame);
  const hasSave = !!localStorage.getItem('tradeshock-save');

  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [rounds, setRounds] = useState(12);
  const [difficulty, setDifficulty] = useState<GameConfig['difficulty']>('normal');

  const handleStart = () => {
    startGame({ seed, rounds, difficulty, humanCountryId: '' });
  };

  const handleLoad = () => {
    if (!loadGame()) alert('No saved game found or save is corrupted.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white tracking-tight">
            Trade<span className="text-emerald-400">Shock</span>
          </h1>
          <p className="text-slate-400 text-lg mt-1">International Trade Strategy Game</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Game Config */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700 space-y-5">
              <h2 className="text-lg font-bold text-white">New Game</h2>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Difficulty</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['easy', 'normal', 'hard', 'expert'] as const).map(d => (
                    <button key={d} onClick={() => setDifficulty(d)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        difficulty === d ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}>
                      {d === 'easy' ? '😊 Easy' : d === 'normal' ? '⚖️ Normal' : d === 'hard' ? '🔥 Hard' : '💀 Expert'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Duration ({rounds} quarters = {rounds/4} years)</label>
                <div className="flex gap-2">
                  {[8, 12, 20].map(r => (
                    <button key={r} onClick={() => setRounds(r)}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
                        rounds === r ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}>
                      {r === 8 ? 'Quick' : r === 12 ? 'Standard' : 'Extended'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Seed (same seed = same world)</label>
                <div className="flex gap-2">
                  <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm" />
                  <button onClick={() => setSeed(Math.floor(Math.random() * 1000000))}
                    className="bg-slate-700 hover:bg-slate-600 rounded-lg px-3 py-2 text-slate-300 text-sm">🎲</button>
                </div>
              </div>

              <button onClick={handleStart}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-lg transition">
                ▶ NEW GAME
              </button>

              {hasSave && (
                <button onClick={handleLoad}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 rounded-xl font-medium transition">
                  💾 CONTINUE SAVED GAME
                </button>
              )}
            </div>
          </div>

          {/* RIGHT: How to Win */}
          <div className="space-y-4">
            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-bold text-yellow-400 mb-4">🏆 How to Win</h2>

              <div className="space-y-3 text-sm">
                <div className="bg-slate-700/50 rounded-lg p-3">
                  <p className="text-white font-medium mb-1">Your goal: achieve the highest <span className="text-yellow-400">Economic Score (0-100)</span> among all 8 countries.</p>
                  <p className="text-slate-400 text-xs">The score is calculated every quarter from 7 factors. Top rank at game end wins.</p>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Scoring Breakdown</h3>
                  <div className="space-y-1.5">
                    <ScoreBar label="Economic Growth" pct={25} detail="Grow your GDP through trade surpluses and production" />
                    <ScoreBar label="Trade Sustainability" pct={20} detail="Keep trade deficit under control — don't just export, balance it" />
                    <ScoreBar label="FX Reserve Stability" pct={15} detail="Maintain healthy foreign currency reserves (don't let them run dry)" />
                    <ScoreBar label="Supply Chain Resilience" pct={15} detail="Diversify suppliers — don't depend on one country for critical imports" />
                    <ScoreBar label="Inflation Control" pct={10} detail="Keep inflation low — high imports + weak currency = inflation spiral" />
                    <ScoreBar label="Domestic Satisfaction" pct={10} detail="Ensure your population has enough food, energy, and essential goods" />
                    <ScoreBar label="Fiscal Stability" pct={5} detail="Keep government debt manageable relative to GDP" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-bold text-white mb-3">🎯 How to Play</h2>
              <div className="space-y-2 text-xs text-slate-300">
                <Rule step="1" title="Pick a country" body="Each has unique resources. Saudi Arabia exports oil, Japan makes electronics, Brazil grows food — choose your comparative advantage." />
                <Rule step="2" title="Each quarter, review shocks" body="A commodity price shock hits every round. Oil might crash, wheat might spike. Adapt your strategy." />
                <Rule step="3" title="Accept suggestions or manual trade" body="The AI advisor suggests what to export/import. Accept suggestions with one click, or manually trade with any partner." />
                <Rule step="4" title="Press END QUARTER" body="All orders execute. Market clears. Exchange rates, prices, GDP, inflation all update based on what happened." />
                <Rule step="5" title="React to cascading effects" body="A weak currency makes exports cheap but imports expensive → inflation rises → currency weakens further. Break the cycle!" />
                <Rule step="6" title="Win or survive" body="Finish with the highest Economic Score. Or just survive — if reserves run out or inflation explodes, you enter Crisis Mode." />
              </div>

              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-xs text-emerald-300">
                  <span className="font-bold">💡 Pro tip:</span> Don't just maximize exports. A country that exports everything but starves its people or drains its reserves will score poorly. Balance is everything.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, pct, detail }: { label: string; pct: number; detail: string }) {
  return (
    <div className="group relative">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-slate-300">{label}</span>
        <span className="text-yellow-400 text-[11px]">{pct}%</span>
      </div>
      <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
        <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="hidden group-hover:block absolute z-10 bg-slate-700 border border-slate-600 rounded-lg p-2 text-[11px] text-slate-300 w-56 -top-1 left-full ml-2 shadow-xl">
        {detail}
      </div>
    </div>
  );
}

function Rule({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-emerald-400 font-bold w-5 shrink-0">{step}.</span>
      <div>
        <span className="text-white font-medium">{title}</span>
        <span className="text-slate-400"> — {body}</span>
      </div>
    </div>
  );
}
