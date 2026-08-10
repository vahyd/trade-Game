import { useGameStore } from '../store/gameStore';

const tabs = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'trade', label: '🤝 Trade' },
  { id: 'world-market', label: '🌍 Market' },
  { id: 'rankings', label: '🏆 Rankings' },
];

export function Sidebar() {
  const selectedTab = useGameStore(s => s.selectedTab);
  const setTab = useGameStore(s => s.setTab);

  return (
    <aside className="w-44 bg-slate-800 border-r border-slate-700 p-2 shrink-0 overflow-y-auto">
      <nav className="space-y-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
              selectedTab === tab.id
                ? 'bg-emerald-600/20 text-emerald-400 font-medium'
                : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
