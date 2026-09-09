import type { ReactNode } from 'react';
import type { CreditRating } from '../engine/types';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`}>
      {children}
    </div>
  );
}

export function ratingColor(rating: CreditRating): string {
  if (rating === 'AAA' || rating === 'AA') return 'text-emerald-400';
  if (rating === 'A' || rating === 'BBB') return 'text-lime-400';
  if (rating === 'BB' || rating === 'B') return 'text-amber-400';
  return 'text-rose-400';
}
