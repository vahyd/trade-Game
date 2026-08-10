import type { Country, CountryId, Commodity, CommodityId, TradeContract, ContractType } from './types';

// ── Contract Engine ──

let contractIdCounter = 0;

export class ContractEngine {
  /** Create a new trade contract */
  static createContract(
    buyer: CountryId,
    seller: CountryId,
    commodityId: CommodityId,
    quantity: number,
    price: number,
    currency: string,
    type: ContractType,
    rounds: number = 4,
    threshold?: number
  ): TradeContract {
    return {
      id: `contract-${++contractIdCounter}`,
      type,
      buyer,
      seller,
      commodityId,
      quantity,
      price,
      currency,
      roundsRemaining: rounds,
      createdAt: 0, // filled by GameEngine
      threshold,
    };
  }

  /** Check if stockpile contract should trigger */
  static shouldTriggerStockpile(
    contract: TradeContract,
    buyerCountry: Country
  ): boolean {
    if (contract.type !== 'stockpile' || !contract.threshold) return false;
    const inv = buyerCountry.inventory.find(i => i.commodityId === contract.commodityId);
    return (inv?.quantity ?? 0) < contract.threshold;
  }
}
