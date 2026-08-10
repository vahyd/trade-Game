import { SeededRNG } from './rng';
import type { ExecutedTrade, Shock, CountryId, Country } from './types';

// ── Event Engine: Global News Feed ──

export class EventEngine {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /** Generate news items based on round events */
  generateNews(
    trades: ExecutedTrade[],
    shocks: Shock[],
    countries: Record<CountryId, Country>,
    priceChanges: Record<string, number>,
    exchangeRateChanges: Record<CountryId, number>
  ): string[] {
    const news: string[] = [];

    // Shock headlines (always reported)
    for (const shock of shocks) {
      news.push(`🔴 ${shock.newsHeadline}`);
    }

    // Significant price movements
    for (const [commodityId, change] of Object.entries(priceChanges)) {
      const absPct = Math.abs(change);
      if (absPct > 5) {
        const dir = change > 0 ? 'jump' : 'fall';
        const commodityName = commodityId.charAt(0).toUpperCase() + commodityId.slice(1);
        news.push(`${commodityName} prices ${dir} ${absPct.toFixed(1)}%.`);
      }
    }

    // Significant currency movements
    for (const [countryId, change] of Object.entries(exchangeRateChanges)) {
      const absPct = Math.abs(change);
      if (absPct > 3) {
        const country = countries[countryId];
        if (country) {
          const dir = change > 0 ? 'weakens' : 'strengthens';
          news.push(`${country.name}'s ${country.currency} ${dir} ${absPct.toFixed(1)}%.`);
        }
      }
    }

    // Major trades
    const majorTrades = trades.filter(t => t.quantity > 20);
    for (const trade of majorTrades.slice(0, 3)) {
      const seller = countries[trade.seller];
      const buyer = countries[trade.buyer];
      if (seller && buyer) {
        news.push(`${seller.name} exports ${trade.quantity} ${trade.commodityId} to ${buyer.name}.`);
      }
    }

    // AI trade agreements
    if (trades.length > 5 && this.rng.chance(0.3)) {
      const trade = this.rng.pick(trades);
      const seller = countries[trade.seller];
      const buyer = countries[trade.buyer];
      if (seller && buyer) {
        news.push(`${seller.name} signs ${trade.commodityId} agreement with ${buyer.name}.`);
      }
    }

    return news.slice(0, 8); // max 8 news items
  }

  /** Generate learning hint based on economic outcomes */
  static generateLearningHint(
    country: Country,
    previousTradeBalance: number,
    currentTradeBalance: number,
    exchangeRateChange: number,
    priceChanges: Record<string, number>
  ): string | null {
    const hints: string[] = [];

    // Currency effect
    if (exchangeRateChange < -3 && country.exportRevenue > country.importCost) {
      hints.push(
        `Your currency appreciated while exports remained strong. ` +
        `This means your goods are becoming more expensive for foreign buyers — ` +
        `watch for declining export competitiveness.`
      );
    } else if (exchangeRateChange > 3 && country.importCost > 0) {
      hints.push(
        `Your currency depreciation made exports more competitive, ` +
        `but imports have become substantially more expensive. ` +
        `This can fuel inflation if you depend on imported goods.`
      );
    }

    // Supplier concentration warning
    for (const [commodityId, suppliers] of Object.entries(country.supplierConcentration)) {
      const dominant = suppliers.find(s => s.share > 0.7);
      if (dominant) {
        hints.push(
          `Your ${commodityId} supply is ${Math.round(dominant.share * 100)}% dependent on one country. ` +
          `A disruption there could severely impact your economy.`
        );
      }
    }

    // Trade balance shift
    if (currentTradeBalance < -50 && previousTradeBalance > -50) {
      hints.push(
        `Your trade deficit is growing. Consider reducing non-essential imports ` +
        `or finding cheaper suppliers before FX reserves come under pressure.`
      );
    }

    return hints.length > 0 ? this.pickHint(hints) : null;
  }

  private static pickHint(hints: string[]): string {
    // Round-robin through hints
    return hints[Math.floor(Math.random() * hints.length)];
  }
}
