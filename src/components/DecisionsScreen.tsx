import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Decision, PlayerChoice } from '../engine/types';
import { generateAdvisorBoard } from '../engine/advisors';
import { Card } from './ui';
import { formatMoney } from '../format';

const CATEGORY_LABEL: Record<Decision['category'], string> = {
  currency: 'Currency Risk',
  credit: 'Customer Credit',
  financing: 'Financing',
  inventory: 'Inventory',
};

function impactColor(impact: string): string {
  if (impact === 'positive') return 'text-emerald-400';
  if (impact === 'negative') return 'text-rose-400';
  return 'text-slate-400';
}

export function DecisionsScreen({ onSubmitted }: { onSubmitted: () => void }) {
  const game = useGameStore((s) => s.game)!;
  const submitChoices = useGameStore((s) => s.submitChoices);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const decisions = game.decisions;
  const advisors = generateAdvisorBoard(game.company, game.market);
  const allSelected = decisions.every((d) => selections[d.id]);

  function follow(d: Decision) {
    setSelections((prev) => ({ ...prev, [d.id]: d.recommendation.optionId }));
  }

  function submit() {
    const choices: PlayerChoice[] = decisions.map((d) => ({
      decisionId: d.id,
      optionId: selections[d.id],
      followedRecommendation: selections[d.id] === d.recommendation.optionId,
    }));
    submitChoices(choices);
    onSubmitted();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Advisors</div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {advisors.map((a) => (
            <div key={a.advisor} className="text-sm">
              <span className="font-semibold text-slate-200">{a.advisor}: </span>
              <span className="text-slate-400">{a.message}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Market News</div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {game.news.map((n) => (
            <span key={n.id} className={`text-sm ${impactColor(n.impact)}`}>
              {n.headline}
            </span>
          ))}
        </div>
      </div>

      {decisions.map((d) => {
        const selected = selections[d.id];
        const rec = d.recommendation;
        const followed = selected === rec.optionId;
        return (
          <Card key={d.id} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                  {CATEGORY_LABEL[d.category]}
                </div>
                <h3 className="mt-1 text-base font-semibold text-slate-100">{d.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{d.description}</p>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              {d.insights.map((ins) => (
                <div key={ins.advisor} className="text-xs text-slate-500">
                  <span className="font-medium text-slate-400">{ins.advisor}:</span> {ins.message}
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {d.options.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                    selected === opt.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={d.id}
                    checked={selected === opt.id}
                    onChange={() => setSelections((prev) => ({ ...prev, [d.id]: opt.id }))}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-100">{opt.label}</span>
                    <span className="block text-xs text-slate-400">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-sky-800/60 bg-sky-900/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold text-sky-300">
                    Recommendation · {rec.confidence}% confidence:
                  </span>{' '}
                  <span className="text-slate-200">{rec.actionLabel}</span>
                  <span className="block text-xs text-slate-400">Reason: {rec.reason}</span>
                </div>
                <button
                  onClick={() => follow(d)}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
                >
                  {followed ? 'Following ✓' : 'Follow recommendation'}
                </button>
              </div>
            </div>
          </Card>
        );
      })}

      <button
        onClick={submit}
        disabled={!allSelected}
        className={`w-full rounded-lg px-6 py-3 text-sm font-semibold transition ${
          allSelected
            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            : 'cursor-not-allowed bg-slate-800 text-slate-500'
        }`}
      >
        {allSelected ? 'Submit decisions →' : 'Select an option for every decision'}
      </button>
    </div>
  );
}
