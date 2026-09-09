import type { CreditRating } from './types';

export const TOTAL_MONTHS = 12;

export const STARTING = {
  cash: 5_000_000,
  debt: 2_000_000,
  inventory: 3_000_000,
  monthlyRevenue: 1_000_000,
  employees: 20,
  markets: ['Europe'],
  suppliers: ['China'],
  ownership: 1,
  creditRating: 'BBB' as CreditRating,
  riskScore: 30,
};

export const COGS_RATIO = 0.55;
export const SALARY_PER_EMPLOYEE = 9_000;
export const FIXED_OVERHEAD = 100_000;
export const BASE_SHIPPING = 60_000;
export const INVENTORY_CARRY_RATE = 0.01;
export const CREDIT_MARGIN = 0.15;

export const INTEREST_RATE: Record<CreditRating, number> = {
  AAA: 0.003,
  AA: 0.0035,
  A: 0.004,
  BBB: 0.005,
  BB: 0.008,
  B: 0.012,
  CCC: 0.018,
  D: 0.03,
};

export const SCORING_WEIGHTS = {
  cashGrowth: 0.3,
  profitGrowth: 0.3,
  riskManagement: 0.2,
  creditRating: 0.1,
  survival: 0.1,
} as const;

export const FX_EXPOSURE = 1_000_000;
export const CREDIT_ORDER = 2_000_000;
export const INVENTORY_STEP = 1_000_000;

export const BANKRUPTCY_CASH_FLOOR = -1_000_000;
