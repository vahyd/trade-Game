import { useGameStore } from './store/gameStore';
import { TitleScreen } from './components/TitleScreen';
import { CountrySelect } from './components/CountrySelect';
import { GameLayout } from './components/GameLayout';
import { ResultsScreen } from './components/ResultsScreen';

export default function App() {
  const state = useGameStore(s => s.state);

  if (!state) {
    return <TitleScreen />;
  }

  switch (state.phase) {
    case 'country-select':
      return <CountrySelect />;
    case 'playing':
      return <GameLayout />;
    case 'results':
      return <ResultsScreen />;
    default:
      return <TitleScreen />;
  }
}
