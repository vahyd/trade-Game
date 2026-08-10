import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';

export function ProductionScreen() {
  const state = useGameStore(s => s.state);
  if (!state) return null;

  const human = Object.values(state.countries).find(c => c.isHuman);
  if (!human) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">🏭 Production & Inventory</h2>

      {/* Production */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Production Capacity</h3>
        <div className="space-y-3">
          {human.production.map(prod => {
            const commodity = COMMODITIES.find(c => c.id === prod.commodityId);
            const cons = human.consumption.find(c => c.commodityId === prod.commodityId);
            const inv = human.inventory.find(i => i.commodityId === prod.commodityId);
            const utilization = prod.capacity > 0 ? (prod.production / prod.capacity) * 100 : 0;

            return (
              <div key={prod.commodityId} className="bg-slate-700/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{commodity?.name}</span>
                  <span className="text-xs text-slate-400">
                    Cost: ${prod.productionCost}/unit | Capacity: {prod.capacity}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-300 w-16 text-right">
                    {prod.production}/{prod.capacity}
                  </span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-400">
                  <span>Domestic need: {cons?.consumption ?? 0}</span>
                  <span>Inventory: {inv?.quantity ?? 0}</span>
                  <span>Surplus: {Math.max(0, prod.production - (cons?.consumption ?? 0))}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Strategic Inventory</h3>
        <div className="space-y-2">
          {human.inventory.map(inv => {
            const commodity = COMMODITIES.find(c => c.id === inv.commodityId);
            const cons = human.consumption.find(c => c.commodityId === inv.commodityId);
            const coverage = cons?.consumption ? (inv.quantity / cons.consumption * 3) : 0; // quarters of coverage
            const covColor = coverage > 3 ? 'text-emerald-400' : coverage > 1 ? 'text-yellow-400' : 'text-red-400';

            return (
              <div key={inv.commodityId} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
                <span className="text-white text-sm">{commodity?.name}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">Stock: <span className="text-white">{inv.quantity}</span></span>
                  <span className={covColor}>
                    {coverage.toFixed(1)} qtr coverage
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Import needs */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Import Requirements</h3>
        <div className="space-y-2">
          {human.consumption
            .filter(cons => {
              const prod = human.production.find(p => p.commodityId === cons.commodityId);
              return cons.consumption > (prod?.production ?? 0);
            })
            .map(cons => {
              const prod = human.production.find(p => p.commodityId === cons.commodityId);
              const deficit = cons.consumption - (prod?.production ?? 0);
              const commodity = COMMODITIES.find(c => c.id === cons.commodityId);
              const inv = human.inventory.find(i => i.commodityId === cons.commodityId);
              return (
                <div key={cons.commodityId} className="flex items-center justify-between bg-slate-700/30 rounded-lg px-3 py-2">
                  <span className="text-white text-sm">
                    {commodity?.name}
                    {cons.required && <span className="text-red-400 text-xs ml-1">*essential</span>}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-red-400">Need: {deficit}</span>
                    <span className="text-slate-400">Stock: {inv?.quantity ?? 0}</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
