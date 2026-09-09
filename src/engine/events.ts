import type { GameEvent, MarketState } from './types';
import { clamp } from './rng';
import type { Rng } from './rng';

export const EVENTS: GameEvent[] = [
  {
    id: 'recession',
    name: 'Recession',
    category: 'economic',
    description: 'The economy contracts; demand drops and recession risk spikes.',
    impact: 'negative',
    effects: { demand: -20, recession: 25 },
  },
  {
    id: 'inflation-shock',
    name: 'Inflation shock',
    category: 'economic',
    description: 'Input prices surge, raising your cost of goods sold.',
    impact: 'negative',
    effects: { costPressure: 0.05, demand: -5 },
  },
  {
    id: 'rate-hike',
    name: 'Interest-rate hike',
    category: 'economic',
    description: 'The central bank raises rates, increasing your borrowing costs.',
    impact: 'negative',
    effects: { interestSurcharge: 0.004, demand: -5 },
  },
  {
    id: 'banking-crisis',
    name: 'Banking crisis',
    category: 'economic',
    description: 'Credit markets seize up; default risk and currency stress rise.',
    impact: 'negative',
    effects: { recession: 20, usdChange: 0.03 },
  },
  {
    id: 'trade-war',
    name: 'Trade war',
    category: 'geopolitical',
    description: 'Tit-for-tat tariffs hit your markets and soften demand.',
    impact: 'negative',
    effects: { tariff: 0.08, demand: -10 },
  },
  {
    id: 'sanctions',
    name: 'Sanctions',
    category: 'geopolitical',
    description: 'New sanctions disrupt trade routes and raise tariffs.',
    impact: 'negative',
    effects: { tariff: 0.05, shipping: 0.15 },
  },
  {
    id: 'tariff-increase',
    name: 'Tariff increases',
    category: 'geopolitical',
    description: 'Import tariffs are raised across the board.',
    impact: 'negative',
    effects: { tariff: 0.06 },
  },
  {
    id: 'trade-agreement',
    name: 'New trade agreement',
    category: 'geopolitical',
    description: 'A new pact lowers tariffs and lifts demand.',
    impact: 'positive',
    effects: { tariff: -0.05, demand: 8 },
  },
  {
    id: 'cyberattack',
    name: 'Cyberattack',
    category: 'operational',
    description: 'A cyberattack disrupts operations, adding costs and slowing sales.',
    impact: 'negative',
    effects: { costPressure: 0.03, demand: -5 },
  },
  {
    id: 'supplier-bankruptcy',
    name: 'Supplier bankruptcy',
    category: 'operational',
    description: 'A key supplier goes under, tightening supply and raising freight costs.',
    impact: 'negative',
    effects: { shipping: 0.2, demand: -5 },
  },
  {
    id: 'port-closure',
    name: 'Port closure',
    category: 'operational',
    description: 'A major port shuts down, sending shipping costs soaring.',
    impact: 'negative',
    effects: { shipping: 0.3, demand: -8 },
  },
  {
    id: 'labor-strike',
    name: 'Labor strike',
    category: 'operational',
    description: 'Dock workers strike, slowing shipments and raising costs.',
    impact: 'negative',
    effects: { shipping: 0.15, costPressure: 0.02 },
  },
];

export function generateEvent(rng: Rng, prevId?: string): GameEvent {
  if (prevId && EVENTS.length > 1) {
    const pool = EVENTS.filter((e) => e.id !== prevId);
    return pool[Math.floor(rng.next() * pool.length)];
  }
  return EVENTS[Math.floor(rng.next() * EVENTS.length)];
}

export function applyEvent(event: GameEvent, market: MarketState): void {
  const e = event.effects;
  if (e.usdChange) market.usdChange += e.usdChange;
  if (e.shipping) market.shippingMultiplier += e.shipping;
  if (e.tariff) market.tariffRate = Math.max(0, market.tariffRate + e.tariff);
  if (e.demand) market.demandIndex += e.demand;
  if (e.recession) market.recessionRisk += e.recession;
  if (e.interestSurcharge) market.interestSurcharge += e.interestSurcharge;
  if (e.costPressure) market.costPressure += e.costPressure;

  market.usdChange = clamp(market.usdChange, -0.2, 0.2);
  market.shippingMultiplier = clamp(market.shippingMultiplier, 0.6, 2.0);
  market.tariffRate = clamp(market.tariffRate, 0, 0.5);
  market.demandIndex = clamp(market.demandIndex, 10, 100);
  market.recessionRisk = clamp(market.recessionRisk, 0, 100);
}
