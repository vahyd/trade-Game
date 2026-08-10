import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { TopBar } from './TopBar';
import { WorldMarket } from './WorldMarket';
import { TradeScreen } from './TradeScreen';
import { RankingsPanel } from './RankingsPanel';
import { NewsFeed } from './NewsFeed';

export function GameLayout() {
  const state = useGameStore(s => s.state);
  const selectedTab = useGameStore(s => s.selectedTab);
  const lastRoundResult = useGameStore(s => s.lastRoundResult);
  const saveGame = useGameStore(s => s.saveGame);
  const setTab = useGameStore(s => s.setTab);

  useEffect(() => {
    if (lastRoundResult) saveGame();
  }, [lastRoundResult, saveGame]);

  if (!state) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-200 overflow-hidden">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-36 bg-slate-800 border-r border-slate-700 p-1.5 shrink-0 overflow-y-auto">
          <nav className="space-y-0.5">
            <NavBtn id="trade" label="🤝 Trade" selectedTab={selectedTab} setTab={setTab} />
            <NavBtn id="world-market" label="🌍 Market" selectedTab={selectedTab} setTab={setTab} />
            <NavBtn id="rankings" label="🏆 Rankings" selectedTab={selectedTab} setTab={setTab} />
          </nav>
        </aside>
        <main className="flex-1 overflow-hidden p-3">
          {selectedTab === 'trade' ? (
            <div className="h-full overflow-y-auto"><TradeScreen /></div>
          ) : selectedTab === 'world-market' ? (
            <div className="h-full overflow-y-auto"><WorldMarket /></div>
          ) : selectedTab === 'rankings' ? (
            <div className="h-full overflow-y-auto"><RankingsPanel /></div>
          ) : (
            <div className="h-full overflow-y-auto"><TradeScreen /></div>
          )}
        </main>
      </div>
      <NewsFeed />
    </div>
  );
}

function NavBtn({ id, label, selectedTab, setTab }: {
  id: string; label: string; selectedTab: string;
  setTab: (tab: string) => void;
}) {
  return (
    <button
      onClick={() => setTab(id)}
      className={`w-full text-left px-2 py-1.5 rounded text-xs transition ${
        selectedTab === id
          ? 'bg-emerald-600/20 text-emerald-400 font-medium'
          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
