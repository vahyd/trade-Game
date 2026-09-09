import type { AdvisorInsight, CompanyState, MarketState } from './types';

export function generateAdvisorBoard(company: CompanyState, market: MarketState): AdvisorInsight[] {
  const insights: AdvisorInsight[] = [];

  const cashMonths = company.cash / Math.max(company.monthlyRevenue, 1);
  if (cashMonths < 2) {
    insights.push({ advisor: 'Treasury', message: 'Cash reserves are becoming low — watch liquidity.' });
  } else {
    insights.push({ advisor: 'Treasury', message: 'Liquidity is healthy; consider deploying excess cash.' });
  }

  if (market.recessionRisk > 60) {
    insights.push({ advisor: 'Risk Manager', message: 'Country and credit risk are rising with recession odds.' });
  } else {
    insights.push({ advisor: 'Risk Manager', message: 'Credit risk is contained for now.' });
  }

  if (market.demandIndex > 75) {
    insights.push({ advisor: 'Market Analyst', message: 'Demand in Europe appears strong.' });
  } else if (market.demandIndex < 50) {
    insights.push({ advisor: 'Market Analyst', message: 'Demand is weakening — watch order flow.' });
  } else {
    insights.push({ advisor: 'Market Analyst', message: 'Demand is steady across your markets.' });
  }

  return insights;
}
