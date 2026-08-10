// ── Core Data Types ──

export type CommodityId = string;
export type CountryId = string;
export type CurrencyId = string;

export type Severity = 'minor' | 'moderate' | 'major' | 'crisis';
export type ContractType = 'spot' | 'fixed' | 'long-term' | 'stockpile';
export type AIPersonality =
  | 'export-maximizer'
  | 'reserve-defender'
  | 'industrializer'
  | 'protectionist'
  | 'trader'
  | 'security-first'
  | 'diversifier';

export interface Commodity {
  id: CommodityId;
  name: string;
  globalBasePrice: number;
  currentGlobalPrice: number;
  supply: number;
  demand: number;
  volatility: number; // 0-1
  transportCost: number;
  strategicImportance: number; // 0-5
  storageLimit: number;
  category: 'energy' | 'food' | 'metal' | 'tech' | 'industrial';
  unit: string;
}

export interface CountryProduction {
  commodityId: CommodityId;
  production: number;
  productionCost: number;
  capacity: number;
}

export interface CountryConsumption {
  commodityId: CommodityId;
  consumption: number;
  required: boolean; // essential for economy
}

export interface CountryInventory {
  commodityId: CommodityId;
  quantity: number;
}

export interface TradeContract {
  id: string;
  type: ContractType;
  buyer: CountryId;
  seller: CountryId;
  commodityId: CommodityId;
  quantity: number;
  price: number;
  currency: CurrencyId;
  roundsRemaining: number;
  createdAt: number; // round number
  threshold?: number; // for stockpile contracts
}

export interface TradeOrder {
  id: string;
  countryId: CountryId;
  commodityId: CommodityId;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  currency: CurrencyId;
  counterparty?: CountryId;
  contractType: ContractType;
  contractRounds?: number;
}

export interface ExecutedTrade {
  id: string;
  seller: CountryId;
  buyer: CountryId;
  commodityId: CommodityId;
  quantity: number;
  price: number;
  currency: CurrencyId;
  shippingCost: number;
  round: number;
}

export interface ShockEffect {
  type: string;
  commodityPriceModifiers?: Partial<Record<CommodityId, number>>; // % change
  exchangeRateModifiers?: Partial<Record<CountryId, number>>;
  supplyModifiers?: Partial<Record<CommodityId, number>>;
  demandModifiers?: Partial<Record<CommodityId, number>>;
  shippingCostModifier?: number; // global multiplier
  productionModifiers?: Partial<Record<CountryId, number>>;
  routeBlocked?: { from: CountryId; to: CountryId; multiplier: number };
  duration: number; // rounds
}

export interface Shock {
  id: string;
  name: string;
  description: string;
  category: 'exchange-rate' | 'commodity-price' | 'supply-chain' | 'production' | 'sanction' | 'demand' | 'political' | 'shipping';
  severity: Severity;
  effects: ShockEffect;
  affectedCountries: CountryId[];
  affectedCommodities: CommodityId[];
  newsHeadline: string;
}

export interface Country {
  id: CountryId;
  name: string;
  currency: CurrencyId;
  currencyName: string;
  currencyValue: number; // 1 Global Trade Unit = X local currency
  fxReserves: number; // in GTU
  goldReserves: number;
  gdp: number;
  debt: number;
  debtToGDP: number;
  inflation: number; // %
  population: number;
  economicSize: number; // relative scale

  // Trade
  exports: Record<CommodityId, number>;
  imports: Record<CommodityId, number>;
  tradeBalance: number;
  exportRevenue: number;
  importCost: number;

  // Production & Consumption
  production: CountryProduction[];
  consumption: CountryConsumption[];
  inventory: CountryInventory[];

  // AI
  aiPersonality: AIPersonality;
  riskTolerance: number; // 0-1
  aiWeights: AIWeights;

  // Scores
  economicScore: number;
  supplyChainResilience: number;

  // Trade partners tracking
  tradePartners: { partner: CountryId; volume: number }[];
  supplierConcentration: Record<CommodityId, { supplier: CountryId; share: number }[]>;

  // Status
  inCrisis: boolean;
  isHuman: boolean;
}

export interface AIWeights {
  economicGrowth: number;
  tradeBalance: number;
  domesticSupplySecurity: number;
  fxReserveStability: number;
  exportRevenue: number;
  inflationControl: number;
}

export interface CurrencyPressureFactors {
  tradeBalanceScore: number;
  reserveScore: number;
  inflationScore: number;
  debtRisk: number;
  growthScore: number;
}

export interface GameConfig {
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
  rounds: number; // 8, 12, 20
  seed: number;
  humanCountryId: CountryId;
}

export interface RoundResult {
  round: number;
  trades: ExecutedTrade[];
  shocks: Shock[];
  priceChanges: Record<CommodityId, number>;
  exchangeRateChanges: Record<CountryId, number>;
  countryScores: Record<CountryId, number>;
  news: string[];
}

export interface PlayerObjective {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
  metric: string;
}

export interface GameState {
  config: GameConfig;
  round: number;
  phase: 'country-select' | 'playing' | 'results';
  countries: Record<CountryId, Country>;
  commodities: Record<CommodityId, Commodity>;
  activeShocks: Shock[];
  activeContracts: TradeContract[];
  tradeOrders: TradeOrder[];
  roundHistory: RoundResult[];
  newsFeed: string[];
  playerObjectives: PlayerObjective[];
  gameOver: boolean;
}
