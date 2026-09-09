import { useGameStore } from '../store/gameStore';

export function TitleScreen() {
  const newGame = useGameStore((s) => s.newGame);
  const hasSaved = useGameStore((s) => s.hasSaved);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
            International Trade · Finance Simulator
          </div>
          <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-50">
            Trade CFO
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
            Step into the CFO chair of an international trading company. Manage cash, currency
            risk, customer credit, and financing decisions across 60 months — and learn what
            keeps a global trading business alive.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { title: 'Decide', desc: 'Every month, make 3–5 decisions on FX, credit, inventory, and financing.' },
            { title: 'Learn', desc: 'See the outcome of each choice explained in plain language.' },
            { title: 'Rank', desc: 'Score as a Poor, Average, Good, or Expert CFO.' },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-sm font-semibold text-slate-100">{f.title}</div>
              <div className="mt-1 text-xs leading-relaxed text-slate-400">{f.desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => newGame()}
            className="w-full max-w-xs rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Start New Game
          </button>
          {hasSaved && (
            <button
              onClick={() => {
                /* saved game is already loaded; just reload to re-render */
                window.location.reload();
              }}
              className="w-full max-w-xs rounded-lg border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
            >
              Continue Saved Game
            </button>
          )}
          <p className="text-xs text-slate-500">
            No login required · Progress auto-saves to your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
