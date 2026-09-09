import type { ScoreResult } from '../engine/types';

const BASE_URL = 'http://localhost:8000';

export interface LeaderboardEntry {
  id: number;
  name: string;
  score: number;
  ranking: string;
  total_profit: number;
  total_cash: number;
  risk_score: number;
  credit_rating: string;
  months_survived: number;
  created_at: string;
}

export async function submitScore(
  name: string,
  result: ScoreResult,
): Promise<{ ok: boolean; entry?: LeaderboardEntry; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        score: result.score,
        ranking: result.ranking,
        total_profit: result.totalProfit,
        total_cash: result.totalCash,
        risk_score: result.riskScore,
        credit_rating: result.creditRating,
        months_survived: result.monthsSurvived,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Server error (${res.status})` };
    }
    const entry = (await res.json()) as LeaderboardEntry;
    return { ok: true, entry };
  } catch {
    return { ok: false, error: 'Backend not reachable. Score saved locally only.' };
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/leaderboard`);
    if (!res.ok) return [];
    return (await res.json()) as LeaderboardEntry[];
  } catch {
    return [];
  }
}
