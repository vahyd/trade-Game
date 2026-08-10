import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';
import type { StrategicSuggestion } from '../engine/TraderAdvisor';
import type { ExportOpportunity } from '../engine/ExportAgent';
import type { ImportNeed } from '../engine/ImportAgent';
import type { TradeOrder } from '../engine/types';

export function ConversationalPanel() {
  const state = useGameStore(s => s.state);
  const briefing = useGameStore(s => s.briefing);
  const addTradeOrder = useGameStore(s => s.addTradeOrder);
  const executeRound = useGameStore(s => s.executeRound);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set());

  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const handleAcceptSuggestion = (suggestion: StrategicSuggestion) => {
    if (suggestion.tradeOrder) {
      addTradeOrder(suggestion.tradeOrder);
      setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]));
    }
  };

  const priorityColors: Record<string, string> = {
    critical: 'border-red-500 bg-red-500/10',
    high: 'border-amber-500 bg-amber-500/10',
    medium: 'border-blue-500 bg-blue-500/10',
    low: 'border-slate-500 bg-slate-500/5',
  };

  const priorityBadges: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300',
    high: 'bg-amber-500/20 text-amber-300',
    medium: 'bg-blue-500/20 text-blue-300',
    low: 'bg-slate-500/20 text-slate-300',
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Stats Bar */}
      <div className="grid grid-cols-4 gap-2 mb-3 shrink-0">
        <MiniStat label="Round" value={`${state.round}/${state.config.rounds}`} />
        <MiniStat label="GDP" value={`$${human.gdp.toFixed(0)}B`} />
        <MiniStat label="Reserves" value={`$${human.fxReserves.toFixed(0)}B`} color={human.fxReserves < 100 ? 'text-red-400' : 'text-emerald-400'} />
        <MiniStat label="Score" value={`${human.economicScore}`} color="text-yellow-400" />
      </div>

      {/* Shocks */}
      {state.activeShocks.length > 0 && (
        <div className="space-y-1 mb-3 shrink-0">
          {state.activeShocks.map(s => (
            <div key={s.id} className="text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 text-red-300">
              🔴 <span className="font-medium">{s.name}</span> — {s.description} ({s.effects.duration}r)
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* LEFT: Conversation / Market Report */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {briefing ? (
            <>
              {/* Round Headline */}
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                <h3 className="text-sm font-bold text-white">{briefing.headline}</h3>
                <p className="text-xs text-slate-400 mt-1">{briefing.summary}</p>
              </div>

              {/* Currency Outlook */}
              <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50">
                <h4 className="text-xs font-medium text-slate-400 mb-1">💱 Currency Outlook</h4>
                <p className="text-xs text-slate-300">{briefing.currencyOutlook}</p>
              </div>

              {/* Export Opportunities */}
              {briefing.exportOpportunities.length > 0 && (
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50">
                  <h4 className="text-xs font-medium text-emerald-400 mb-2">📤 Export Opportunities</h4>
                  {briefing.exportOpportunities.map(opp => (
                    <ExportCard key={opp.commodityId} opp={opp} />
                  ))}
                </div>
              )}

              {/* Import Needs */}
              {briefing.importNeeds.filter(n => n.urgency !== 'low').length > 0 && (
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50">
                  <h4 className="text-xs font-medium text-red-400 mb-2">📥 Import Requirements</h4>
                  {briefing.importNeeds.filter(n => n.urgency !== 'low').map(need => (
                    <ImportCard key={need.commodityId} need={need} />
                  ))}
                </div>
              )}

              {/* Critical Alerts */}
              {briefing.criticalAlerts.length > 0 && (
                <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/30">
                  {briefing.criticalAlerts.map((a, i) => (
                    <p key={i} className="text-xs text-red-300">⚠ {a}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-slate-500 py-12">
              <p className="text-lg mb-2">📊</p>
              <p className="text-sm">Your trade advisor is ready.</p>
              <p className="text-xs mt-1">Press <span className="text-emerald-400 font-bold">END QUARTER</span> to receive the first market briefing.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Strategic Suggestions */}
        <div className="w-80 shrink-0 overflow-y-auto space-y-2 pr-1">
          <h4 className="text-xs font-bold text-slate-400 uppercase sticky top-0 bg-slate-900 py-1">
            🎯 Recommended Actions
          </h4>

          {briefing && briefing.suggestions.length > 0 ? (
            briefing.suggestions.map(s => {
              const accepted = acceptedSuggestions.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-3 cursor-pointer transition-all ${
                    accepted
                      ? 'border-emerald-500/50 bg-emerald-500/10 opacity-60'
                      : priorityColors[s.priority] + ' hover:border-opacity-80'
                  } ${expandedSuggestion === s.id ? 'ring-1 ring-white/20' : ''}`}
                  onClick={() => setExpandedSuggestion(expandedSuggestion === s.id ? null : s.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white leading-tight">{s.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityBadges[s.priority]}`}>
                      {s.priority}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-1">{s.description}</p>

                  {expandedSuggestion === s.id && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 italic mb-2">"{s.reasoning}"</p>
                      {s.tradeOrder && !accepted && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAcceptSuggestion(s); }}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-1.5 rounded-lg font-medium transition"
                        >
                          ✅ {s.action}
                        </button>
                      )}
                      {accepted && (
                        <span className="text-xs text-emerald-400">✓ Order placed</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">
              {briefing ? 'No urgent actions needed.' : 'Suggestions appear after the first quarter.'}
            </p>
          )}
        </div>
      </div>

      {/* Bottom: Quick actions */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-700/50 shrink-0">
        <div className="flex gap-2 text-xs text-slate-400">
          <span>1 GTU = {human.currencyValue} {human.currency}</span>
          <span>|</span>
          <span className={human.tradeBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            Trade: {human.tradeBalance >= 0 ? '+' : ''}{human.tradeBalance.toFixed(1)}
          </span>
          <span>|</span>
          <span>Inf: {human.inflation.toFixed(1)}%</span>
        </div>
        <button
          onClick={executeRound}
          disabled={state.gameOver}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-1.5 rounded-lg font-bold text-sm transition"
        >
          END QUARTER ▶
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700/50">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}

function ExportCard({ opp }: { opp: ExportOpportunity }) {
  const colorMap: Record<ExportOpportunity['priority'], string> = { high: 'text-emerald-400', medium: 'text-yellow-400', low: 'text-slate-400' };
  return (
    <div className="bg-slate-700/30 rounded-lg p-2 mb-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white">{opp.commodityName}</span>
        <span className={`text-xs ${colorMap[opp.priority]}`}>{opp.priority}</span>
      </div>
      <div className="flex gap-3 text-[11px] text-slate-400 mt-1">
        <span>Surplus: {opp.surplus}</span>
        <span>Cost: ${opp.productionCost}</span>
        <span>Price: ${opp.globalPrice}</span>
        <span className={opp.profitMargin > 20 ? 'text-emerald-400' : ''}>Margin: {opp.profitMargin}%</span>
      </div>
      {opp.suggestedBuyers.length > 0 && (
        <div className="text-[11px] text-slate-500 mt-1">
          Buyers: {opp.suggestedBuyers.map((b: { name: string }) => b.name).join(', ')}
        </div>
      )}
    </div>
  );
}

function ImportCard({ need }: { need: ImportNeed }) {
  const urgencyMap: Record<string, string> = {
    critical: 'text-red-400',
    high: 'text-amber-400',
    moderate: 'text-blue-400',
    low: 'text-slate-400',
  };
  return (
    <div className="bg-slate-700/30 rounded-lg p-2 mb-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white">
          {need.commodityName}
          {need.isEssential && <span className="text-red-400 ml-1">*</span>}
        </span>
        <span className={`text-xs ${urgencyMap[need.urgency]}`}>{need.urgency}</span>
      </div>
      <div className="flex gap-3 text-[11px] text-slate-400 mt-1">
        <span>Need: {need.deficit}</span>
        <span>Stock: {need.inventoryLevel} ({need.inventoryCoverage}q)</span>
      </div>
      {need.suggestedSuppliers.length > 0 && (
        <div className="text-[11px] text-slate-500 mt-1">
          Best: {need.suggestedSuppliers[0].name} @ {need.suggestedSuppliers[0].landedCost} GTU
          {need.suggestedSuppliers[0].risk !== 'low' && (
            <span className="text-amber-400 ml-1">• {need.suggestedSuppliers[0].risk} risk</span>
          )}
        </div>
      )}
    </div>
  );
}
