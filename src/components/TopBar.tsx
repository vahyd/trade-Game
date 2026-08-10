import { useGameStore } from '../store/gameStore';

export function TopBar() {
  const state = useGameStore(s => s.state);
  const executeRound = useGameStore(s => s.executeRound);
  const saveGame = useGameStore(s => s.saveGame);

  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const balanceColor = human.tradeBalance >= 0 ? 'text-emerald-400' : 'text-red-400';
  const completedObjectives = state.playerObjectives.filter(o => o.completed).length;

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-white">
          Trade<span className="text-emerald-400">Shock</span>
        </h1>
        <span className="text-sm text-slate-400">|</span>
        <span className="text-sm font-medium text-white">{human.name}</span>
        <span className="text-xs bg-slate-700 px-2 py-0.5 rounded">{human.currency}</span>
        {human.inCrisis && <span className="text-xs text-red-400 font-bold animate-pulse">🚨 CRISIS</span>}
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="text-center">
          <div className="text-slate-400 text-xs">GDP</div>
          <div className="font-medium">${human.gdp.toFixed(0)}B</div>
        </div>
        <div className="text-center">
          <div className="text-slate-400 text-xs">Reserves</div>
          <div className={`font-medium ${human.fxReserves < 100 ? 'text-red-400' : ''}`}>
            ${human.fxReserves.toFixed(0)}B
          </div>
        </div>
        <div className="text-center">
          <div className="text-slate-400 text-xs">Trade</div>
          <div className={`font-medium ${balanceColor}`}>
            {human.tradeBalance >= 0 ? '+' : ''}{human.tradeBalance.toFixed(1)}
          </div>
        </div>

        {/* Score with tooltip breakdown */}
        <div className="text-center relative group">
          <div className="text-slate-400 text-xs">Score</div>
          <div className="font-medium text-yellow-400 cursor-help">{human.economicScore}</div>
          {/* Tooltip */}
          <div className="hidden group-hover:block absolute z-20 top-full mt-1 right-0 bg-slate-800 border border-slate-600 rounded-xl p-3 w-64 shadow-2xl text-left">
            <div className="text-[11px] text-slate-400 mb-2">Score Breakdown (0–100):</div>
            <div className="space-y-1">
              <TooltipRow label="Economic Growth (25%)" detail={`GDP: $${human.gdp.toFixed(0)}B`} />
              <TooltipRow label="Trade Balance (20%)" detail={`${human.tradeBalance >= 0 ? '+' : ''}${human.tradeBalance.toFixed(1)} GTU`} />
              <TooltipRow label="FX Reserves (15%)" detail={`$${human.fxReserves.toFixed(0)}B`} color={human.fxReserves < 100 ? 'text-red-400' : ''} />
              <TooltipRow label="Supply Resilience (15%)" detail={`${(human.supplyChainResilience * 100).toFixed(0)}% diverse`} />
              <TooltipRow label="Inflation (10%)" detail={`${human.inflation.toFixed(1)}%`} color={human.inflation > 8 ? 'text-red-400' : ''} />
              <TooltipRow label="Domestic Supply (10%)" detail="Food, energy availability" />
              <TooltipRow label="Debt/GDP (5%)" detail={`${(human.debtToGDP * 100).toFixed(0)}%`} color={human.debtToGDP > 0.7 ? 'text-red-400' : ''} />
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="text-slate-400 text-xs">Round</div>
          <div className="font-medium">{state.round} / {state.config.rounds}</div>
        </div>

        {/* Objectives */}
        <div className="text-center">
          <div className="text-slate-400 text-xs">Goals</div>
          <div className={`font-medium ${completedObjectives === state.playerObjectives.length ? 'text-emerald-400' : 'text-violet-400'}`}>
            {completedObjectives}/{state.playerObjectives.length}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={saveGame} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-slate-300">
          💾 Save
        </button>
        <button
          onClick={executeRound}
          disabled={state.gameOver}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded-lg font-bold text-sm transition"
        >
          END QUARTER ▶
        </button>
      </div>
    </header>
  );
}

function TooltipRow({ label, detail, color }: { label: string; detail: string; color?: string }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-slate-400">{label}</span>
      <span className={color || 'text-slate-300'}>{detail}</span>
    </div>
  );
}
