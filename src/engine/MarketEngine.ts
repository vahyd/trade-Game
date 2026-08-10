import { SeededRNG } from './rng';
import type { Commodity, Country, CountryId, CommodityId, Shock, CurrencyPressureFactors } from './types';
import { COMMODITIES, COUNTRIES } from './data';

// ── Market Engine: Commodity Prices, Supply & Demand ──

export class MarketEngine {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /** Adjust prices based on supply/demand imbalance and shocks */
  updatePrices(
    commodities: Record<CommodityId, Commodity>,
    activeShocks: Shock[],
    countries: Record<CountryId, Country>
  ): Record<CommodityId, number> {
    const changes: Record<CommodityId, number> = {};

    for (const commodity of Object.values(commodities)) {
      // Supply-demand pressure
      const ratio = commodity.supply > 0 ? commodity.demand / commodity.supply : 2;
      const demandPressure = (ratio - 1) * 100; // % pressure
      const noise = this.rng.range(-commodity.volatility * 10, commodity.volatility * 10);
      let priceChange = demandPressure * 0.5 + noise;

      // Apply shock effects
      for (const shock of activeShocks) {
        const modifier = shock.effects.commodityPriceModifiers?.[commodity.id];
        if (modifier) {
          priceChange += modifier;
        }
      }

      // Clamp to reasonable range
      priceChange = Math.max(-40, Math.min(40, priceChange));
      changes[commodity.id] = priceChange;

      const oldPrice = commodity.currentGlobalPrice;
      commodity.currentGlobalPrice = Math.round(oldPrice * (1 + priceChange / 100) * 100) / 100;
      if (commodity.currentGlobalPrice < commodity.globalBasePrice * 0.3) {
        commodity.currentGlobalPrice = commodity.globalBasePrice * 0.3;
      }
      if (commodity.currentGlobalPrice > commodity.globalBasePrice * 3) {
        commodity.currentGlobalPrice = commodity.globalBasePrice * 3;
      }
    }

    return changes;
  }

  /** Compute global supply/demand from all countries */
  updateGlobalSupplyDemand(
    commodities: Record<CommodityId, Commodity>,
    countries: Record<CountryId, Country>
  ): void {
    // Reset
    for (const c of Object.values(commodities)) {
      c.supply = 0;
      c.demand = 0;
    }

    for (const country of Object.values(countries)) {
      for (const prod of country.production) {
        const c = commodities[prod.commodityId];
        if (c) c.supply += prod.production;
      }
      for (const cons of country.consumption) {
        const c = commodities[cons.commodityId];
        if (c) c.demand += cons.consumption;
      }
    }
  }

  /** Get price forecast for a commodity */
  getForecast(commodity: Commodity): { min: number; max: number; confidence: number } {
    const vol = commodity.volatility;
    const price = commodity.currentGlobalPrice;
    const demandPressure = commodity.supply > 0 ? (commodity.demand - commodity.supply) / commodity.supply : 0;

    const range = price * vol * 0.5;
    const bias = demandPressure * price * 0.3;
    const mid = price + bias;

    return {
      min: Math.round(mid - range),
      max: Math.round(mid + range),
      confidence: Math.round((1 - vol) * 100),
    };
  }
}

// ── Currency Engine: Exchange Rates ──

export class CurrencyEngine {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /** Calculate currency pressure score for a country */
  calculatePressure(country: Country, commodities: Record<CommodityId, Commodity>): CurrencyPressureFactors {
    // Trade balance score: normalize against GDP
    const tradeBalanceScore = country.gdp > 0
      ? (country.tradeBalance / country.gdp) * 100
      : 0;

    // Reserve score: months of import coverage
    const monthlyImports = country.importCost / 3; // quarterly
    const reserveScore = monthlyImports > 0
      ? Math.min(100, (country.fxReserves / monthlyImports) * 10)
      : 50;

    // Inflation score: negative
    const inflationScore = Math.max(0, Math.min(100, country.inflation));

    // Debt risk
    const debtRisk = Math.min(100, country.debtToGDP * 100);

    // Growth score (proxy from export revenue trend)
    const growthScore = country.gdp > 0
      ? Math.min(100, (country.exportRevenue / country.gdp) * 100)
      : 50;

    return { tradeBalanceScore, reserveScore, inflationScore, debtRisk, growthScore };
  }

  /** Update exchange rates for all countries */
  updateExchangeRates(
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    activeShocks: Shock[]
  ): Record<CountryId, number> {
    const changes: Record<CountryId, number> = {};

    for (const country of Object.values(countries)) {
      const pf = this.calculatePressure(country, commodities);

      // CurrencyPressure formula from spec:
      // 0.30 × TradeBalanceScore + 0.25 × ReserveScore − 0.20 × InflationScore
      // − 0.15 × DebtRisk + 0.10 × GrowthScore
      const pressure =
        0.30 * pf.tradeBalanceScore +
        0.25 * pf.reserveScore -
        0.20 * pf.inflationScore -
        0.15 * pf.debtRisk +
        0.10 * pf.growthScore;

      // Normalize to % change (pressure of 0 = no change, positive = appreciation)
      // Scale: pressure around 0-100, map to roughly ±10%
      let depreciation = (50 - pressure) * 0.2;
      const noise = this.rng.range(-2, 2);
      depreciation += noise;

      // Apply shock effects
      for (const shock of activeShocks) {
        const modifier = shock.effects.exchangeRateModifiers?.[country.id];
        if (modifier) {
          depreciation += modifier;
        }
      }

      // Positive depreciation = currency weakens (more local currency per GTU)
      depreciation = Math.max(-15, Math.min(15, depreciation));
      changes[country.id] = depreciation;

      const oldValue = country.currencyValue;
      country.currencyValue = Math.round(oldValue * (1 + depreciation / 100) * 100) / 100;
      // Floor: don't let currency get too strong or too weak
      if (country.currencyValue < 0.1) country.currencyValue = 0.1;
      if (country.currencyValue > 50) country.currencyValue = 50;
    }

    return changes;
  }

  /** Convert price between currencies */
  static convertPrice(priceGTU: number, currencyValue: number): number {
    return priceGTU * currencyValue;
  }

  /** Convert local price to GTU */
  static toGTU(localPrice: number, currencyValue: number): number {
    return localPrice / currencyValue;
  }
}

// ── Inventory Engine: Stockpile Mechanics ──

export class InventoryEngine {
  static storageCost = 0.02; // 2% of value per round
  static spoilageRate = 0.01; // 1% for food, 0% for metals

  /** Calculate storage cost for a country's inventory */
  static calculateStorageCost(country: Country, commodities: Record<CommodityId, Commodity>): number {
    let cost = 0;
    for (const inv of country.inventory) {
      const commodity = commodities[inv.commodityId];
      if (commodity) {
        const value = inv.quantity * commodity.currentGlobalPrice;
        cost += value * InventoryEngine.storageCost;
        // Food spoilage
        if (commodity.category === 'food') {
          cost += value * InventoryEngine.spoilageRate;
        }
      }
    }
    return Math.round(cost);
  }

  /** Get inventory level for a country/commodity */
  static getInventory(country: Country, commodityId: CommodityId): number {
    return country.inventory.find(i => i.commodityId === commodityId)?.quantity ?? 0;
  }

  /** Set inventory level for a country/commodity */
  static setInventory(country: Country, commodityId: CommodityId, quantity: number): void {
    const inv = country.inventory.find(i => i.commodityId === commodityId);
    if (inv) {
      inv.quantity = Math.max(0, quantity);
    } else {
      country.inventory.push({ commodityId, quantity: Math.max(0, quantity) });
    }
  }

  /** Add to inventory */
  static addToInventory(country: Country, commodityId: CommodityId, amount: number): void {
    const current = InventoryEngine.getInventory(country, commodityId);
    InventoryEngine.setInventory(country, commodityId, current + amount);
  }

  /** Remove from inventory */
  static removeFromInventory(country: Country, commodityId: CommodityId, amount: number): void {
    const current = InventoryEngine.getInventory(country, commodityId);
    InventoryEngine.setInventory(country, commodityId, current - amount);
  }

  /** Inventory coverage ratio (days of consumption) */
  static getCoverageRatio(country: Country, commodityId: CommodityId): number {
    const inv = InventoryEngine.getInventory(country, commodityId);
    const cons = country.consumption.find(c => c.commodityId === commodityId);
    if (!cons || cons.consumption === 0) return 999;
    return inv / (cons.consumption / 90); // convert quarterly to days
  }
}
