import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';
import type { CountryId, CommodityId, TradeOrder } from '../engine/types';
import type { StrategicSuggestion } from '../engine/TraderAdvisor';

export function TradeScreen() {
  const state = useGameStore(s => s.state);
  const briefing = useGameStore(s => s.briefing);
  const addTradeOrder = useGameStore(s => s.addTradeOrder);

  const [selectedPartner, setSelectedPartner] = useState<CountryId | null>(null);
  const [commodityId, setCommodityId] = useState<CommodityId>('oil');
  const [quantity, setQuantity] = useState(20);
  const [price, setPrice] = useState(70);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<string>>(new Set());

  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const partner = selectedPartner ? state.countries[selectedPartner] : null;
  const selectedCommodity = state.commodities[commodityId];

  // Supply/demand balance for selected commodity
  const sdRatio = selectedCommodity && selectedCommodity.supply > 0
    ? selectedCommodity.demand / selectedCommodity.supply : 0;
  const sdStatus = sdRatio > 1.1 ? '🔴 Shortage' : sdRatio < 0.9 ? '🟢 Surplus' : '🟡 Balanced';
  const sdStatusColor = sdRatio > 1.1 ? 'text-red-400' : sdRatio < 0.9 ? 'text-emerald-400' : 'text-yellow-400';

  const countrySD = selectedCommodity ? Object.values(state.countries)
    .filter(c => {
      const p = c.production.find(pp => pp.commodityId === commodityId);
      const co = c.consumption.find(cc => cc.commodityId === commodityId);
      return (p?.production ?? 0) > 0 || (co?.consumption ?? 0) > 0;
    })
    .map(c => {
      const p = c.production.find(pp => pp.commodityId === commodityId);
      const co = c.consumption.find(cc => cc.commodityId === commodityId);
      return { name: c.name, supply: p?.production ?? 0, demand: co?.consumption ?? 0, isHuman: c.isHuman };
    })
    .sort((a, b) => b.supply - a.supply) : [];

  // Determine if export/import is possible for the selected commodity
  const myProd = human.production.find(p => p.commodityId === commodityId);
  const myCons = human.consumption.find(c => c.commodityId === commodityId);
  const myInv = human.inventory.find(i => i.commodityId === commodityId)?.quantity ?? 0;
  const mySurplus = (myProd?.production ?? 0) - (myCons?.consumption ?? 0);
  const myDeficit = (myCons?.consumption ?? 0) - (myProd?.production ?? 0);

  // Partner availability
  const partnerSurplus = partner ? (() => {
    const p = partner.production.find(pp => pp.commodityId === commodityId);
    const c = partner.consumption.find(cc => cc.commodityId === commodityId);
    return (p?.production ?? 0) - (c?.consumption ?? 0);
  })() : 0;

  const canExport = mySurplus > 0;
  const canImport = (partner && partnerSurplus > 0) || (!partner && myDeficit > 0);
  const exportHint = canExport
    ? `Export up to ${mySurplus} ${commodityId} at ${selectedCommodity?.currentGlobalPrice} GTU each`
    : `You have no surplus of ${commodityId}. Production: ${myProd?.production ?? 0}, Consumption: ${myCons?.consumption ?? 0}`;
  const importHint = canImport
    ? partner
      ? `${partner.name} has ${partnerSurplus} ${commodityId} available at ~${selectedCommodity?.currentGlobalPrice} GTU`
      : `Import ${commodityId} to cover deficit of ${myDeficit}`
    : partner
      ? `${partner.name} has no surplus of ${commodityId} to export`
      : `Select a partner with ${commodityId} surplus, or you are self-sufficient`;

  const handleTradeAction = (action: 'import' | 'export') => {
    const order: TradeOrder = {
      id: `player-${human.id}-${action}-${commodityId}-${Date.now()}`,
      countryId: human.id,
      commodityId,
      type: action === 'import' ? 'buy' : 'sell',
      quantity,
      price,
      currency: partner?.currency ?? 'GTU',
      counterparty: selectedPartner ?? undefined,
      contractType: 'spot',
    };
    addTradeOrder(order);
  };

  const handleAcceptSuggestion = (suggestion: StrategicSuggestion) => {
    if (suggestion.tradeOrder) {
      addTradeOrder(suggestion.tradeOrder);
      setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]));
    } else if (suggestion.commodityId && suggestion.partnerId) {
      const c = state.commodities[suggestion.commodityId];
      const order: TradeOrder = {
        id: `player-sug-${suggestion.id}-${Date.now()}`,
        countryId: human.id,
        commodityId: suggestion.commodityId,
        type: suggestion.type === 'export' ? 'sell' : 'buy',
        quantity: suggestion.quantity ?? 10,
        price: suggestion.price ?? (c?.currentGlobalPrice ?? 50),
        currency: state.countries[suggestion.partnerId]?.currency ?? 'GTU',
        counterparty: suggestion.partnerId,
        contractType: 'spot',
      };
      addTradeOrder(order);
      setAcceptedSuggestions(prev => new Set([...prev, suggestion.id]));
    }
  };

  const tradeInfo = partner ? (() => {
    const needs: { commodityId: string; importance: number }[] = [];
    const surplus: { commodityId: string; amount: number }[] = [];
    for (const cons of partner.consumption) {
      const prod = partner.production.find(p => p.commodityId === cons.commodityId);
      const net = cons.consumption - (prod?.production ?? 0);
      if (net > 0) needs.push({ commodityId: cons.commodityId, importance: cons.required ? 5 : 3 });
    }
    for (const prod of partner.production) {
      const cons = partner.consumption.find(c => c.commodityId === prod.commodityId);
      const net = prod.production - (cons?.consumption ?? 0);
      if (net > 0) surplus.push({ commodityId: prod.commodityId, amount: net });
    }
    return { needs, surplus };
  })() : null;

  const suggestions = briefing?.suggestions ?? [];
  const exportOpps = briefing?.exportOpportunities ?? [];
  const importNeeds = briefing?.importNeeds.filter(n => n.urgency !== 'low') ?? [];

  const priorityBadge: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-300',
    high: 'bg-amber-500/20 text-amber-300',
    medium: 'bg-blue-500/20 text-blue-300',
    low: 'bg-slate-500/20 text-slate-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-white">🤝 Trade</h2>
        <div className="flex gap-3 text-xs">
          <span className="text-slate-400">1 GTU = <span className="text-white">{human.currencyValue} {human.currency}</span></span>
          <span className={human.tradeBalance >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            Balance: {human.tradeBalance >= 0 ? '+' : ''}{human.tradeBalance.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: Agent Recommendations */}
        <div className="lg:col-span-1 space-y-3">
          {suggestions.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
              <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">🎯 Suggestions</h3>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {suggestions.map(s => {
                  const accepted = acceptedSuggestions.has(s.id);
                  return (
                    <div key={s.id} onClick={() => !accepted && handleAcceptSuggestion(s)}
                      className={`rounded-lg border p-2 text-xs transition ${accepted
                        ? 'border-emerald-500/30 bg-emerald-500/5 opacity-50'
                        : s.priority === 'critical' ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10 cursor-pointer'
                        : s.priority === 'high' ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer'
                        : 'border-slate-700/50 bg-slate-700/20 hover:bg-slate-700/30 cursor-pointer'}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-medium text-white">{s.title}</span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${priorityBadge[s.priority] ?? ''}`}>{s.priority}</span>
                      </div>
                      <p className="text-slate-400">{s.description}</p>
                      {!accepted && <span className="text-emerald-400 text-[10px] mt-1 block">Click to accept →</span>}
                      {accepted && <span className="text-emerald-400/60 text-[10px]">✓ Done</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {exportOpps.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
              <h3 className="text-xs font-bold text-emerald-400 uppercase mb-2">📤 Export Opps</h3>
              {exportOpps.map(opp => (
                <div key={opp.commodityId} className="bg-slate-700/30 rounded-lg p-2 mb-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-medium">{opp.commodityName}</span>
                    <span className="text-emerald-400">{opp.profitMargin.toFixed(0)}% margin</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Surplus {opp.surplus} · Cost ${opp.productionCost} · Price ${opp.globalPrice}</div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{opp.reasoning}</p>
                  {opp.suggestedBuyers.length > 0 && (
                    <div className="text-[10px] text-slate-500">Buyers: {opp.suggestedBuyers.slice(0, 3).map(b => b.name).join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {importNeeds.length > 0 && (
            <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
              <h3 className="text-xs font-bold text-red-400 uppercase mb-2">📥 Import Needs</h3>
              {importNeeds.map(need => (
                <div key={need.commodityId} className="bg-slate-700/30 rounded-lg p-2 mb-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white font-medium">{need.commodityName}{need.isEssential && <span className="text-red-400">*</span>}</span>
                    <span className="text-slate-400">{need.inventoryCoverage.toFixed(1)}q stock</span>
                  </div>
                  <div className="text-[10px] text-slate-400">Need {need.deficit} · Stock {need.inventoryLevel}</div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{need.reasoning}</p>
                  {need.suggestedSuppliers[0] && (
                    <div className="text-[10px] text-slate-500">Best: {need.suggestedSuppliers[0].name} @ {need.suggestedSuppliers[0].landedCost} GTU</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Trade Form + S/D Balance */}
        <div className="lg:col-span-2 space-y-4">
          {/* Combined Partner + Trade Form — always visible */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <div className="mb-3">
              <h3 className="text-xs font-medium text-slate-400 mb-1.5">Trading Partner</h3>
              <div className="flex flex-wrap gap-1">
                {Object.values(state.countries).filter(c => !c.isHuman).map(c => (
                  <button key={c.id} onClick={() => setSelectedPartner(c.id as CountryId)}
                    className={`px-2.5 py-1 rounded text-[11px] transition ${selectedPartner === c.id ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    {c.name} ({c.currency})
                  </button>
                ))}
              </div>
            </div>
            {partner && (
              <div className="mb-3 text-[11px] text-slate-400 border-t border-slate-700 pt-2">
                {partner.name}: 1 GTU = {partner.currencyValue} {partner.currency} ·
                Needs: {tradeInfo?.needs.map(n => COMMODITIES.find(c => c.id === n.commodityId)?.name).join(', ') || 'none'} ·
                Surplus: {tradeInfo?.surplus.map(s => COMMODITIES.find(c => c.id === s.commodityId)?.name).join(', ') || 'none'}
              </div>
            )}
            <div className="border-t border-slate-700 pt-3">
              <h3 className="text-xs font-medium text-slate-400 mb-2">Place Order</h3>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Commodity</label>
                  <select value={commodityId}
                    onChange={e => { setCommodityId(e.target.value as CommodityId); const c = state.commodities[e.target.value]; if (c) setPrice(c.currentGlobalPrice); }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-xs">
                    {COMMODITIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Quantity</label>
                  <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min={1}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Price (GTU)</label>
                  <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1.5 text-white text-xs" />
                </div>
                <div className="flex items-end gap-1">
                  <button onClick={() => handleTradeAction('export')}
                    disabled={!canExport}
                    title={exportHint}
                    className={`flex-1 py-1.5 rounded-lg font-medium text-xs text-white transition ${
                      canExport ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}>
                    📤 Export
                  </button>
                  <button onClick={() => handleTradeAction('import')}
                    disabled={!canImport}
                    title={importHint}
                    className={`flex-1 py-1.5 rounded-lg font-medium text-xs text-white transition ${
                      canImport ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}>
                    📥 Import
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 📊 Commodity Basket — all supply/demand at a glance */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-300 mb-3">📊 Commodity Basket — Supply vs Demand</h3>
            <div className="space-y-2">
              {COMMODITIES.map(c => {
                const cm = state.commodities[c.id];
                if (!cm) return null;
                const r = cm.supply > 0 ? cm.demand / cm.supply : 0;
                const st = r > 1.1 ? '🔴' : r < 0.9 ? '🟢' : '🟡';
                const maxVal = Math.max(cm.supply, cm.demand, 1);
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-20 truncate">{c.name}</span>
                    <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden flex">
                      <div className="bg-emerald-500/70 h-full flex items-center justify-center text-[8px] text-white font-medium"
                        style={{ width: `${Math.max(2, (cm.supply / maxVal) * 100)}%` }}>
                        {cm.supply.toFixed(0)}
                      </div>
                      <div className="bg-red-500/70 h-full flex items-center justify-center text-[8px] text-white font-medium"
                        style={{ width: `${Math.max(2, (cm.demand / maxVal) * 100)}%` }}>
                        {cm.demand.toFixed(0)}
                      </div>
                    </div>
                    <span className="text-[10px] w-5 text-center">{st}</span>
                    <span className="text-[10px] text-slate-500 w-12 text-right">{r.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supply/Demand detail for selected commodity */}
          {selectedCommodity && (
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-medium text-slate-300 mb-3">
                📊 {COMMODITIES.find(c => c.id === commodityId)?.name} — Supply & Demand
                <span className={`ml-2 text-xs ${sdStatusColor}`}>{sdStatus}</span>
                <span className="ml-2 text-xs text-slate-500">Ratio: {sdRatio.toFixed(2)}</span>
              </h3>

              {/* Global bar */}
              <div className="mb-3">
                <div className="text-[10px] text-slate-500 mb-1">Global Balance</div>
                <div className="bg-slate-700 rounded-full h-4 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full flex items-center justify-center text-[9px] text-white font-medium transition-all"
                    style={{ width: `${Math.max(5, (selectedCommodity.supply / Math.max(selectedCommodity.supply, selectedCommodity.demand)) * 100)}%` }}>
                    S: {selectedCommodity.supply.toFixed(0)}
                  </div>
                  <div className="bg-red-500 h-full flex items-center justify-center text-[9px] text-white font-medium transition-all"
                    style={{ width: `${Math.max(5, (selectedCommodity.demand / Math.max(selectedCommodity.supply, selectedCommodity.demand)) * 100)}%` }}>
                    D: {selectedCommodity.demand.toFixed(0)}
                  </div>
                </div>
              </div>

              {/* Per-country */}
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 mb-1">By Country</div>
                {countrySD.map(c => (
                  <div key={c.name} className={`flex items-center gap-2 text-[10px] ${c.isHuman ? 'bg-emerald-500/5 rounded px-1 -mx-1 py-0.5' : ''}`}>
                    <span className={`w-20 truncate ${c.isHuman ? 'text-emerald-400 font-medium' : 'text-slate-300'}`}>
                      {c.name}{c.isHuman ? ' (You)' : ''}
                    </span>
                    <div className="flex-1 bg-slate-700 rounded-full h-2.5 overflow-hidden flex">
                      <div className="bg-emerald-500/70 h-full transition-all"
                        style={{ width: `${c.supply > 0 ? Math.max(3, (c.supply / Math.max(c.supply, c.demand, 1)) * 100) : 0}%` }} />
                      <div className="bg-red-500/70 h-full transition-all"
                        style={{ width: `${c.demand > 0 ? Math.max(3, (c.demand / Math.max(c.supply, c.demand, 1)) * 100) : 0}%` }} />
                    </div>
                    <span className="text-emerald-400 w-7 text-right">{c.supply > 0 ? c.supply : ''}</span>
                    <span className="text-red-400 w-7 text-right">{c.demand > 0 ? c.demand : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Orders */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              My Orders ({state.tradeOrders.filter(o => o.countryId === human.id).length})
            </h3>
            {state.tradeOrders.filter(o => o.countryId === human.id).length === 0 ? (
              <p className="text-xs text-slate-500">No orders yet. Use the form above or click suggestions → then END QUARTER.</p>
            ) : (
              <div className="space-y-1">
                {state.tradeOrders.filter(o => o.countryId === human.id).map((order, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-1.5 text-xs">
                    <span className="text-white">
                      {order.type === 'sell' ? '📤 Sell' : '📥 Buy'} {order.quantity} {order.commodityId}
                    </span>
                    <span className="text-slate-400">@ {order.price} GTU → {order.counterparty || 'open market'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
