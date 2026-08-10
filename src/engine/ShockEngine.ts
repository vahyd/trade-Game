import { SeededRNG } from './rng';
import type { Shock, ShockEffect, CountryId, CommodityId, Country, Commodity } from './types';
import { SHOCK_POOL } from './data';

// ── Shock Engine ──

const SEVERITY_WEIGHTS: Record<Shock['severity'], number> = {
  minor: 35,
  moderate: 30,
  major: 20,
  crisis: 10,
};

// Base probability of any shock occurring in a round
const SHOCK_PROBABILITY = 0.95;

export class ShockEngine {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /** Generate zero or more random shocks for this round */
  generateShocks(round: number, countries: Country[]): Shock[] {
    const shocks: Shock[] = [];

    // Always fire at least one commodity price shock each quarter
    shocks.push(this.generateCommodityShock(round, countries));

    // 40% chance of a second random shock
    if (this.rng.chance(0.4)) {
      const shock = this.pickShock(round, countries);
      if (shock) shocks.push(shock);
    }

    return shocks;
  }

  /** Pick a random shock and build its effects */
  private pickShock(round: number, countries: Country[]): Shock | null {
    const template = this.rng.pick(SHOCK_POOL);
    const severity = this.weightedSeverity();
    const effects = this.buildEffects(template.id, severity, countries);
    const affectedCountries = this.pickAffectedCountries(template.id, countries);
    const affectedCommodities = this.pickAffectedCommodities(template.id);

    return {
      ...template,
      severity,
      effects,
      affectedCountries,
      affectedCommodities,
    };
  }

  /** Weighted random severity selection */
  private weightedSeverity(): Shock['severity'] {
    const items: Shock['severity'][] = ['minor', 'moderate', 'major', 'crisis'];
    const weights = [35, 30, 20, 10];
    return this.rng.weighted(items, weights);
  }

  /** Build concrete effects for a shock */
  private buildEffects(shockId: string, severity: Shock['severity'], countries: Country[]): ShockEffect {
    const mult = severity === 'minor' ? 0.5 : severity === 'moderate' ? 1.0 : severity === 'major' ? 1.8 : 3.0;
    const effects: ShockEffect = { type: shockId, duration: severity === 'crisis' ? this.rng.int(2, 4) : this.rng.int(1, 2) };

    switch (shockId) {
      case 's1': // Oil price collapse
        effects.commodityPriceModifiers = { oil: -Math.round(15 * mult) };
        effects.demandModifiers = { oil: -Math.round(5 * mult) };
        break;
      case 's2': // Oil price surge
        effects.commodityPriceModifiers = { oil: Math.round(12 * mult) };
        break;
      case 's3': // Tech boom
        effects.commodityPriceModifiers = { electronics: Math.round(10 * mult) };
        effects.demandModifiers = { electronics: Math.round(8 * mult) };
        break;
      case 's4': // Global recession
        effects.demandModifiers = { machinery: -Math.round(15 * mult), steel: -Math.round(10 * mult) };
        effects.commodityPriceModifiers = { machinery: -Math.round(10 * mult), steel: -Math.round(8 * mult) };
        break;
      case 's5': // Drought
        effects.supplyModifiers = { wheat: -Math.round(20 * mult) };
        effects.commodityPriceModifiers = { wheat: Math.round(15 * mult), food: Math.round(8 * mult) };
        break;
      case 's6': // Bumper harvest
        effects.supplyModifiers = { food: Math.round(15 * mult), wheat: Math.round(10 * mult) };
        effects.commodityPriceModifiers = { food: -Math.round(8 * mult), wheat: -Math.round(5 * mult) };
        break;
      case 's7': // Strait closure
        effects.shippingCostModifier = Math.round(30 * mult);
        effects.commodityPriceModifiers = { oil: Math.round(8 * mult), gas: Math.round(6 * mult) };
        break;
      case 's8': // Currency crisis Petrovia
        effects.exchangeRateModifiers = { petrovia: Math.round(12 * mult) }; // depreciation %
        break;
      case 's9': // Currency rally Techland
        effects.exchangeRateModifiers = { techland: -Math.round(6 * mult) }; // negative = appreciation
        break;
      case 's10': // Tech export ban
        effects.supplyModifiers = { electronics: -Math.round(15 * mult) };
        effects.commodityPriceModifiers = { electronics: Math.round(10 * mult) };
        break;
      case 's11': // Copper export quota
        effects.supplyModifiers = { copper: -Math.round(10 * mult) };
        effects.commodityPriceModifiers = { copper: Math.round(8 * mult) };
        break;
      case 's12': // Wheat export ban
        effects.supplyModifiers = { wheat: -Math.round(10 * mult) };
        effects.commodityPriceModifiers = { wheat: Math.round(6 * mult), food: Math.round(3 * mult) };
        break;
      case 's13': // Shipping cost spike
        effects.shippingCostModifier = Math.round(25 * mult);
        break;
      case 's14': // Gas pipeline disruption
        effects.supplyModifiers = { gas: -Math.round(18 * mult) };
        effects.commodityPriceModifiers = { gas: Math.round(12 * mult) };
        break;
      case 's15': // Food price spike
        effects.commodityPriceModifiers = { food: Math.round(12 * mult), wheat: Math.round(8 * mult) };
        break;
      case 's16': // Steel overcapacity
        effects.supplyModifiers = { steel: Math.round(15 * mult) };
        effects.commodityPriceModifiers = { steel: -Math.round(8 * mult) };
        break;
      case 's17': // Copper discovery
        effects.supplyModifiers = { copper: Math.round(12 * mult) };
        effects.commodityPriceModifiers = { copper: -Math.round(6 * mult) };
        break;
      case 's18': // Electronics glut
        effects.supplyModifiers = { electronics: Math.round(10 * mult) };
        effects.commodityPriceModifiers = { electronics: -Math.round(6 * mult) };
        break;
      case 's19': // Trade agreement
        effects.shippingCostModifier = -Math.round(10 * mult);
        break;
      case 's20': // Energy transition
        effects.demandModifiers = { gas: -Math.round(15 * mult) };
        effects.commodityPriceModifiers = { gas: -Math.round(10 * mult) };
        break;
      case 's21': // Shipping route reopens
        effects.shippingCostModifier = -Math.round(10 * mult);
        break;
      case 's22': // Machinery boom
        effects.demandModifiers = { machinery: Math.round(12 * mult), steel: Math.round(6 * mult) };
        effects.commodityPriceModifiers = { machinery: Math.round(8 * mult), steel: Math.round(4 * mult) };
        break;
      case 's23': // Petrovia sanctions
        effects.supplyModifiers = { oil: -Math.round(20 * mult), gas: -Math.round(15 * mult) };
        effects.commodityPriceModifiers = { oil: Math.round(15 * mult), gas: Math.round(10 * mult) };
        effects.exchangeRateModifiers = { petrovia: Math.round(15 * mult) };
        effects.routeBlocked = { from: 'saudi-arabia', to: 'japan', multiplier: 2 };
        break;
      case 's24': // Debt crisis
        effects.exchangeRateModifiers = {};
        const rng = this.rng;
        countries.filter(c => c.debtToGDP > 0.5).forEach(c => {
          (effects.exchangeRateModifiers as Record<string, number>)[c.id] = Math.round(8 * mult);
        });
        break;
      case 's25': // Tech innovation
        effects.commodityPriceModifiers = { electronics: -Math.round(8 * mult) };
        effects.supplyModifiers = { electronics: Math.round(8 * mult) };
        break;
    }

    return effects;
  }

  /** Determine which countries are affected */
  private pickAffectedCountries(shockId: string, countries: Country[]): CountryId[] {
    const ids = countries.map(c => c.id);
    switch (shockId) {
      case 's1': case 's2': return ids.filter(id => id === 'saudi-arabia' || id === 'germany' || id === 'japan');
      case 's3': return ids; // all
      case 's4': return ids.filter(id => id === 'germany' || id === 'japan' || id === 'chile');
      case 's5': return ids.filter(id => id === 'brazil' || id === 'vietnam' || id === 'new-zealand');
      case 's6': return ids.filter(id => id === 'brazil' || id === 'vietnam');
      case 's7': return ids; // all
      case 's8': return ['saudi-arabia'];
      case 's9': return ['japan'];
      case 's10': return ['japan', 'germany', 'chile'];
      case 's11': return ['chile'];
      case 's12': return ['brazil'];
      case 's13': case 's21': return ids; // all
      case 's14': return ['qatar', 'japan', 'germany'];
      case 's15': return ids.filter(id => id !== 'brazil');
      case 's16': case 's17': case 's22': return ids; // all
      case 's18': return ['japan', 'germany'];
      case 's19': return this.rng.shuffle([...ids]).slice(0, 2);
      case 's20': return ids; // all
      case 's23': return ['saudi-arabia', 'japan', 'germany', 'qatar'];
      case 's24': return countries.filter(c => c.debtToGDP > 0.5).map(c => c.id);
      case 's25': return ['japan', 'germany'];
      default: return ids;
    }
  }

  /** Determine which commodities are affected */
  private pickAffectedCommodities(shockId: string): CommodityId[] {
    switch (shockId) {
      case 's1': case 's2': return ['oil', 'gas'];
      case 's3': return ['electronics'];
      case 's4': return ['machinery', 'steel'];
      case 's5': return ['wheat', 'food'];
      case 's6': return ['food', 'wheat'];
      case 's7': return ['oil', 'gas', 'electronics'];
      case 's8': case 's9': case 's24': return [];
      case 's10': return ['electronics'];
      case 's11': return ['copper'];
      case 's12': return ['wheat', 'food'];
      case 's13': case 's21': return [];
      case 's14': return ['gas'];
      case 's15': return ['food', 'wheat'];
      case 's16': case 's22': return ['steel'];
      case 's17': return ['copper'];
      case 's18': return ['electronics'];
      case 's19': return [];
      case 's20': return ['gas'];
      case 's23': return ['oil', 'gas'];
      case 's25': return ['electronics'];
      default: return [];
    }
  }

  /** Generate a commodity-focused shock for the start of each quarter */
  private generateCommodityShock(round: number, countries: Country[]): Shock {
    // Pick a commodity to affect
    const commodityShocks = ['s1', 's2', 's3', 's5', 's6', 's15', 's16', 's17', 's18', 's20', 's22', 's25'];
    const shockId = this.rng.pick(commodityShocks);

    // Bias severity toward minor/moderate for the guaranteed shock
    const severityItems: Shock['severity'][] = ['minor', 'minor', 'moderate', 'moderate', 'major', 'crisis'];
    const severity = this.rng.pick(severityItems);

    const template = SHOCK_POOL.find(s => s.id === shockId)!;
    const effects = this.buildEffects(shockId, severity, countries);
    const affectedCountries = this.pickAffectedCountries(shockId, countries);
    const affectedCommodities = this.pickAffectedCommodities(shockId);

    return {
      ...template,
      severity,
      effects,
      affectedCountries,
      affectedCommodities,
    };
  }

  /** Tick down shock durations, return expired shocks */
  tickDurations(shocks: Shock[]): Shock[] {
    const expired: Shock[] = [];
    for (const shock of shocks) {
      shock.effects.duration--;
      if (shock.effects.duration <= 0) {
        expired.push(shock);
      }
    }
    return expired;
  }

  /**
   * Generate a conditional exchange-rate shock targeting the human player
   * when their economy shows warning signs. This teaches the player that
   * trade deficits, low reserves, and high inflation have consequences.
   */
  generateConditionalShock(
    humanCountry: Country,
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    round: number
  ): Shock | null {
    // Only check from round 3 onwards (give player time to settle in)
    if (round < 3) return null;

    // Calculate risk factors
    const monthlyImports = humanCountry.importCost > 0 ? humanCountry.importCost / 3 : 1;
    const reserveCoverage = humanCountry.fxReserves / monthlyImports; // months of import cover
    const tradeDeficitRatio = humanCountry.gdp > 0
      ? (-humanCountry.tradeBalance / humanCountry.gdp) * 100
      : 0; // positive = deficit

    let riskScore = 0;
    const riskReasons: string[] = [];

    // FX reserves critically low (< 2 months import cover)
    if (reserveCoverage < 2) {
      riskScore += 40;
      riskReasons.push('critically low FX reserves');
    } else if (reserveCoverage < 4) {
      riskScore += 20;
      riskReasons.push('declining FX reserves');
    }

    // Large trade deficit (> 15% of GDP)
    if (tradeDeficitRatio > 15) {
      riskScore += 35;
      riskReasons.push('severe trade deficit');
    } else if (tradeDeficitRatio > 8) {
      riskScore += 15;
      riskReasons.push('growing trade deficit');
    }

    // High inflation
    if (humanCountry.inflation > 15) {
      riskScore += 30;
      riskReasons.push('runaway inflation');
    } else if (humanCountry.inflation > 8) {
      riskScore += 15;
      riskReasons.push('elevated inflation');
    }

    // High debt
    if (humanCountry.debtToGDP > 0.8) {
      riskScore += 20;
      riskReasons.push('unsustainable debt');
    }

    // Only fire if risk is substantial (> 40 points) and RNG check passes
    if (riskScore < 40) return null;

    // Probability scales with risk score
    const triggerChance = Math.min(0.9, riskScore / 100);
    if (!this.rng.chance(triggerChance)) return null;

    // Build the shock
    const severity: Shock['severity'] = riskScore > 70 ? 'crisis' : riskScore > 55 ? 'major' : 'moderate';
    const mult = severity === 'moderate' ? 1.0 : severity === 'major' ? 1.8 : 3.0;

    const depreciation = Math.round(10 * mult + this.rng.range(3, 8));
    const inflationBump = Math.round(3 * mult);

    const reason = riskReasons.slice(0, 2).join(' and ');

    return {
      id: `conditional-fx-${round}`,
      name: `Currency Crisis: ${humanCountry.name}`,
      description: `Markets lose confidence in ${humanCountry.currency} due to ${reason}. Capital flight triggers sharp depreciation.`,
      category: 'exchange-rate',
      severity,
      newsHeadline: `🚨 ${humanCountry.currency} plunges ${depreciation}% as markets panic over ${reason}!`,
      effects: {
        type: 'conditional-fx',
        duration: severity === 'crisis' ? this.rng.int(2, 4) : this.rng.int(1, 2),
        exchangeRateModifiers: { [humanCountry.id]: depreciation },
        commodityPriceModifiers: {}, // imports become more expensive through FX channel
      },
      affectedCountries: [humanCountry.id],
      affectedCommodities: [],
    };
  }
}
