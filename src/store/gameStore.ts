import { create } from 'zustand';
import { GameEngine } from '../engine/GameEngine';
import type { RoundBriefing } from '../engine/TraderAdvisor';
import type {
  GameConfig, CountryId, CommodityId, TradeOrder, ContractType,
  GameState, RoundResult, ExecutedTrade, TradeContract,
} from '../engine/types';

interface GameStore {
  engine: GameEngine | null;
  state: GameState | null;
  selectedTab: string;
  lastRoundResult: RoundResult | null;
  learningHint: string | null;
  briefing: RoundBriefing | null;

  // Actions
  startGame: (config: GameConfig) => void;
  selectCountry: (countryId: CountryId) => void;
  executeRound: () => void;
  setTab: (tab: string) => void;
  addTradeOrder: (order: TradeOrder) => void;
  createContract: (
    seller: CountryId, buyer: CountryId, commodityId: CommodityId,
    quantity: number, price: number, currency: string, type: ContractType, rounds?: number
  ) => TradeContract;
  saveGame: () => void;
  loadGame: () => boolean;
  deleteSave: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  engine: null,
  state: null,
  selectedTab: 'trade',
  lastRoundResult: null,
  learningHint: null,
  briefing: null,

  startGame: (config: GameConfig) => {
    const engine = new GameEngine(config);
    setTimeout(() => {
      engine.state.phase = 'country-select';
      engine.state.countries[config.humanCountryId].isHuman = true;
    }, 0);
    set({ engine, state: engine.state, selectedTab: 'trade', lastRoundResult: null, learningHint: null, briefing: null });
  },

  selectCountry: (countryId: CountryId) => {
    const { engine } = get();
    if (!engine) return;
    engine.state.config.humanCountryId = countryId;
    // Reset isHuman flags
    for (const c of Object.values(engine.state.countries)) {
      c.isHuman = c.id === countryId;
    }
    engine.state.phase = 'playing';
    set({ state: { ...engine.state } });
  },

  executeRound: () => {
    const { engine } = get();
    if (!engine || engine.state.gameOver) return;
    const result = engine.executeRound();
    set({
      state: { ...engine.state },
      lastRoundResult: result,
      briefing: engine.lastBriefing,
    });
  },

  setTab: (tab: string) => set({ selectedTab: tab }),

  addTradeOrder: (order: TradeOrder) => {
    const { engine } = get();
    if (!engine) return;
    engine.addTradeOrder(order);
    set({ state: { ...engine.state } });
  },

  createContract: (seller, buyer, commodityId, quantity, price, currency, type, rounds = 4) => {
    const { engine } = get();
    if (!engine) throw new Error('No engine');
    const contract = engine.createContract(seller, buyer, commodityId, quantity, price, currency, type, rounds);
    set({ state: { ...engine.state } });
    return contract;
  },

  saveGame: () => {
    const { engine } = get();
    if (!engine) return;
    localStorage.setItem('tradeshock-save', engine.saveGame());
  },

  loadGame: () => {
    const saved = localStorage.getItem('tradeshock-save');
    if (!saved) return false;
    try {
      const data = JSON.parse(saved);
      const engine = new GameEngine(data.config);
      engine.loadGame(saved);
      set({ engine, state: engine.state, selectedTab: 'dashboard', lastRoundResult: null });
      return true;
    } catch {
      return false;
    }
  },

  deleteSave: () => {
    localStorage.removeItem('tradeshock-save');
  },
}));
