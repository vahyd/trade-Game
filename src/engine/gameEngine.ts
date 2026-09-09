import type { GameState, PlayerChoice } from './types';
import { createRng, monthSeed } from './rng';
import { BANKRUPTCY_CASH_FLOOR, STARTING, TOTAL_MONTHS } from './constants';
import { generateMarket, generateNews } from './world';
import { generateDecisions } from './decisions';
import { resolveMonth } from './outcomes';
import { computeScore } from './scoring';

const EMPTY_MARKET = {
  usdChange: 0,
  shippingMultiplier: 1,
  tariffRate: 0,
  demandIndex: 70,
  recessionRisk: 20,
};

function freshCompany() {
  return {
    cash: STARTING.cash,
    debt: STARTING.debt,
    inventory: STARTING.inventory,
    monthlyRevenue: STARTING.monthlyRevenue,
    employees: STARTING.employees,
    markets: [...STARTING.markets],
    suppliers: [...STARTING.suppliers],
    ownership: STARTING.ownership,
    creditRating: STARTING.creditRating,
    riskScore: STARTING.riskScore,
    cumulativeProfit: 0,
    monthsSurvived: 0,
  };
}

function beginMonth(state: GameState): void {
  const rng = createRng(monthSeed(state.seed, state.month));
  state.market = generateMarket(rng, state.month === 1 ? null : state.market);
  state.news = generateNews(rng, state.market, state.month);
  state.decisions = generateDecisions(rng, state.company, state.market, state.month);
}

export function createGame(seed: number): GameState {
  const state: GameState = {
    phase: 'playing',
    month: 1,
    seed,
    company: freshCompany(),
    market: EMPTY_MARKET,
    news: [],
    decisions: [],
    history: [],
    lastResult: null,
    bankrupt: false,
    finalScore: null,
  };
  beginMonth(state);
  return state;
}

export function resolveChoices(state: GameState, choices: PlayerChoice[]): void {
  if (state.phase !== 'playing') return;

  const rng = createRng(monthSeed(state.seed, state.month + 1000));
  const { company, result } = resolveMonth(
    rng,
    state.company,
    state.market,
    state.decisions,
    choices,
    state.month,
  );
  state.company = company;
  state.history = [...state.history, result];
  state.lastResult = result;

  if (company.cash < BANKRUPTCY_CASH_FLOOR) {
    state.bankrupt = true;
    state.phase = 'results';
    state.finalScore = computeScore(state.history, company, true);
    return;
  }

  if (state.month >= TOTAL_MONTHS) {
    state.phase = 'results';
    state.finalScore = computeScore(state.history, company, false);
    return;
  }

  state.month += 1;
  beginMonth(state);
}
