import type { AdvisorInsight, CompanyState, MarketState } from './types';

export function generateAdvisorBoard(company: CompanyState, market: MarketState): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];

  // Treasury — Currency (FX) indicator
  const usdPct = market.usdChange * 100;
  if (Math.abs(market.usdChange) > 0.04) {
    insights.push({
      advisor: 'Treasury',
      message: `USD moved ${usdPct >= 0 ? '+' : ''}${usdPct.toFixed(1)}% this month — your FX exposure is elevated.`,
    });
  } else {
    insights.push({
      advisor: 'Treasury',
      message: `USD is steady (${usdPct >= 0 ? '+' : ''}${usdPct.toFixed(1)}%) — FX risk is low this month.`,
    });
  }

  // Risk Manager — Credit climate indicator
  const recession = Math.round(market.recessionRisk);
  if (market.recessionRisk > 60) {
    insights.push({
      advisor: 'Risk Manager',
      message: `Credit climate is deteriorating (recession risk ${recession}/100).`,
    });
  } else {
    insights.push({
      advisor: 'Risk Manager',
      message: `Credit climate is stable (recession risk ${recession}/100).`,
    });
  }

  // Market Analyst — Supply chain & demand indicator
  const shipHigh = market.shippingMultiplier > 1.2;
  const tariffHigh = market.tariffRate > 0.1;
  if (shipHigh || tariffHigh) {
    const tariff = tariffHigh ? `, tariffs ${Math.round(market.tariffRate * 100)}%` : '';
    insights.push({
      advisor: 'Market Analyst',
      message: `Supply chain is tight (shipping ${market.shippingMultiplier.toFixed(1)}×${tariff}).`,
    });
  } else if (market.demandIndex > 75) {
    insights.push({
      advisor: 'Market Analyst',
      message: 'Supply chain is smooth and demand is strong.',
    });
  } else {
    insights.push({
      advisor: 'Market Analyst',
      message: 'Supply chain is stable; demand is moderate.',
    });
  }

  return insights;
}
