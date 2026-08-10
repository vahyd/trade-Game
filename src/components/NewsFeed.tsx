import { useGameStore } from '../store/gameStore';

export function NewsFeed() {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  return (
    <footer className="bg-slate-800 border-t border-slate-700 px-4 py-2 overflow-hidden shrink-0">
      <div className="flex items-center gap-4 animate-marquee whitespace-nowrap">
        <span className="text-xs font-bold text-emerald-400 shrink-0">📰 GLOBAL TRADE NEWS</span>
        {state.newsFeed.slice(0, 10).map((news, i) => (
          <span key={i} className="text-xs text-slate-400 shrink-0">
            {news}
            <span className="mx-3 text-slate-600">|</span>
          </span>
        ))}
      </div>
    </footer>
  );
}
