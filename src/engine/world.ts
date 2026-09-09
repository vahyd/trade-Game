import type { MarketState, NewsItem } from './types';
import { clamp } from './rng';
import type { Rng } from './rng';

export function generateMarket(rng: Rng, prev: MarketState | null): MarketState {
  if (!prev) {
    return {
      usdChange: rng.float(-0.03, 0.03),
      shippingMultiplier: clamp(1 + rng.float(-0.15, 0.15), 0.7, 1.3),
      tariffRate: rng.chance(0.2) ? rng.float(0.05, 0.12) : 0,
      demandIndex: rng.int(60, 80),
      recessionRisk: rng.int(10, 30),
    };
  }

  const usdChange = clamp(prev.usdChange * 0.35 + rng.float(-0.06, 0.06), -0.12, 0.12);
  const shippingMultiplier = clamp(
    1 + (prev.shippingMultiplier - 1) * 0.5 + rng.float(-0.18, 0.18),
    0.6,
    1.6,
  );
  let tariffRate = prev.tariffRate;
  if (rng.chance(0.18)) tariffRate = clamp(tariffRate + rng.float(0.03, 0.08), 0, 0.35);
  else tariffRate = clamp(tariffRate - rng.float(0, 0.02), 0, 0.35);
  const demandIndex = clamp(prev.demandIndex + rng.float(-14, 14), 30, 96);
  const recessionRisk = clamp(prev.recessionRisk + rng.float(-12, 12), 0, 100);

  return { usdChange, shippingMultiplier, tariffRate, demandIndex, recessionRisk };
}

export function generateNews(rng: Rng, market: MarketState, month: number): NewsItem[] {
  const { usdChange, shippingMultiplier, tariffRate, demandIndex, recessionRisk } = market;
  const items: NewsItem[] = [];

  if (usdChange > 0.03) {
    items.push({ id: `fx-${month}`, headline: 'USD strengthens sharply against major currencies', category: 'fx', impact: 'negative' });
  } else if (usdChange < -0.03) {
    items.push({ id: `fx-${month}`, headline: 'USD weakens as markets shift risk appetite', category: 'fx', impact: 'positive' });
  } else {
    items.push({ id: `fx-${month}`, headline: 'USD trades in a narrow range this month', category: 'fx', impact: 'neutral' });
  }

  if (shippingMultiplier > 1.2) {
    items.push({ id: `ship-${month}`, headline: 'Container shipping costs surge on capacity shortages', category: 'shipping', impact: 'negative' });
  } else if (shippingMultiplier < 0.85) {
    items.push({ id: `ship-${month}`, headline: 'Freight rates fall as new vessel capacity arrives', category: 'shipping', impact: 'positive' });
  }

  if (tariffRate > 0.1) {
    items.push({ id: `tariff-${month}`, headline: `New import tariff announced (${Math.round(tariffRate * 100)}%)`, category: 'tariff', impact: 'negative' });
  }

  if (recessionRisk > 60) {
    items.push({ id: `econ-${month}`, headline: 'Economists warn of a possible recession', category: 'economy', impact: 'negative' });
  } else if (recessionRisk < 20) {
    items.push({ id: `econ-${month}`, headline: 'Economic outlook improves across key markets', category: 'economy', impact: 'positive' });
  }

  if (demandIndex > 82) {
    items.push({ id: `demand-${month}`, headline: 'Strong customer demand reported in your markets', category: 'demand', impact: 'positive' });
  } else if (demandIndex < 45) {
    items.push({ id: `demand-${month}`, headline: 'Customer demand softens this month', category: 'demand', impact: 'negative' });
  }

  if (rng.chance(0.12)) {
    items.push({ id: `credit-${month}`, headline: 'A major industry customer defaults on payments', category: 'credit', impact: 'negative' });
  }

  const fallbacks: NewsItem[] = [
    { id: `extra1-${month}`, headline: 'Central bank signals steady interest rates', category: 'economy', impact: 'neutral' },
    { id: `extra2-${month}`, headline: 'Port congestion eases on major trade lanes', category: 'shipping', impact: 'positive' },
  ];
  for (const f of fallbacks) {
    if (items.length < 2) items.push(f);
  }

  return items;
}
