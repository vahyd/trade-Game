import type { Country, Commodity, CommodityId, CountryId } from './types';

export interface ExportOpportunity {
  commodityId: CommodityId;
  commodityName: string;
  surplus: number;
  productionCost: number;
  globalPrice: number;
  localPrice: number;       // what it's worth in local currency
  profitMargin: number;     // %
  fxBenefit: number;        // how much FX this earns
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
  suggestedBuyers: { countryId: CountryId; name: string; need: number; currency: string }[];
}

export class ExportAgent {
  /**
   * Analyze all export opportunities for a country.
   * Evaluates: surplus capacity, production cost vs global price,
   * foreign buyers, and FX earnings potential.
   */
  evaluate(
    country: Country,
    allCountries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>
  ): ExportOpportunity[] {
    const opportunities: ExportOpportunity[] = [];

    for (const prod of country.production) {
      const commodity = commodities[prod.commodityId];
      if (!commodity) continue;

      // Calculate surplus
      const domesticNeed = country.consumption.find(c => c.commodityId === prod.commodityId);
      const needed = domesticNeed?.consumption ?? 0;
      const inventory = country.inventory.find(i => i.commodityId === prod.commodityId)?.quantity ?? 0;
      const surplus = prod.production - needed;

      if (surplus <= 0) continue;

      // Profitability
      const profitMargin = ((commodity.currentGlobalPrice - prod.productionCost) / prod.productionCost) * 100;
      const fxBenefit = surplus * commodity.currentGlobalPrice;
      const localPrice = commodity.currentGlobalPrice * country.currencyValue;

      // Find buyers
      const buyers = this.findBuyers(country, prod.commodityId, allCountries, commodities);

      // Priority logic
      let priority: 'high' | 'medium' | 'low';
      let reasoning: string;

      if (profitMargin > 50 && buyers.length >= 2) {
        priority = 'high';
        reasoning = `Strong profit (${profitMargin.toFixed(0)}% margin). ${buyers.length} countries need ${commodity.name}. Export now to earn ${fxBenefit.toFixed(0)} GTU.`;
      } else if (profitMargin > 20 && buyers.length >= 1) {
        priority = 'medium';
        reasoning = `Decent margin (${profitMargin.toFixed(0)}%). ${buyers.length} potential buyer(s). Consider exporting part of surplus.`;
      } else if (profitMargin > 0) {
        priority = 'low';
        reasoning = `Thin margin (${profitMargin.toFixed(0)}%). Only export if you need FX or want to maintain trade relationships.`;
      } else {
        priority = 'low';
        reasoning = `Production cost (${prod.productionCost}) exceeds global price (${commodity.currentGlobalPrice}). Exporting loses money — consider cutting production.`;
      }

      // Strong currency effect
      if (profitMargin > 0 && country.currencyValue < 2) {
        reasoning += ` Your strong ${country.currency} means each GTU earned buys more local goods.`;
      } else if (profitMargin > 0 && country.currencyValue > 6) {
        reasoning += ` Your weak ${country.currency} means FX earnings are less valuable locally, but your exports are very competitive globally.`;
      }

      opportunities.push({
        commodityId: prod.commodityId,
        commodityName: commodity.name,
        surplus,
        productionCost: prod.productionCost,
        globalPrice: commodity.currentGlobalPrice,
        localPrice: Math.round(localPrice * 100) / 100,
        profitMargin: Math.round(profitMargin * 10) / 10,
        fxBenefit: Math.round(fxBenefit),
        priority,
        reasoning,
        suggestedBuyers: buyers.map(b => ({
          countryId: b.countryId,
          name: allCountries[b.countryId]?.name ?? b.countryId,
          need: b.quantity,
          currency: allCountries[b.countryId]?.currency ?? '',
        })),
      });
    }

    return opportunities.sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 };
      return p[b.priority] - p[a.priority];
    });
  }

  private findBuyers(
    seller: Country,
    commodityId: CommodityId,
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>
  ): { countryId: CountryId; quantity: number }[] {
    const buyers: { countryId: CountryId; quantity: number }[] = [];

    for (const buyer of Object.values(countries)) {
      if (buyer.id === seller.id) continue;
      const cons = buyer.consumption.find(c => c.commodityId === commodityId);
      if (!cons) continue;
      const prod = buyer.production.find(p => p.commodityId === commodityId);
      const need = cons.consumption - (prod?.production ?? 0);
      if (need > 0) {
        buyers.push({ countryId: buyer.id, quantity: Math.ceil(need) });
      }
    }

    return buyers.sort((a, b) => b.quantity - a.quantity);
  }
}
