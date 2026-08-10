import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';
import type { CountryId, CommodityId, ContractType } from '../engine/types';

export function ContractsScreen() {
  const state = useGameStore(s => s.state);
  const createContract = useGameStore(s => s.createContract);

  const [seller, setSeller] = useState<CountryId>('');
  const [buyer, setBuyer] = useState<CountryId>('');
  const [commodityId, setCommodityId] = useState<CommodityId>('oil');
  const [quantity, setQuantity] = useState(20);
  const [price, setPrice] = useState(70);
  const [currency, setCurrency] = useState('GTU');
  const [contractType, setContractType] = useState<ContractType>('fixed');
  const [rounds, setRounds] = useState(4);

  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  const handleCreate = () => {
    if (!seller || !buyer) return;
    createContract(seller, buyer, commodityId, quantity, price, currency, contractType, rounds);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">📜 Trade Contracts</h2>

      {/* Create Contract */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">New Contract</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Seller</label>
            <select value={seller} onChange={e => setSeller(e.target.value as CountryId)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
              <option value="">Select...</option>
              {Object.values(state.countries).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Buyer</label>
            <select value={buyer} onChange={e => setBuyer(e.target.value as CountryId)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
              <option value="">Select...</option>
              {Object.values(state.countries).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Commodity</label>
            <select value={commodityId} onChange={e => { setCommodityId(e.target.value as CommodityId); const c = state.commodities[e.target.value]; if (c) setPrice(c.currentGlobalPrice); }} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
              {COMMODITIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Type</label>
            <select value={contractType} onChange={e => setContractType(e.target.value as ContractType)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
              <option value="spot">Spot Purchase</option>
              <option value="fixed">Fixed Contract</option>
              <option value="long-term">Long-Term Supply</option>
              <option value="stockpile">Strategic Stockpile</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} min={1} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Price (GTU)</label>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
              <option value="GTU">GTU (Global)</option>
              {Object.values(state.countries).map(c => (
                <option key={c.id} value={c.currency}>{c.currency}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Duration (rounds)</label>
            <input type="number" value={rounds} onChange={e => setRounds(Number(e.target.value))} min={1} max={12} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
        </div>
        <button onClick={handleCreate} className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium text-sm transition">
          Create Contract
        </button>
      </div>

      {/* Active Contracts */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Active Contracts ({state.activeContracts.length})</h3>
        {state.activeContracts.length === 0 ? (
          <p className="text-sm text-slate-500">No active contracts.</p>
        ) : (
          <div className="space-y-2">
            {state.activeContracts.map(c => {
              const s = state.countries[c.seller];
              const b = state.countries[c.buyer];
              return (
                <div key={c.id} className="bg-slate-700/30 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                  <span className="text-white">
                    {s?.name} → {b?.name}: {c.quantity} {c.commodityId} @ {c.price} {c.currency}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-400">{c.type}</span>
                    <span className={`text-xs ${c.roundsRemaining <= 1 ? 'text-red-400' : 'text-slate-400'}`}>
                      {c.roundsRemaining} rounds left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
