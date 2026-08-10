import type { Country, CountryId, CommodityId, Commodity, ExecutedTrade } from './types';

// ── Scoring Engine ──

export class ScoringEngine {
  /** Calculate economic performance score 0-100 */
  static calculateScore(
    country: Country,
    commodities: Record<CommodityId, Commodity>,
    initialGDP: number,
    initialReserves: number,
    initialCurrencyValue: number
  ): number {
    // 1. Economic growth (25%)
    const gdpGrowth = initialGDP > 0 ? ((country.gdp - initialGDP) / initialGDP) * 100 : 0;
    const growthScore = Math.min(100, Math.max(0, 50 + gdpGrowth * 5));

    // 2. Trade sustainability (20%)
    const tradeToGDP = country.gdp > 0 ? (Math.abs(country.tradeBalance) / country.gdp) * 100 : 0;
    const tradeScore = Math.min(100, Math.max(0, 100 - tradeToGDP * 2));

    // 3. FX reserve stability (15%)
    const reserveChange = initialReserves > 0 ? ((country.fxReserves - initialReserves) / initialReserves) * 100 : 0;
    const reserveScore = Math.min(100, Math.max(0, 50 + reserveChange * 2));

    // 4. Supply chain resilience (15%)
    const resilience = this.calculateResilience(country);
    country.supplyChainResilience = resilience;
    const resilienceScore = resilience * 100;

    // 5. Inflation control (10%)
    const inflationScore = Math.min(100, Math.max(0, 100 - country.inflation * 5));

    // 6. Domestic consumption satisfaction (10%)
    const satisfaction = this.calculateDomesticSatisfaction(country, commodities);
    const satisfactionScore = satisfaction * 100;

    // 7. Fiscal/debt stability (5%)
    const debtScore = Math.min(100, Math.max(0, 100 - country.debtToGDP * 200));

    const score =
      0.25 * growthScore +
      0.20 * tradeScore +
      0.15 * reserveScore +
      0.15 * resilienceScore +
      0.10 * inflationScore +
      0.10 * satisfactionScore +
      0.05 * debtScore;

    return Math.round(score);
  }

  /** Calculate supply chain resilience (0-1) */
  static calculateResilience(country: Country): number {
    let totalConcentration = 0;
    let importCount = 0;

    for (const [_, suppliers] of Object.entries(country.supplierConcentration)) {
      if (suppliers.length === 0) continue;
      importCount++;
      // Higher Herfindahl = more concentrated = less resilient
      const herfindahl = suppliers.reduce((sum, s) => sum + s.share * s.share, 0);
      totalConcentration += herfindahl;
    }

    if (importCount === 0) return 0.8; // No imports = no dependency = resilient
    const avgConcentration = totalConcentration / importCount;
    // 0 = fully concentrated, 1 = fully diversified
    return Math.max(0, 1 - avgConcentration);
  }

  /** Calculate domestic consumption satisfaction (0-1) */
  static calculateDomesticSatisfaction(country: Country, commodities: Record<CommodityId, Commodity>): number {
    let totalSatisfaction = 0;
    let count = 0;

    for (const cons of country.consumption) {
      count++;
      const inv = country.inventory.find(i => i.commodityId === cons.commodityId);
      const prod = country.production.find(p => p.commodityId === cons.commodityId);

      const available = (prod?.production ?? 0) + (inv?.quantity ?? 0) * 0.3;
      const ratio = cons.consumption > 0 ? available / cons.consumption : 1;
      const satisfaction = Math.min(1, ratio);
      // Required goods have higher weight
      totalSatisfaction += satisfaction * (cons.required ? 2 : 1);
    }

    const totalWeight = country.consumption.reduce((sum, c) => sum + (c.required ? 2 : 1), 0);
    return totalWeight > 0 ? totalSatisfaction / totalWeight : 1;
  }

  /** Check crisis conditions */
  static checkCrisis(country: Country, commodities: Record<CommodityId, Commodity>): {
    inCrisis: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // FX reserves critically low
    if (country.fxReserves < 50) {
      reasons.push('FX reserves critically low');
    }

    // Food shortages
    const foodInv = country.inventory.find(i => i.commodityId === 'food' || i.commodityId === 'wheat');
    const foodCons = country.consumption.filter(c => c.commodityId === 'food' || c.commodityId === 'wheat');
    const totalFoodNeed = foodCons.reduce((s, c) => s + c.consumption, 0);
    const totalFood = foodInv ? foodInv.quantity : 0;
    if (totalFoodNeed > 0 && totalFood / totalFoodNeed < 0.3) {
      reasons.push('Food shortages exceed 70%');
    }

    // Energy shortages
    const energyInv = country.inventory.filter(i => i.commodityId === 'oil' || i.commodityId === 'gas');
    const energyTotal = energyInv.reduce((s, i) => s + i.quantity, 0);
    const energyNeed = country.consumption
      .filter(c => c.commodityId === 'oil' || c.commodityId === 'gas')
      .reduce((s, c) => s + c.consumption, 0);
    if (energyNeed > 0 && energyTotal / energyNeed < 0.3) {
      reasons.push('Energy shortages exceed 70%');
    }

    // Currency depreciation > 50%
    // (tracked externally)

    // Very high inflation
    if (country.inflation > 25) {
      reasons.push('Inflation exceeds 25%');
    }

    // Persistent trade deficit > 20% of GDP
    if (country.gdp > 0 && country.tradeBalance < -country.gdp * 0.2) {
      reasons.push('Severe trade deficit');
    }

    return { inCrisis: reasons.length >= 2, reasons };
  }
}
