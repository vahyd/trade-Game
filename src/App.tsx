import { useGameStore } from './store/gameStore';
import { TitleScreen } from './components/TitleScreen';
import { GameShell } from './components/GameShell';
import { ResultsScreen } from './components/ResultsScreen';

export default function App() {
  const game = useGameStore((s) => s.game);

  if (!game) return <TitleScreen />;
  if (game.phase === 'results') return <ResultsScreen />;
  return <GameShell />;
}
