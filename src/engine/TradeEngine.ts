import { SeededRNG } from './rng';
import type { TradeOrder, ExecutedTrade, Country, CountryId, Commodity, CommodityId, TradeContract } from './types';
import { InventoryEngine } from './MarketEngine';

// ── Trade Engine: Market Clearing, Order Matching ──

export class TradeEngine {
  private rng: SeededRNG;

  constructor(rng: SeededRNG) {
    this.rng = rng;
  }

  /** Match buy and sell orders, execute trades */
  executeTrades(
    orders: TradeOrder[],
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    round: number
  ): ExecutedTrade[] {
    const executed: ExecutedTrade[] = [];

    // Group orders by commodity
    const sellOrders: Record<CommodityId, TradeOrder[]> = {};
    const buyOrders: Record<CommodityId, TradeOrder[]> = {};

    for (const order of orders) {
      const map = order.type === 'sell' ? sellOrders : buyOrders;
      if (!map[order.commodityId]) map[order.commodityId] = [];
      map[order.commodityId].push(order);
    }

    // For each commodity, match buyers to sellers
    for (const commodityId of Object.keys(commodities)) {
      const sells = (sellOrders[commodityId] ?? []).sort((a, b) => a.price - b.price); // cheapest first
      const buys = (buyOrders[commodityId] ?? []).sort((a, b) => b.price - a.price); // highest bid first

      let si = 0, bi = 0;

      while (si < sells.length && bi < buys.length) {
        const sell = sells[si];
        const buy = buys[bi];

        if (sell.quantity <= 0) { si++; continue; }
        if (buy.quantity <= 0) { bi++; continue; }

        const matchPrice = (sell.price + buy.price) / 2;

        // Check if trade makes sense (buy price >= sell price)
        if (buy.price >= sell.price * 0.7) {
          const quantity = Math.min(sell.quantity, buy.quantity);
          const shippingCost = this.calculateShipping(sell.countryId, buy.countryId, commodityId, commodities);

          const trade: ExecutedTrade = {
            id: `trade-${round}-${commodityId}-${si}-${bi}`,
            seller: sell.countryId,
            buyer: buy.countryId,
            commodityId,
            quantity,
            price: Math.round(matchPrice * 100) / 100,
            currency: buy.currency,
            shippingCost,
            round,
          };

          executed.push(trade);

          // Update inventories
          InventoryEngine.removeFromInventory(countries[sell.countryId], commodityId, quantity);
          InventoryEngine.addToInventory(countries[buy.countryId], commodityId, quantity);

          // Update trade records
          this.recordTrade(countries, trade, commodities);

          sell.quantity -= quantity;
          buy.quantity -= quantity;
        } else {
          // Prices don't match
          if (sell.price >= buy.price) {
            bi++;
          } else {
            si++;
          }
        }
      }
    }

    return executed;
  }

  /** Execute active contracts (fixed, long-term) */
  executeContracts(
    contracts: TradeContract[],
    countries: Record<CountryId, Country>,
    commodities: Record<CommodityId, Commodity>,
    round: number
  ): { executed: ExecutedTrade[]; expired: TradeContract[] } {
    const executed: ExecutedTrade[] = [];
    const expired: TradeContract[] = [];

    for (const contract of contracts) {
      if (contract.roundsRemaining <= 0) {
        expired.push(contract);
        continue;
      }

      // Check if both countries can fulfill
      const sellerInv = InventoryEngine.getInventory(countries[contract.seller], contract.commodityId);
      const actualQty = Math.min(contract.quantity, sellerInv);

      if (actualQty > 0) {
        const shippingCost = this.calculateShipping(contract.seller, contract.buyer, contract.commodityId, commodities);

        const trade: ExecutedTrade = {
          id: `contract-${contract.id}-${round}`,
          seller: contract.seller,
          buyer: contract.buyer,
          commodityId: contract.commodityId,
          quantity: actualQty,
          price: contract.price,
          currency: contract.currency,
          shippingCost,
          round,
        };

        executed.push(trade);

        InventoryEngine.removeFromInventory(countries[contract.seller], contract.commodityId, actualQty);
        InventoryEngine.addToInventory(countries[contract.buyer], contract.commodityId, actualQty);

        this.recordTrade(countries, trade, commodities);
      }

      contract.roundsRemaining--;
      if (contract.roundsRemaining <= 0) {
        expired.push(contract);
      }
    }

    return { executed, expired };
  }

  /** Calculate shipping cost between two countries */
  private calculateShipping(
    from: CountryId,
    to: CountryId,
    commodityId: CommodityId,
    commodities: Record<CommodityId, Commodity>
  ): number {
    const commodity = commodities[commodityId];
    if (!commodity) return 0;
    return Math.round(commodity.transportCost * (0.8 + this.rng.next() * 0.4));
  }

  /** Record trade in country stats */
  private recordTrade(
    countries: Record<CountryId, Country>,
    trade: ExecutedTrade,
    commodities: Record<CommodityId, Commodity>
  ): void {
    const seller = countries[trade.seller];
    const buyer = countries[trade.buyer];
    if (!seller || !buyer) return;

    // Track exports/imports by commodity
    seller.exports[trade.commodityId] = (seller.exports[trade.commodityId] ?? 0) + trade.quantity;
    buyer.imports[trade.commodityId] = (buyer.imports[trade.commodityId] ?? 0) + trade.quantity;

    // Revenue/cost in GTU
    const priceInGTU = trade.price; // trades are in GTU
    const revenue = trade.quantity * priceInGTU;
    seller.exportRevenue += revenue;
    buyer.importCost += revenue;

    // FX reserves: buyer pays, seller receives
    buyer.fxReserves -= revenue;
    seller.fxReserves += revenue;

    // Track trade partners
    this.updateTradePartner(seller, buyer.id, revenue);
    this.updateTradePartner(buyer, seller.id, revenue);

    // Track supplier concentration
    if (!buyer.supplierConcentration[trade.commodityId]) {
      buyer.supplierConcentration[trade.commodityId] = [];
    }
    const conc = buyer.supplierConcentration[trade.commodityId];
    const existing = conc.find(s => s.supplier === trade.seller);
    if (existing) {
      existing.share = (existing.share * 0.7 + (trade.quantity / (buyer.imports[trade.commodityId] || 1)) * 0.3);
    } else {
      conc.push({ supplier: trade.seller, share: trade.quantity / (buyer.imports[trade.commodityId] || 1) });
    }
  }

  private updateTradePartner(country: Country, partner: CountryId, volume: number): void {
    const existing = country.tradePartners.find(tp => tp.partner === partner);
    if (existing) {
      existing.volume += volume;
    } else {
      country.tradePartners.push({ partner, volume });
    }
  }
}
