import { SeededRNG } from './rng';
import { MarketEngine, CurrencyEngine, InventoryEngine } from './MarketEngine';
import { ShockEngine } from './ShockEngine';
import { AIEngine } from './AIEngine';
import { TradeEngine } from './TradeEngine';
import { ContractEngine } from './ContractEngine';
import { ScoringEngine } from './ScoringEngine';
import { EventEngine } from './EventEngine';
import { TraderAdvisor, type RoundBriefing } from './TraderAdvisor';
import { COMMODITIES, COUNTRIES, OBJECTIVES } from './data';
import type {
  Commodity, CommodityId, Country, CountryId, GameConfig, GameState,
  RoundResult, ExecutedTrade, TradeOrder, Shock, TradeContract, PlayerObjective, ContractType,
} from './types';

// ── Game Engine ──

export class GameEngine {
  rng: SeededRNG;
  marketEngine: MarketEngine;
  currencyEngine: CurrencyEngine;
  shockEngine: ShockEngine;
  aiEngine: AIEngine;
  tradeEngine: TradeEngine;
  eventEngine: EventEngine;
  traderAdvisor: TraderAdvisor;

  state: GameState;
  lastBriefing: RoundBriefing | null = null;
  private initialSnapshots: Record<CountryId, { gdp: number; reserves: number; currencyValue: number; exports: number }> = {};

  constructor(config: GameConfig) {
    this.rng = new SeededRNG(config.seed);
    this.marketEngine = new MarketEngine(this.rng);
    this.currencyEngine = new CurrencyEngine(this.rng);
    this.shockEngine = new ShockEngine(this.rng);
    this.aiEngine = new AIEngine(this.rng);
    this.tradeEngine = new TradeEngine(this.rng);
    this.eventEngine = new EventEngine(this.rng);
    this.traderAdvisor = new TraderAdvisor();

    this.state = this.initializeState(config);
  }

  /** Initialize game state from config */
  private initializeState(config: GameConfig): GameState {
    // Deep clone commodities and countries
    const commodities: Record<CommodityId, Commodity> = {};
    for (const c of COMMODITIES) {
      commodities[c.id] = { ...c, supply: c.supply, demand: c.demand };
    }

    const countries: Record<CountryId, Country> = {};
    for (const c of COUNTRIES) {
      countries[c.id] = this.deepCloneCountry(c);
      countries[c.id].isHuman = c.id === config.humanCountryId;
      countries[c.id].inCrisis = false;
      countries[c.id].economicScore = 50;
      countries[c.id].tradePartners = [];
      countries[c.id].supplierConcentration = {};
      countries[c.id].exports = {};
      countries[c.id].imports = {};
      countries[c.id].tradeBalance = 0;
      countries[c.id].exportRevenue = 0;
      countries[c.id].importCost = 0;
    }

    // Apply difficulty modifiers
    this.applyDifficulty(countries, config.difficulty);

    // Save initial snapshots for scoring
    for (const [id, country] of Object.entries(countries)) {
      this.initialSnapshots[id] = {
        gdp: country.gdp,
        reserves: country.fxReserves,
        currencyValue: country.currencyValue,
        exports: 0,
      };
    }

    // Pick random objectives for human player
    const objPool = [...OBJECTIVES];
    this.rng.shuffle(objPool);
    const playerObjectives: PlayerObjective[] = objPool.slice(0, 2).map(o => ({ ...o, current: 0, completed: false }));

    return {
      config,
      round: 0,
      phase: 'country-select',
      countries,
      commodities,
      activeShocks: [],
      activeContracts: [],
      tradeOrders: [],
      roundHistory: [],
      newsFeed: ['Welcome to TradeShock! Select your country to begin.'],
      playerObjectives,
      gameOver: false,
    };
  }

  private applyDifficulty(countries: Record<CountryId, Country>, difficulty: string): void {
    const human = Object.values(countries).find(c => c.isHuman);
    if (!human) return;

    switch (difficulty) {
      case 'easy':
        human.fxReserves *= 1.5;
        human.goldReserves *= 1.5;
        human.debt *= 0.8;
        human.debtToGDP *= 0.8;
        human.inflation = Math.max(1, human.inflation - 2);
        break;
      case 'hard':
        human.fxReserves *= 0.7;
        human.debt *= 1.2;
        human.debtToGDP *= 1.2;
        human.inflation += 2;
        // AI gets better
        for (const c of Object.values(countries)) {
          if (!c.isHuman) {
            c.fxReserves *= 1.2;
            c.inflation = Math.max(1, c.inflation - 1);
          }
        }
        break;
      case 'expert':
        human.fxReserves *= 0.5;
        human.debt *= 1.4;
        human.debtToGDP *= 1.4;
        human.inflation += 4;
        for (const c of Object.values(countries)) {
          if (!c.isHuman) {
            c.fxReserves *= 1.3;
            c.inflation = Math.max(1, c.inflation - 2);
          }
        }
        break;
      // normal: no changes
    }
  }

  private deepCloneCountry(c: Country): Country {
    return {
      ...c,
      production: c.production.map(p => ({ ...p })),
      consumption: c.consumption.map(p => ({ ...p })),
      inventory: c.inventory.map(i => ({ ...i })),
      exports: { ...c.exports },
      imports: { ...c.imports },
      tradePartners: [...(c.tradePartners ?? [])],
      supplierConcentration: {},
      aiWeights: { ...c.aiWeights },
    };
  }

  /** Reset round state */
  private resetRoundState(): void {
    for (const country of Object.values(this.state.countries)) {
      country.exports = {};
      country.imports = {};
      country.tradeBalance = 0;
      country.exportRevenue = 0;
      country.importCost = 0;
    }
    this.state.tradeOrders = [];
  }

  // ═══ ROUND EXECUTION ═══

  /** Execute a full round (phases 1-8) */
  executeRound(): RoundResult {
    const round = ++this.state.round;
    this.resetRoundState();

    // Phase 1 & 2: Generate shocks
    const countryList = Object.values(this.state.countries);
    const newShocks = this.shockEngine.generateShocks(round, countryList);
    this.state.activeShocks.push(...newShocks);

    // Phase 3: Market adjustment
    // Update global supply/demand
    this.marketEngine.updateGlobalSupplyDemand(this.state.commodities, this.state.countries);

    // Apply shock effects to supply/demand
    for (const shock of this.state.activeShocks) {
      const se = shock.effects;
      if (se.supplyModifiers) {
        for (const [cid, mod] of Object.entries(se.supplyModifiers)) {
          if (mod == null) continue;
          const c = this.state.commodities[cid];
          if (c) c.supply *= (1 + mod / 100);
        }
      }
      if (se.demandModifiers) {
        for (const [cid, mod] of Object.entries(se.demandModifiers)) {
          if (mod == null) continue;
          const c = this.state.commodities[cid];
          if (c) c.demand *= (1 + mod / 100);
        }
      }
      // Shipping cost modifier
      if (se.shippingCostModifier) {
        for (const c of Object.values(this.state.commodities)) {
          c.transportCost *= (1 + se.shippingCostModifier / 100);
        }
      }
      // Production modifiers
      if (se.productionModifiers) {
        for (const [cid, mod] of Object.entries(se.productionModifiers)) {
          if (mod == null) continue;
          const country = this.state.countries[cid];
          if (country) {
            for (const prod of country.production) {
              prod.production = Math.round(prod.production * (1 + mod / 100));
            }
          }
        }
      }
    }

    // Update prices
    const priceChanges = this.marketEngine.updatePrices(
      this.state.commodities,
      this.state.activeShocks,
      this.state.countries
    );

    // Update exchange rates
    const exchangeRateChanges = this.currencyEngine.updateExchangeRates(
      this.state.countries,
      this.state.commodities,
      this.state.activeShocks
    );

    // ── Generate round briefing (Export + Import analysis with FX outlook) ──
    const humanCountry = Object.values(this.state.countries).find(c => c.isHuman);
    if (humanCountry) {
      this.lastBriefing = this.traderAdvisor.generateBriefing(
        humanCountry,
        this.state.countries,
        this.state.commodities,
        this.state.activeShocks,
        round
      );
    }

    // Phase 4: AI decisions
    const aiOrders = this.aiEngine.generateOrders(
      this.state.countries,
      this.state.commodities,
      round
    );
    this.state.tradeOrders.push(...aiOrders);

    // Phase 5: Human decisions — orders are added externally via addTradeOrder()

    // ── Reactive AI: AI countries respond to player's trade orders ──
    if (humanCountry) {
      const playerOrders = this.state.tradeOrders.filter(o => o.countryId === humanCountry.id);
      if (playerOrders.length > 0) {
        const reactiveOrders = this.aiEngine.reactToPlayerOrders(
          playerOrders,
          humanCountry,
          this.state.countries,
          this.state.commodities,
          round
        );
        this.state.tradeOrders.push(...reactiveOrders);
      }

      // ── Conditional exchange-rate shock ──
      const conditionalShock = this.shockEngine.generateConditionalShock(
        humanCountry,
        this.state.countries,
        this.state.commodities,
        round
      );
      if (conditionalShock) {
        this.state.activeShocks.push(conditionalShock);
        newShocks.push(conditionalShock);
      }
    }

    // Phase 6: Market clearing

    // First execute active contracts
    const contractResult = this.tradeEngine.executeContracts(
      this.state.activeContracts,
      this.state.countries,
      this.state.commodities,
      round
    );
    // Remove expired contracts
    this.state.activeContracts = this.state.activeContracts.filter(
      c => !contractResult.expired.includes(c)
    );

    // Then execute spot orders
    const spotTrades = this.tradeEngine.executeTrades(
      this.state.tradeOrders,
      this.state.countries,
      this.state.commodities,
      round
    );

    const allTrades = [...contractResult.executed, ...spotTrades];

    // Phase 7: Economic results
    this.calculateResults(allTrades);

    // Update inflation based on economic conditions
    this.updateInflation();

    // Update GDP based on trade performance
    this.updateGDP();

    // Phase 8: Scores & ranking
    const countryScores: Record<CountryId, number> = {};
    for (const country of Object.values(this.state.countries)) {
      const initial = this.initialSnapshots[country.id];
      country.economicScore = ScoringEngine.calculateScore(
        country,
        this.state.commodities,
        initial.gdp,
        initial.reserves,
        initial.currencyValue
      );
      countryScores[country.id] = country.economicScore;
    }

    // Update player objectives
    this.updateObjectives();

    // Generate news
    const news = this.eventEngine.generateNews(
      allTrades,
      newShocks,
      this.state.countries,
      priceChanges,
      exchangeRateChanges
    );
    this.state.newsFeed = [...news, ...this.state.newsFeed].slice(0, 50);

    // Tick shock durations, remove expired
    const expired = this.shockEngine.tickDurations(this.state.activeShocks);
    this.state.activeShocks = this.state.activeShocks.filter(s => !expired.includes(s));

    // Check crisis
    for (const country of Object.values(this.state.countries)) {
      const crisisCheck = ScoringEngine.checkCrisis(country, this.state.commodities);
      if (crisisCheck.inCrisis && !country.inCrisis) {
        country.inCrisis = true;
        this.state.newsFeed.unshift(`🚨 ${country.name} enters economic crisis!`);
      } else if (!crisisCheck.inCrisis && country.inCrisis) {
        country.inCrisis = false;
        this.state.newsFeed.unshift(`✅ ${country.name} exits economic crisis.`);
      }
    }

    // Check game over
    if (round >= this.state.config.rounds) {
      this.state.gameOver = true;
      this.state.phase = 'results';
    }

    const result: RoundResult = {
      round,
      trades: allTrades,
      shocks: newShocks,
      priceChanges,
      exchangeRateChanges,
      countryScores,
      news,
    };

    this.state.roundHistory.push(result);
    return result;
  }

  // ═══ POST-ROUND CALCULATIONS ═══

  private calculateResults(trades: ExecutedTrade[]): void {
    for (const country of Object.values(this.state.countries)) {
      // Trade balance
      country.tradeBalance = country.exportRevenue - country.importCost;

      // Adjust FX reserves for trade
      // (already done in TradeEngine)

      // Update GDP effect (small % of trade volume)
      const tradeVolume = country.exportRevenue + country.importCost;
      const gdpEffect = tradeVolume * 0.05;
      country.gdp += gdpEffect;

      // Update debt ratio
      if (country.gdp > 0) {
        country.debtToGDP = country.debt / country.gdp;
      }
    }
  }

  private updateInflation(): void {
    for (const country of Object.values(this.state.countries)) {
      // Inflation driven by:
      // 1. Import costs relative to GDP
      const importPressure = country.gdp > 0 ? (country.importCost / country.gdp) * 10 : 0;
      // 2. Currency depreciation pass-through
      const initial = this.initialSnapshots[country.id];
      const depreciation = initial ? (country.currencyValue / initial.currencyValue - 1) * 100 : 0;
      const depreciationPassThrough = depreciation * 0.3;
      // 3. Domestic supply shortages
      let shortagePressure = 0;
      for (const cons of country.consumption) {
        const prod = country.production.find(p => p.commodityId === cons.commodityId);
        const inv = country.inventory.find(i => i.commodityId === cons.commodityId);
        const available = (prod?.production ?? 0) + (inv?.quantity ?? 0) * 0.1;
        if (cons.consumption > 0 && available < cons.consumption) {
          shortagePressure += (1 - available / cons.consumption) * 5;
        }
      }
      // 4. Mean reversion
      const meanReversion = (3 - country.inflation) * 0.1;

      country.inflation += importPressure + depreciationPassThrough + shortagePressure + meanReversion;
      country.inflation = Math.max(-2, Math.min(25, country.inflation));
      country.inflation = Math.round(country.inflation * 100) / 100;
    }
  }

  private updateGDP(): void {
    for (const country of Object.values(this.state.countries)) {
      // GDP growth from trade surplus and production
      const tradeEffect = country.tradeBalance * 0.02;
      const productionValue = country.production.reduce((sum, p) => {
        const commodity = this.state.commodities[p.commodityId];
        return sum + p.production * (commodity?.currentGlobalPrice ?? 0);
      }, 0);
      const growthEffect = productionValue * 0.01;
      const randomEffect = this.rng.range(-country.gdp * 0.01, country.gdp * 0.01);

      country.gdp += tradeEffect + growthEffect + randomEffect;
      country.gdp = Math.max(100, country.gdp);
      country.gdp = Math.round(country.gdp);
    }
  }

  // ═══ PLAYER OBJECTIVES ═══

  private updateObjectives(): void {
    const human = Object.values(this.state.countries).find(c => c.isHuman);
    if (!human) return;

    const initial = this.initialSnapshots[human.id];

    for (const obj of this.state.playerObjectives) {
      if (obj.completed) continue;

      switch (obj.metric) {
        case 'exportGrowth': {
          const currentExports = human.exportRevenue;
          const initialExports = initial.exports;
          if (initialExports > 0) {
            obj.current = Math.round(((currentExports - initialExports) / initialExports) * 100);
          }
          break;
        }
        case 'currencyDepreciation': {
          const dep = initial ? ((human.currencyValue - initial.currencyValue) / initial.currencyValue) * 100 : 0;
          obj.current = Math.round(Math.max(0, dep) * 100) / 100;
          break;
        }
        case 'maxSupplierShare': {
          let maxShare = 0;
          for (const suppliers of Object.values(human.supplierConcentration)) {
            for (const s of suppliers) {
              maxShare = Math.max(maxShare, s.share);
            }
          }
          obj.current = Math.round(maxShare * 100);
          break;
        }
        case 'machineryGrowth': {
          const machProd = human.production.find(p => p.commodityId === 'machinery');
          const initialMach = this.initialSnapshots[human.id]?.gdp ?? human.gdp;
          obj.current = machProd ? Math.round(((machProd.production - (machProd.capacity * 0.5)) / (machProd.capacity * 0.5)) * 100) : 0;
          break;
        }
        case 'minInventoryLevel': {
          let minLevel = 100;
          for (const cons of human.consumption) {
            const inv = human.inventory.find(i => i.commodityId === cons.commodityId);
            const level = cons.consumption > 0 ? ((inv?.quantity ?? 0) / cons.consumption) * 100 : 100;
            minLevel = Math.min(minLevel, level);
          }
          obj.current = Math.round(minLevel);
          break;
        }
        case 'reserveGrowth': {
          const reserveChange = initial ? ((human.fxReserves - initial.reserves) / initial.reserves) * 100 : 0;
          obj.current = Math.round(reserveChange * 100) / 100;
          break;
        }
      }

      // Check completion
      if (
        (obj.metric === 'maxSupplierShare' && obj.current <= obj.target) ||
        (obj.metric === 'currencyDepreciation' && obj.current <= obj.target) ||
        (obj.metric === 'minInventoryLevel' && obj.current >= obj.target) ||
        (['exportGrowth', 'reserveGrowth', 'machineryGrowth'].includes(obj.metric) && obj.current >= obj.target)
      ) {
        obj.completed = true;
        this.state.newsFeed.unshift(`🏆 Objective completed: "${obj.name}"!`);
      }
    }
  }

  // ═══ PLAYER ACTIONS ═══

  /** Add a player trade order */
  addTradeOrder(order: TradeOrder): void {
    this.state.tradeOrders.push(order);
  }

  /** Player creates a contract */
  createContract(
    seller: CountryId,
    buyer: CountryId,
    commodityId: CommodityId,
    quantity: number,
    price: number,
    currency: string,
    type: ContractType,
    rounds: number = 4
  ): TradeContract {
    const contract = ContractEngine.createContract(
      buyer, seller, commodityId, quantity, price, currency, type, rounds
    );
    contract.createdAt = this.state.round;
    this.state.activeContracts.push(contract);
    return contract;
  }

  /** Player adjusts export allocation */
  setExportAllocation(countryId: CountryId, commodityId: CommodityId, domestic: number, exportQty: number, stockpile: number): void {
    const country = this.state.countries[countryId];
    if (!country) return;

    const prod = country.production.find(p => p.commodityId === commodityId);
    if (!prod) return;

    // Adjust consumption
    const cons = country.consumption.find(c => c.commodityId === commodityId);
    if (cons) {
      cons.consumption = domestic;
    }

    // Stockpile goes to inventory
    const inv = country.inventory.find(i => i.commodityId === commodityId);
    if (inv) {
      inv.quantity += stockpile;
    }

    // Remaining is export (handled via trade orders)
  }

  /** Get trade negotiation info for a target country */
  getTradeInfo(countryId: CountryId): {
    needs: { commodityId: CommodityId; importance: number }[];
    surplus: { commodityId: CommodityId; amount: number }[];
    currency: string;
    currencyMovement: number;
    suggestedBuys: string[];
    suggestedSells: string[];
  } {
    const country = this.state.countries[countryId];
    if (!country) throw new Error('Country not found');

    const needs: { commodityId: CommodityId; importance: number }[] = [];
    const surplus: { commodityId: CommodityId; amount: number }[] = [];
    const suggestedBuys: string[] = [];
    const suggestedSells: string[] = [];

    for (const cons of country.consumption) {
      const prod = country.production.find(p => p.commodityId === cons.commodityId);
      const net = cons.consumption - (prod?.production ?? 0);
      if (net > 0) {
        needs.push({
          commodityId: cons.commodityId,
          importance: cons.required ? 5 : Math.round(net * 2),
        });
        suggestedSells.push(cons.commodityId);
      }
    }

    for (const prod of country.production) {
      const cons = country.consumption.find(c => c.commodityId === prod.commodityId);
      const net = prod.production - (cons?.consumption ?? 0);
      if (net > 0) {
        surplus.push({ commodityId: prod.commodityId, amount: net });
        suggestedBuys.push(prod.commodityId);
      }
    }

    const initial = this.initialSnapshots[countryId];
    const currencyMovement = initial ? ((country.currencyValue - initial.currencyValue) / initial.currencyValue) * 100 : 0;

    return {
      needs,
      surplus,
      currency: country.currency,
      currencyMovement: Math.round(currencyMovement * 100) / 100,
      suggestedBuys,
      suggestedSells,
    };
  }

  /** Save game state to serializable object */
  saveGame(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /** Load game state */
  loadGame(saved: string): void {
    this.state = JSON.parse(saved);
    // Re-initialize engines with same seed
    this.rng = new SeededRNG(this.state.config.seed);
    this.marketEngine = new MarketEngine(this.rng);
    this.currencyEngine = new CurrencyEngine(this.rng);
    this.shockEngine = new ShockEngine(this.rng);
    this.aiEngine = new AIEngine(this.rng);
    this.tradeEngine = new TradeEngine(this.rng);
    this.eventEngine = new EventEngine(this.rng);
    // Recompute initial snapshots from round 0 data
    for (const [id, country] of Object.entries(this.state.countries)) {
      this.initialSnapshots[id] = {
        gdp: country.gdp,
        reserves: country.fxReserves,
        currencyValue: country.currencyValue,
        exports: 0,
      };
    }
  }
}
