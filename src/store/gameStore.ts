import { create } from 'zustand';
import type { GameState, PlayerChoice } from '../engine/types';
import { createGame, resolveChoices } from '../engine/gameEngine';

const STORAGE_KEY = 'cfo-game-state-v2';

interface GameStore {
  game: GameState | null;
  hasSaved: boolean;
  newGame: (seed?: number) => void;
  submitChoices: (choices: PlayerChoice[]) => void;
  backToTitle: () => void;
}

function loadSaved(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (parsed && parsed.phase) return parsed;
    return null;
  } catch {
    return null;
  }
}

const initialGame = loadSaved();

export const useGameStore = create<GameStore>((set, get) => ({
  game: initialGame,
  hasSaved: initialGame !== null,

  newGame: (seed) => {
    const s = seed ?? Math.floor(Math.random() * 0xffffffff);
    const game = createGame(s);
    set({ game, hasSaved: false });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  },

  submitChoices: (choices) => {
    const g = get().game;
    if (!g) return;
    const next = structuredClone(g);
    resolveChoices(next, choices);
    set({ game: next });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  backToTitle: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ game: null, hasSaved: false });
  },
}));
