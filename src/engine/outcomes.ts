import type {
  CompanyState,
  CreditRating,
  Decision,
  MarketState,
  MonthResult,
  Outcome,
  PlayerChoice,
} from './types';
import { clamp } from './rng';
import type { Rng } from './rng';
import {
  BASE_SHIPPING,
  COGS_RATIO,
  CREDIT_MARGIN,
  FIXED_OVERHEAD,
  INVENTORY_CARRY_RATE,
  INTEREST_RATE,
  SALARY_PER_EMPLOYEE,
} from './constants';
import { formatCompact } from '../format';

function findChoice(choices: PlayerChoice[], id: string): PlayerChoice | undefined {
  return choices.find((c) => c.decisionId === id);
}

export function ratingFromRisk(risk: number): CreditRating {
  if (risk < 20) return 'AA';
  if (risk < 35) return 'A';
  if (risk < 50) return 'BBB';
  if (risk < 65) return 'BB';
  if (risk < 80) return 'B';
  return 'CCC';
}

export function resolveMonth(
  rng: Rng,
  company: CompanyState,
  market: MarketState,
  decisions: Decision[],
  choices: PlayerChoice[],
  month: number,
): { company: CompanyState; result: MonthResult } {
  const outcomes: Outcome[] = [];
  let fxImpact = 0;
  let decisionProfit = 0;
  let inventoryCashFlow = 0;
  let financingCashFlow = 0;
  let stockoutLoss = 0;
  let wasteCost = 0;

  const cashBefore = company.cash;
  const debtBefore = company.debt;

  const next: CompanyState = {
    ...company,
    markets: [...company.markets],
    suppliers: [...company.suppliers],
  };

  // ---- Currency / FX ----
  const currency = decisions.find((d) => d.category === 'currency');
  if (currency) {
    const choice = findChoice(choices, currency.id);
    const exposure = currency.amount;
    const usd = market.usdChange;
    let hedgeRatio = 0;
    if (choice?.optionId === 'hedge50') hedgeRatio = 0.5;
    if (choice?.optionId === 'hedge100') hedgeRatio = 1;
    const fee = exposure * hedgeRatio * 0.005;
    fxImpact = -exposure * usd * (1 - hedgeRatio) - fee;

    const pct = Math.abs(usd) * 100;
    if (hedgeRatio === 0) {
      if (usd > 0) {
        outcomes.push({
          category: 'currency',
          title: 'FX loss on unhedged exposure',
          detail: `You did not hedge your USD exposure. The USD appreciated by ${pct.toFixed(1)}%. The company lost ${formatCompact(exposure * usd)}. A partial hedge would have reduced the loss.`,
          cashImpact: -exposure * usd,
          profitImpact: -exposure * usd,
          good: false,
        });
      } else if (usd < 0) {
        outcomes.push({
          category: 'currency',
          title: 'FX gain on unhedged exposure',
          detail: `You left exposure unhedged and the USD depreciated by ${pct.toFixed(1)}%. You gained ${formatCompact(exposure * Math.abs(usd))}, but unhedged positions are risky when volatility is high.`,
          cashImpact: exposure * Math.abs(usd),
          profitImpact: exposure * Math.abs(usd),
          good: true,
        });
      } else {
        outcomes.push({
          category: 'currency',
          title: 'Flat FX',
          detail: 'The USD was flat, so your unhedged exposure caused no gain or loss this month.',
          cashImpact: 0,
          profitImpact: 0,
          good: true,
        });
      }
    } else {
      outcomes.push({
        category: 'currency',
        title: `Hedged ${hedgeRatio * 100}% of exposure`,
        detail: `You hedged ${hedgeRatio * 100}% of your USD exposure at a cost of ${formatCompact(fee)}. The USD moved ${usd > 0 ? 'up' : 'down'} ${pct.toFixed(1)}%. Your net FX impact was ${formatCompact(fxImpact)}.`,
        cashImpact: fxImpact,
        profitImpact: fxImpact,
        good: true,
      });
    }
  }

  // ---- Customer Credit ----
  const credit = decisions.find((d) => d.category === 'credit');
  if (credit) {
    const choice = findChoice(choices, credit.id);
    const amount = credit.amount;
    const risk = credit.hidden?.customerRisk ?? 0.2;
    const margin = amount * CREDIT_MARGIN;

    switch (choice?.optionId) {
      case 'accept': {
        if (rng.chance(risk)) {
          const loss = amount * 0.85;
          decisionProfit -= loss;
          outcomes.push({
            category: 'credit',
            title: 'Customer defaulted',
            detail: `You extended open credit and the customer defaulted. You wrote off ${formatCompact(loss)} in receivables. A Letter of Credit or prepayment would have protected you.`,
            cashImpact: -loss,
            profitImpact: -loss,
            good: false,
          });
        } else {
          decisionProfit += margin;
          outcomes.push({
            category: 'credit',
            title: 'Order paid in full',
            detail: `The customer paid. You earned a ${formatCompact(margin)} margin on the order. Open credit maximizes sales but carries default risk.`,
            cashImpact: margin,
            profitImpact: margin,
            good: true,
          });
        }
        break;
      }
      case 'lc': {
        const fee = amount * 0.01;
        const net = margin - fee;
        decisionProfit += net;
        outcomes.push({
          category: 'credit',
          title: 'Order secured via Letter of Credit',
          detail: `The Letter of Credit guaranteed payment. You earned ${formatCompact(net)} after the ${formatCompact(fee)} bank fee.`,
          cashImpact: net,
          profitImpact: net,
          good: true,
        });
        break;
      }
      case 'prepay': {
        if (rng.chance(0.25)) {
          outcomes.push({
            category: 'credit',
            title: 'Customer cancelled the order',
            detail: 'The customer refused your 50% prepayment requirement and walked away. You avoided default risk but lost the sale.',
            cashImpact: 0,
            profitImpact: 0,
            good: false,
          });
        } else {
          decisionProfit += margin;
          outcomes.push({
            category: 'credit',
            title: 'Customer accepted prepayment',
            detail: `The customer paid 50% up front and completed the order. You earned ${formatCompact(margin)} with reduced credit exposure.`,
            cashImpact: margin,
            profitImpact: margin,
            good: true,
          });
        }
        break;
      }
      case 'reject':
      default:
        outcomes.push({
          category: 'credit',
          title: 'Order rejected',
          detail: 'You declined the order and took no credit risk, but also earned nothing this month.',
          cashImpact: 0,
          profitImpact: 0,
          good: false,
        });
        break;
    }
  }

  // ---- Inventory ----
  const inventory = decisions.find((d) => d.category === 'inventory');
  if (inventory) {
    const choice = findChoice(choices, inventory.id);
    const step = inventory.amount;
    if (choice?.optionId === 'increase') {
      inventoryCashFlow = -step;
      next.inventory += step;
      outcomes.push({
        category: 'inventory',
        title: 'Increased inventory',
        detail: `You bought ${formatCompact(step)} more inventory. Carrying costs will rise, but you are positioned for higher demand.`,
        cashImpact: -step,
        profitImpact: 0,
        good: true,
      });
    } else if (choice?.optionId === 'reduce') {
      const sold = Math.min(step, next.inventory);
      inventoryCashFlow = sold;
      next.inventory -= sold;
      outcomes.push({
        category: 'inventory',
        title: 'Reduced inventory',
        detail: `You sold down ${formatCompact(sold)} of inventory, freeing cash and lowering carrying costs.`,
        cashImpact: sold,
        profitImpact: 0,
        good: true,
      });
    } else {
      outcomes.push({
        category: 'inventory',
        title: 'Inventory kept stable',
        detail: 'You kept inventory unchanged this month.',
        cashImpact: 0,
        profitImpact: 0,
        good: true,
      });
    }
  }

  // ---- Financing ----
  const financing = decisions.find((d) => d.category === 'financing');
  if (financing) {
    const choice = findChoice(choices, financing.id);
    const amount = financing.amount;
    switch (choice?.optionId) {
      case 'loan':
      case 'bond': {
        financingCashFlow = amount;
        next.debt += amount;
        next.monthlyRevenue += 60_000;
        next.employees += 2;
        outcomes.push({
          category: 'financing',
          title: choice?.optionId === 'loan' ? 'Took a bank loan' : 'Issued a bond',
          detail: `You raised ${formatCompact(amount)} to fund growth. Revenue capacity rose to ${formatCompact(next.monthlyRevenue)}/month, but debt and interest costs are now higher.`,
          cashImpact: amount,
          profitImpact: 0,
          good: true,
        });
        break;
      }
      case 'equity': {
        financingCashFlow = amount;
        next.ownership *= 0.85;
        next.monthlyRevenue += 60_000;
        next.employees += 2;
        outcomes.push({
          category: 'financing',
          title: 'Raised equity',
          detail: `You raised ${formatCompact(amount)} by selling shares. No new debt, but your ownership is diluted to ${Math.round(next.ownership * 100)}%.`,
          cashImpact: amount,
          profitImpact: 0,
          good: true,
        });
        break;
      }
      case 'none':
      default:
        outcomes.push({
          category: 'financing',
          title: 'Passed on growth',
          detail: 'You did nothing and missed the growth opportunity — no new debt or cash, but revenue capacity is unchanged.',
          cashImpact: 0,
          profitImpact: 0,
          good: false,
        });
        break;
    }
  }

  // ---- Monthly P&L ----
  const demandMultiplier = 0.8 + (market.demandIndex / 100) * 0.4;
  const revenue = next.monthlyRevenue * demandMultiplier;
  const cogs = revenue * COGS_RATIO;
  const salaries = next.employees * SALARY_PER_EMPLOYEE;
  const overhead = FIXED_OVERHEAD;
  const shipping = BASE_SHIPPING * market.shippingMultiplier;
  const interest = next.debt * INTEREST_RATE[next.creditRating];
  const carrying = next.inventory * INVENTORY_CARRY_RATE;
  const tariff = cogs * market.tariffRate;

  if (market.demandIndex > 80 && next.inventory < 1_500_000) {
    stockoutLoss = revenue * 0.1;
    outcomes.push({
      category: 'financial',
      title: 'Stockout — lost sales',
      detail: `Demand was strong but your inventory was too low. You lost ${formatCompact(stockoutLoss)} in missed sales.`,
      cashImpact: 0,
      profitImpact: -stockoutLoss,
      good: false,
    });
  }
  if (market.demandIndex < 45 && next.inventory > 5_000_000) {
    wasteCost = next.inventory * 0.005;
    outcomes.push({
      category: 'financial',
      title: 'Excess inventory costs',
      detail: `Demand was weak while you held excess inventory, adding ${formatCompact(wasteCost)} in extra storage and spoilage costs.`,
      cashImpact: 0,
      profitImpact: -wasteCost,
      good: false,
    });
  }

  const operatingProfit = revenue - cogs - salaries - overhead - shipping - interest - carrying - tariff;
  const profit = operatingProfit + fxImpact + decisionProfit - stockoutLoss - wasteCost;
  const cashDelta =
    operatingProfit + fxImpact + decisionProfit - stockoutLoss - wasteCost + inventoryCashFlow + financingCashFlow;

  next.cash += cashDelta;
  next.cumulativeProfit += profit;
  next.monthsSurvived += 1;

  // ---- Risk score & credit rating ----
  const assets = next.cash + next.inventory;
  const leverage = next.debt / Math.max(assets, 1);
  let risk = 25;
  risk += clamp(leverage, 0, 1) * 45;

  const currencyChoice = findChoice(choices, currency?.id ?? '');
  if (currencyChoice?.optionId === 'none' && Math.abs(market.usdChange) > 0.04) risk += 15;

  const creditChoice = findChoice(choices, credit?.id ?? '');
  if (creditChoice?.optionId === 'accept' && (credit?.hidden?.customerRisk ?? 0) > 0.2) risk += 10;

  risk += market.recessionRisk * 0.15;
  risk = clamp(Math.round(risk), 0, 100);
  next.riskScore = risk;
  next.creditRating = ratingFromRisk(risk);

  const result: MonthResult = {
    month,
    revenue,
    cogs,
    salaries,
    overhead,
    shipping,
    interest,
    carrying,
    tariff,
    fxImpact,
    decisionImpact: fxImpact + decisionProfit - stockoutLoss - wasteCost,
    profit,
    cashBefore,
    cashAfter: next.cash,
    debtBefore,
    debtAfter: next.debt,
    creditRating: next.creditRating,
    riskScore: next.riskScore,
    outcomes,
  };

  return { company: next, result };
}
