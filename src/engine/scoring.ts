import type { CompanyState, MonthResult, Ranking, ScoreResult } from './types';
import { clamp } from './rng';
import { SCORING_WEIGHTS, STARTING, TOTAL_MONTHS } from './constants';

const RATING_SCORE: Record<string, number> = {
  AAA: 100,
  AA: 90,
  A: 80,
  BBB: 70,
  BB: 55,
  B: 40,
  CCC: 25,
  D: 0,
};

export function computeScore(
  history: MonthResult[],
  company: CompanyState,
  bankrupt: boolean,
): ScoreResult {
  const cashGrowth = clamp(((company.cash - STARTING.cash) / STARTING.cash) * 50 + 50, 0, 100);
  const profitTarget = STARTING.cash * 0.5;
  const profitGrowth = clamp((company.cumulativeProfit / profitTarget) * 100, 0, 100);
  const avgRisk = history.length
    ? history.reduce((s, h) => s + h.riskScore, 0) / history.length
    : company.riskScore;
  const riskManagement = clamp(100 - avgRisk, 0, 100);
  const creditScore = RATING_SCORE[company.creditRating] ?? 50;
  const survival = bankrupt
    ? clamp((company.monthsSurvived / TOTAL_MONTHS) * 100, 0, 100)
    : 100;

  const score = Math.round(
    cashGrowth * SCORING_WEIGHTS.cashGrowth +
      profitGrowth * SCORING_WEIGHTS.profitGrowth +
      riskManagement * SCORING_WEIGHTS.riskManagement +
      creditScore * SCORING_WEIGHTS.creditRating +
      survival * SCORING_WEIGHTS.survival,
  );

  const ranking: Ranking =
    score >= 85 ? 'Expert CFO' : score >= 70 ? 'Good CFO' : score >= 55 ? 'Average CFO' : 'Poor CFO';

  const finalCompanyValue = Math.round((company.cash + company.inventory - company.debt) * company.ownership);

  return {
    score,
    ranking,
    cashGrowth: Math.round(cashGrowth),
    profitGrowth: Math.round(profitGrowth),
    riskManagement: Math.round(riskManagement),
    creditScore: Math.round(creditScore),
    survival: Math.round(survival),
    finalCompanyValue,
    totalProfit: Math.round(company.cumulativeProfit),
    totalCash: Math.round(company.cash),
    riskScore: company.riskScore,
    creditRating: company.creditRating,
    monthsSurvived: company.monthsSurvived,
  };
}
