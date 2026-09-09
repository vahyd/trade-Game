export type CreditRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D';

export type DecisionCategory = 'currency' | 'credit' | 'financing' | 'inventory';

export type AdvisorName = 'Treasury' | 'Risk Manager' | 'Market Analyst';

export type Impact = 'positive' | 'negative' | 'neutral';

export interface NewsItem {
  id: string;
  headline: string;
  category: 'fx' | 'shipping' | 'tariff' | 'economy' | 'demand' | 'credit';
  impact: Impact;
}

export interface CompanyState {
  cash: number;
  debt: number;
  inventory: number;
  monthlyRevenue: number;
  employees: number;
  markets: string[];
  suppliers: string[];
  ownership: number;
  creditRating: CreditRating;
  riskScore: number;
  cumulativeProfit: number;
  monthsSurvived: number;
}

export interface MarketState {
  usdChange: number;
  shippingMultiplier: number;
  tariffRate: number;
  demandIndex: number;
  recessionRisk: number;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
}

export interface AdvisorInsight {
  advisor: AdvisorName;
  message: string;
}

export interface Recommendation {
  optionId: string;
  actionLabel: string;
  reason: string;
  confidence: number;
}

export interface Decision {
  id: string;
  category: DecisionCategory;
  title: string;
  description: string;
  amount: number;
  options: DecisionOption[];
  insights: AdvisorInsight[];
  recommendation: Recommendation;
  hidden?: {
    customerRisk?: number;
  };
}

export interface PlayerChoice {
  decisionId: string;
  optionId: string;
  followedRecommendation: boolean;
}

export interface Outcome {
  category: DecisionCategory | 'financial';
  title: string;
  detail: string;
  cashImpact: number;
  profitImpact: number;
  good: boolean;
}

export interface MonthResult {
  month: number;
  revenue: number;
  cogs: number;
  salaries: number;
  overhead: number;
  shipping: number;
  interest: number;
  carrying: number;
  tariff: number;
  fxImpact: number;
  decisionImpact: number;
  profit: number;
  cashBefore: number;
  cashAfter: number;
  debtBefore: number;
  debtAfter: number;
  creditRating: CreditRating;
  riskScore: number;
  outcomes: Outcome[];
}

export type Ranking = 'Poor CFO' | 'Average CFO' | 'Good CFO' | 'Expert CFO';

export interface ScoreResult {
  score: number;
  ranking: Ranking;
  cashGrowth: number;
  profitGrowth: number;
  riskManagement: number;
  creditScore: number;
  survival: number;
  finalCompanyValue: number;
  totalProfit: number;
  totalCash: number;
  riskScore: number;
  creditRating: CreditRating;
  monthsSurvived: number;
}

export interface GameState {
  phase: 'playing' | 'results';
  month: number;
  seed: number;
  company: CompanyState;
  market: MarketState;
  news: NewsItem[];
  decisions: Decision[];
  history: MonthResult[];
  lastResult: MonthResult | null;
  bankrupt: boolean;
  finalScore: ScoreResult | null;
}
