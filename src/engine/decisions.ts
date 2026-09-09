import type {
  AdvisorInsight,
  CompanyState,
  Decision,
  DecisionOption,
  MarketState,
  Recommendation,
} from './types';
import type { Rng } from './rng';
import { CREDIT_ORDER, FX_EXPOSURE, INVENTORY_STEP } from './constants';

function opts(entries: [string, string, string][]): DecisionOption[] {
  return entries.map(([id, label, description]) => ({ id, label, description }));
}

export function generateDecisions(
  rng: Rng,
  company: CompanyState,
  market: MarketState,
  month: number,
): Decision[] {
  return [
    currencyDecision(market, month),
    creditDecision(rng, market, month),
    inventoryDecision(rng, company, market, month),
  ];
}

function currencyDecision(market: MarketState, month: number): Decision {
  const volatility = Math.abs(market.usdChange);
  const insights: AdvisorInsight[] = [
    { advisor: 'Treasury', message: 'USD exposure on your import pipeline is running high this month.' },
    {
      advisor: 'Market Analyst',
      message: volatility > 0.03 ? 'FX markets look volatile; sharp moves are likely.' : 'FX markets look relatively calm.',
    },
  ];

  let optionId: string;
  let actionLabel: string;
  let reason: string;
  if (volatility > 0.04) {
    optionId = 'hedge100';
    actionLabel = 'Hedge 100% of USD exposure';
    reason = 'Currency volatility is elevated — full protection is prudent.';
  } else if (volatility > 0.02) {
    optionId = 'hedge50';
    actionLabel = 'Hedge 50% of USD exposure';
    reason = 'Currency volatility is increasing — partial hedging balances cost and risk.';
  } else {
    optionId = 'none';
    actionLabel = 'Leave exposure unhedged';
    reason = 'Volatility is low — hedging costs may exceed the expected benefit.';
  }

  const recommendation: Recommendation = {
    optionId,
    actionLabel,
    reason,
    confidence: Math.min(90, Math.round(55 + volatility * 800)),
  };

  return {
    id: `currency-${month}`,
    category: 'currency',
    title: 'Currency Risk — upcoming USD purchase',
    description: `You expect to purchase goods worth $${(FX_EXPOSURE / 1_000_000).toFixed(1)} million from a USD supplier next quarter.`,
    amount: FX_EXPOSURE,
    options: opts([
      ['none', 'No hedge', 'Leave the full $1.0M exposure open to currency swings.'],
      ['hedge50', 'Hedge 50%', 'Lock in half the exposure; pay a small hedging fee.'],
      ['hedge100', 'Hedge 100%', 'Fully lock the rate; pay a fee but eliminate FX risk.'],
    ]),
    insights,
    recommendation,
  };
}

function creditDecision(rng: Rng, market: MarketState, month: number): Decision {
  const baseRisk = 0.1 + market.recessionRisk * 0.002;
  const customerRisk = Math.min(0.45, baseRisk + rng.float(-0.05, 0.15));
  const riskLabel = customerRisk > 0.3 ? 'high' : customerRisk > 0.18 ? 'medium' : 'low';

  const insights: AdvisorInsight[] = [
    {
      advisor: 'Risk Manager',
      message:
        riskLabel === 'high'
          ? 'This customer has elevated default risk.'
          : riskLabel === 'medium'
            ? 'This customer has moderate credit risk.'
            : 'This customer looks creditworthy.',
    },
    {
      advisor: 'Market Analyst',
      message:
        market.demandIndex > 70
          ? 'Demand is firm — a big order would help revenue.'
          : 'Demand is soft — weigh the size of this order carefully.',
    },
  ];

  let optionId: string;
  let actionLabel: string;
  let reason: string;
  if (riskLabel === 'high') {
    optionId = 'lc';
    actionLabel = 'Accept with Letter of Credit';
    reason = 'Elevated default risk — a Letter of Credit protects the receivable.';
  } else if (riskLabel === 'medium') {
    optionId = 'prepay';
    actionLabel = 'Require 50% prepayment';
    reason = 'Moderate risk — a prepayment reduces exposure while keeping the sale.';
  } else {
    optionId = 'accept';
    actionLabel = 'Accept on open credit';
    reason = 'Low default risk — open credit is the most competitive offer.';
  }

  const recommendation: Recommendation = {
    optionId,
    actionLabel,
    reason,
    confidence: Math.min(90, Math.round(60 + (customerRisk - 0.15) * 120)),
  };

  return {
    id: `credit-${month}`,
    category: 'credit',
    title: 'Customer Credit — new order',
    description: `A new customer wants to buy $${(CREDIT_ORDER / 1_000_000).toFixed(1)} million of products.`,
    amount: CREDIT_ORDER,
    options: opts([
      ['accept', 'Accept (open credit)', 'Extend normal payment terms; strongest offer but exposed to default.'],
      ['lc', 'Accept with Letter of Credit', 'Bank guarantees payment; pay a small fee.'],
      ['prepay', 'Require 50% prepayment', 'Customer pays half up front; may walk away from the deal.'],
      ['reject', 'Reject', 'Decline the order and take no credit risk.'],
    ]),
    insights,
    recommendation,
    hidden: { customerRisk },
  };
}

function inventoryDecision(rng: Rng, company: CompanyState, market: MarketState, month: number): Decision {
  const shippingLow = market.shippingMultiplier < 0.85;
  const demandHigh = market.demandIndex > 75;

  const insights: AdvisorInsight[] = [
    {
      advisor: 'Treasury',
      message: shippingLow ? 'Shipping costs are low — a good time to stock up.' : 'Shipping costs are elevated — buying now is expensive.',
    },
    {
      advisor: 'Market Analyst',
      message: demandHigh ? 'Demand looks strong — low stock risks lost sales.' : 'Demand is muted — excess inventory adds carrying cost.',
    },
  ];

  let optionId: string;
  let actionLabel: string;
  let reason: string;
  if (shippingLow && demandHigh) {
    optionId = 'increase';
    actionLabel = 'Increase inventory';
    reason = 'Cheap shipping and strong demand favor building inventory.';
  } else if (!shippingLow && !demandHigh) {
    optionId = 'reduce';
    actionLabel = 'Reduce inventory';
    reason = 'High shipping and weak demand make holding inventory costly.';
  } else {
    optionId = 'keep';
    actionLabel = 'Keep inventory stable';
    reason = 'Mixed signals — keep inventory stable.';
  }

  const recommendation: Recommendation = {
    optionId,
    actionLabel,
    reason,
    confidence: Math.round(58 + rng.float(0, 20)),
  };

  return {
    id: `inventory-${month}`,
    category: 'inventory',
    title: 'Inventory — stock level',
    description: `You hold $${(company.inventory / 1_000_000).toFixed(1)}M of inventory. Shipping costs are ${shippingLow ? 'low' : 'high'}.`,
    amount: INVENTORY_STEP,
    options: opts([
      ['increase', 'Increase inventory', `Buy $${(INVENTORY_STEP / 1_000_000).toFixed(1)}M more stock.`],
      ['keep', 'Keep inventory stable', 'Leave stock levels unchanged.'],
      ['reduce', 'Reduce inventory', `Sell down $${(INVENTORY_STEP / 1_000_000).toFixed(1)}M of stock.`],
    ]),
    insights,
    recommendation,
  };
}
