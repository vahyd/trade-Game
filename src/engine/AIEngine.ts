import { SeededRNG } from './rng';
import type { Country, CountryId, CommodityId, TradeOrder, Commodity } from './types';

// ── AI Engine: Autonomous Country Decision-Making ──

export class AIEngine {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /** Generate trade orders for all AI countries */
  generateOrders(
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    round: number
  ): TradeOrder[] {
    const orders: TradeOrder[] = [];

    for (const country of Object.values(countries)) {
      if (country.isHuman) continue;
      orders.push(...this.generateCountryOrders(country, countries, commodities, round));
    }

    return orders;
  }

  /**
   * Reactive AI: After the human player places orders, AI countries
   * evaluate and generate counter-orders to compete or exploit.
   */
  reactToPlayerOrders(
    playerOrders: TradeOrder[],
    humanCountry: Country,
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    round: number
  ): TradeOrder[] {
    const counterOrders: TradeOrder[] = [];
    const aiCountries = Object.values(countries).filter(c => !c.isHuman);

    for (const order of playerOrders) {
      const commodity = commodities[order.commodityId];
      if (!commodity) continue;

      if (order.type === 'sell') {
        // Player is exporting — AI importers might want to buy from player
        counterOrders.push(...this.reactToPlayerExport(order, humanCountry, aiCountries, commodity, countries, round));
      } else {
        // Player is importing — AI exporters compete to supply
        counterOrders.push(...this.reactToPlayerImport(order, humanCountry, aiCountries, commodity, countries, round));
      }
    }

    return counterOrders;
  }

  /** AI countries react to player exporting a commodity */
  private reactToPlayerExport(
    playerOrder: TradeOrder,
    humanCountry: Country,
    aiCountries: Country[],
    commodity: Commodity,
    countries: Record<CountryId, Country>,
    round: number
  ): TradeOrder[] {
    const orders: TradeOrder[] = [];

    for (const ai of aiCountries) {
      // Does this AI need this commodity?
      const aiConsumption = ai.consumption.find(c => c.commodityId === playerOrder.commodityId);
      if (!aiConsumption) continue;

      const aiProd = ai.production.find(p => p.commodityId === playerOrder.commodityId);
      const deficit = aiConsumption.consumption - (aiProd?.production ?? 0);
      if (deficit <= 0) continue;

      const aiInv = ai.inventory.find(i => i.commodityId === playerOrder.commodityId)?.quantity ?? 0;

      // If AI needs this and player's price is reasonable, buy from player
      const isCompetitive = playerOrder.price <= commodity.currentGlobalPrice * 1.08;

      if (isCompetitive || aiConsumption.required) {
        const buyQty = Math.min(deficit, playerOrder.quantity * 0.4, Math.ceil(deficit * (0.3 + this.rng.next() * 0.4)));

        if (buyQty > 0) {
          orders.push({
            id: `ai-react-buy-${ai.id}-${playerOrder.commodityId}-${round}-${this.rng.int(0, 9999)}`,
            countryId: ai.id,
            commodityId: playerOrder.commodityId,
            type: 'buy',
            quantity: buyQty,
            price: playerOrder.price * (0.97 + this.rng.next() * 0.05), // near player's ask
            currency: humanCountry.currency,
            counterparty: humanCountry.id,
            contractType: 'spot',
          });
        }
      }

      // Also: competing AI exporters might undercut the player
      const aiExportProd = ai.production.find(p => p.commodityId === playerOrder.commodityId);
      const aiOwnCons = ai.consumption.find(c => c.commodityId === playerOrder.commodityId);
      const aiSurplus = (aiExportProd?.production ?? 0) - (aiOwnCons?.consumption ?? 0);

      if (aiSurplus > 0 && ai.aiPersonality === 'trader') {
        // Trader AIs aggressively undercut
        const undercutPrice = playerOrder.price * (0.90 + this.rng.next() * 0.06);
        orders.push({
          id: `ai-compete-sell-${ai.id}-${playerOrder.commodityId}-${round}-${this.rng.int(0, 9999)}`,
          countryId: ai.id,
          commodityId: playerOrder.commodityId,
          type: 'sell',
          quantity: Math.min(aiSurplus, Math.ceil(playerOrder.quantity * 0.5)),
          price: undercutPrice,
          currency: ai.currency,
          counterparty: playerOrder.counterparty,
          contractType: 'spot',
        });
      }
    }

    return orders;
  }

  /** AI countries react to player importing a commodity */
  private reactToPlayerImport(
    playerOrder: TradeOrder,
    humanCountry: Country,
    aiCountries: Country[],
    commodity: Commodity,
    countries: Record<CountryId, Country>,
    round: number
  ): TradeOrder[] {
    const orders: TradeOrder[] = [];

    for (const ai of aiCountries) {
      // Can this AI supply the commodity?
      const aiProd = ai.production.find(p => p.commodityId === playerOrder.commodityId);
      if (!aiProd || aiProd.production <= 0) continue;

      const aiCons = ai.consumption.find(c => c.commodityId === playerOrder.commodityId);
      const surplus = aiProd.production - (aiCons?.consumption ?? 0);
      if (surplus <= 0) continue;

      const aiInv = ai.inventory.find(i => i.commodityId === playerOrder.commodityId)?.quantity ?? 0;

      // AI personality affects pricing strategy
      let priceMultiplier: number;
      switch (ai.aiPersonality) {
        case 'export-maximizer':
          priceMultiplier = 0.93 + this.rng.next() * 0.07; // competitive
          break;
        case 'trader':
          priceMultiplier = 0.95 + this.rng.next() * 0.10; // opportunistic
          break;
        case 'reserve-defender':
          priceMultiplier = 1.0 + this.rng.next() * 0.08; // premium
          break;
        default:
          priceMultiplier = 0.94 + this.rng.next() * 0.08;
      }

      const offerPrice = commodity.currentGlobalPrice * priceMultiplier;
      const sellQty = Math.min(surplus, playerOrder.quantity * 0.6);

      if (sellQty > 0 && offerPrice > aiProd.productionCost) {
        orders.push({
          id: `ai-react-sell-${ai.id}-${playerOrder.commodityId}-${round}-${this.rng.int(0, 9999)}`,
          countryId: ai.id,
          commodityId: playerOrder.commodityId,
          type: 'sell',
          quantity: Math.ceil(sellQty),
          price: Math.round(offerPrice * 100) / 100,
          currency: ai.currency,
          counterparty: humanCountry.id,
          contractType: 'spot',
        });
      }

      // AI countries that also need this commodity might compete with the player
      const aiNeed = aiCons?.consumption ?? 0;
      const aiDeficit = aiNeed - aiProd.production;
      if (aiDeficit > 0 && ai.aiPersonality !== 'protectionist') {
        // They bid against the player for limited supply
        const competePrice = playerOrder.price * (1.01 + this.rng.next() * 0.05);
        orders.push({
          id: `ai-compete-buy-${ai.id}-${playerOrder.commodityId}-${round}-${this.rng.int(0, 9999)}`,
          countryId: ai.id,
          commodityId: playerOrder.commodityId,
          type: 'buy',
          quantity: Math.min(Math.ceil(aiDeficit * 0.4), Math.ceil(playerOrder.quantity * 0.3)),
          price: Math.round(competePrice * 100) / 100,
          currency: playerOrder.currency,
          counterparty: playerOrder.counterparty,
          contractType: 'spot',
        });
      }
    }

    return orders;
  }

  /** Generate orders for one AI country */
  private generateCountryOrders(
    country: Country,
    allCountries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    round: number
  ): TradeOrder[] {
    const orders: TradeOrder[] = [];
    const weights = country.aiWeights;

    // 1. Export surplus
    for (const prod of country.production) {
      const commodity = commodities[prod.commodityId];
      if (!commodity) continue;

      const domesticConsumption = country.consumption.find(c => c.commodityId === prod.commodityId);
      const needed = domesticConsumption?.consumption ?? 0;
      const inventory = country.inventory.find(i => i.commodityId === prod.commodityId)?.quantity ?? 0;

      const targetInventory = needed * (country.aiPersonality === 'security-first' ? 2 : 1);
      const surplus = prod.production - needed - Math.max(0, targetInventory - inventory);

      if (surplus > 0) {
        const exportUtility =
          commodity.currentGlobalPrice - prod.productionCost +
          (weights.exportRevenue * 50);

        if (exportUtility > 0 || country.aiPersonality === 'export-maximizer') {
          const quantity = Math.floor(surplus * (0.6 + this.rng.next() * 0.4));
          if (quantity > 0) {
            const buyers = this.findBuyers(country, prod.commodityId, quantity, allCountries, commodities);
            for (const buyer of buyers) {
              orders.push({
                id: `ai-${country.id}-sell-${prod.commodityId}-${round}-${this.rng.int(0, 9999)}`,
                countryId: country.id,
                commodityId: prod.commodityId,
                type: 'sell',
                quantity: buyer.quantity,
                price: commodity.currentGlobalPrice * (0.95 + this.rng.next() * 0.1),
                currency: country.currency,
                counterparty: buyer.countryId,
                contractType: 'spot',
              });
            }
          }
        }
      }
    }

    // 2. Import needed goods
    for (const cons of country.consumption) {
      const commodity = commodities[cons.commodityId];
      if (!commodity) continue;

      const inventory = country.inventory.find(i => i.commodityId === cons.commodityId)?.quantity ?? 0;
      const domesticProduction = country.production.find(p => p.commodityId === cons.commodityId);
      const domesticSupply = domesticProduction?.production ?? 0;
      const importNeed = cons.consumption - domesticSupply;

      if (importNeed <= 0) continue;

      const effectiveNeed = Math.max(0, importNeed - Math.max(0, inventory - (country.aiPersonality === 'security-first' ? cons.consumption * 0.5 : 0)));

      if (effectiveNeed > 0) {
        const importUtility =
          cons.required ? 100 : 50 +
          commodity.strategicImportance * 20 -
          commodity.currentGlobalPrice * 0.1;

        if (importUtility > 0 || cons.required) {
          const quantity = Math.ceil(effectiveNeed * (0.7 + this.rng.next() * 0.3));
          if (quantity > 0) {
            const suppliers = this.findSuppliers(country, cons.commodityId, quantity, allCountries, commodities);
            for (const supplier of suppliers.slice(0, 2)) {
              orders.push({
                id: `ai-${country.id}-buy-${cons.commodityId}-${round}-${this.rng.int(0, 9999)}`,
                countryId: country.id,
                commodityId: cons.commodityId,
                type: 'buy',
                quantity: Math.ceil(supplier.quantity),
                price: commodity.currentGlobalPrice * (0.95 + this.rng.next() * 0.1),
                currency: allCountries[supplier.countryId]?.currency ?? 'GTU',
                counterparty: supplier.countryId,
                contractType: this.rng.chance(0.2) ? 'fixed' : 'spot',
                contractRounds: this.rng.int(2, 4),
              });
            }
          }
        }
      }
    }

    return orders;
  }

  /** Find countries that need this commodity */
  private findBuyers(
    seller: Country,
    commodityId: CommodityId,
    quantity: number,
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>
  ): { countryId: CountryId; quantity: number; utility: number }[] {
    const results: { countryId: CountryId; quantity: number; utility: number }[] = [];

    for (const buyer of Object.values(countries)) {
      if (buyer.id === seller.id) continue;

      const consumption = buyer.consumption.find(c => c.commodityId === commodityId);
      if (!consumption) continue;

      const domesticProd = buyer.production.find(p => p.commodityId === commodityId);
      const need = consumption.consumption - (domesticProd?.production ?? 0);
      if (need <= 0) continue;

      const inventory = buyer.inventory.find(i => i.commodityId === commodityId)?.quantity ?? 0;
      const effectiveNeed = Math.max(0, need - inventory * 0.5);

      if (effectiveNeed > 0) {
        const commodity = commodities[commodityId];
        const utility = (consumption.required ? 80 : 40) +
          (commodity?.strategicImportance ?? 0) * 10 -
          (commodity?.currentGlobalPrice ?? 50) * 0.05;

        results.push({
          countryId: buyer.id,
          quantity: Math.min(effectiveNeed, quantity / 3),
          utility,
        });
      }
    }

    return results.sort((a, b) => b.utility - a.utility);
  }

  /** Find countries that can supply this commodity */
  private findSuppliers(
    buyer: Country,
    commodityId: CommodityId,
    quantity: number,
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>
  ): { countryId: CountryId; quantity: number; landedPrice: number; risk: number }[] {
    const results: { countryId: CountryId; quantity: number; landedPrice: number; risk: number }[] = [];
    const commodity = commodities[commodityId];
    if (!commodity) return results;

    for (const seller of Object.values(countries)) {
      if (seller.id === buyer.id) continue;

      const production = seller.production.find(p => p.commodityId === commodityId);
      if (!production || production.production <= 0) continue;

      const consOwn = seller.consumption.find(c => c.commodityId === commodityId);
      const exportable = production.production - (consOwn?.consumption ?? 0);
      if (exportable <= 0) continue;

      const shippingCost = commodity.transportCost * (1 + this.rng.range(-0.2, 0.3));
      const landedPrice = commodity.currentGlobalPrice + shippingCost;

      const concentration = buyer.supplierConcentration[commodityId]?.find(s => s.supplier === seller.id);
      const risk = concentration ? concentration.share * 100 : 10;

      results.push({
        countryId: seller.id,
        quantity: Math.min(exportable * 0.7, quantity),
        landedPrice,
        risk,
      });
    }

    const riskWeight = buyer.aiPersonality === 'diversifier' ? 2 : 0.5;
    return results.sort((a, b) => (a.landedPrice + a.risk * riskWeight) - (b.landedPrice + b.risk * riskWeight));
  }
}
