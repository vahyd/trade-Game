import type { Country, Commodity, CommodityId, CountryId } from './types';

export interface ImportNeed {
  commodityId: CommodityId;
  commodityName: string;
  deficit: number;           // how much we need
  isEssential: boolean;
  inventoryLevel: number;
  inventoryCoverage: number; // quarters of coverage
  urgency: 'critical' | 'high' | 'moderate' | 'low';
  reasoning: string;
  suggestedSuppliers: {
    countryId: CountryId;
    name: string;
    available: number;
    price: number;
    currency: string;
    landedCost: number;    // price + shipping in GTU
    risk: 'low' | 'medium' | 'high';
    riskNote?: string;
  }[];
}

export class ImportAgent {
  /**
   * Analyze all import needs for a country.
   * Evaluates: domestic deficit, inventory coverage,
   * supplier options with landed costs, and dependency risk.
   */
  evaluate(
    country: Country,
    allCountries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>
  ): ImportNeed[] {
    const needs: ImportNeed[] = [];

    for (const cons of country.consumption) {
      const commodity = commodities[cons.commodityId];
      if (!commodity) continue;

      const domesticProd = country.production.find(p => p.commodityId === cons.commodityId);
      const domesticSupply = domesticProd?.production ?? 0;
      const deficit = cons.consumption - domesticSupply;

      if (deficit <= 0) continue; // self-sufficient

      const inventory = country.inventory.find(i => i.commodityId === cons.commodityId)?.quantity ?? 0;
      const coverage = cons.consumption > 0 ? inventory / cons.consumption : 0; // quarters

      // Urgency
      let urgency: 'critical' | 'high' | 'moderate' | 'low';
      if (cons.required && coverage < 0.5) {
        urgency = 'critical';
      } else if (cons.required && coverage < 1) {
        urgency = 'high';
      } else if (cons.required && coverage < 2) {
        urgency = 'moderate';
      } else {
        urgency = 'low';
      }

      // Reasoning
      let reasoning: string;
      if (urgency === 'critical') {
        reasoning = `CRITICAL: Only ${(coverage * 3).toFixed(1)} months of ${commodity.name} remaining. Domestic production covers ${domesticSupply} of ${cons.consumption} needed. Import immediately.`;
      } else if (urgency === 'high') {
        reasoning = `Running low on ${commodity.name}. Inventory covers ${(coverage * 3).toFixed(1)} months. Need to secure supply this quarter.`;
      } else if (urgency === 'moderate') {
        reasoning = `${commodity.name} stocks adequate but imports needed to maintain buffer. ${deficit} unit deficit.`;
      } else {
        reasoning = `Well-stocked on ${commodity.name} (${(coverage * 3).toFixed(1)} months). Can delay imports if prices are unfavorable.`;
      }

      // Currency effect
      if (country.currencyValue > 6) {
        reasoning += ` ⚠ Your weak ${country.currency} makes imports expensive — every GTU costs you ${country.currencyValue} ${country.currency}.`;
      }

      // Find suppliers
      const suppliers = this.findSuppliers(country, cons.commodityId, deficit, allCountries, commodities);

      needs.push({
        commodityId: cons.commodityId,
        commodityName: commodity.name,
        deficit,
        isEssential: cons.required,
        inventoryLevel: inventory,
        inventoryCoverage: Math.round(coverage * 10) / 10,
        urgency,
        reasoning,
        suggestedSuppliers: suppliers,
      });
    }

    // Sort: critical first, then high, etc.
    const urgencyOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    return needs.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  }

  private findSuppliers(
    buyer: Country,
    commodityId: CommodityId,
    quantity: number,
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>
  ): ImportNeed['suggestedSuppliers'] {
    const suppliers: ImportNeed['suggestedSuppliers'] = [];
    const commodity = commodities[commodityId];
    if (!commodity) return suppliers;

    for (const seller of Object.values(countries)) {
      if (seller.id === buyer.id) continue;

      const prod = seller.production.find(p => p.commodityId === commodityId);
      if (!prod || prod.production <= 0) continue;

      const ownCons = seller.consumption.find(c => c.commodityId === commodityId);
      const exportable = prod.production - (ownCons?.consumption ?? 0);
      if (exportable <= 0) continue;

      const shippingCost = commodity.transportCost;
      const landedCost = commodity.currentGlobalPrice + shippingCost;

      // Risk assessment
      const concentration = buyer.supplierConcentration[commodityId]?.find(s => s.supplier === seller.id);
      const supplierShare = concentration?.share ?? 0;
      let risk: 'low' | 'medium' | 'high';
      let riskNote: string | undefined;

      if (supplierShare > 0.5) {
        risk = 'high';
        riskNote = `${Math.round(supplierShare * 100)}% dependency — diversify!`;
      } else if (supplierShare > 0.3) {
        risk = 'medium';
        riskNote = `${Math.round(supplierShare * 100)}% of imports from here`;
      } else {
        risk = 'low';
      }

      // Currency risk: if seller's currency is volatile
      if (seller.inflation > 10) {
        risk = risk === 'low' ? 'medium' : risk;
        riskNote = (riskNote ? riskNote + ' | ' : '') + `High inflation in ${seller.name}`;
      }

      suppliers.push({
        countryId: seller.id,
        name: seller.name,
        available: Math.min(exportable, Math.ceil(quantity * 1.2)),
        price: commodity.currentGlobalPrice,
        currency: seller.currency,
        landedCost: Math.round(landedCost * 100) / 100,
        risk,
        riskNote,
      });
    }

    // Sort: cheapest landed cost first
    return suppliers.sort((a, b) => a.landedCost - b.landedCost);
  }
}
