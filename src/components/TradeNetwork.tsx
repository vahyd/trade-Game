import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useGameStore } from '../store/gameStore';
import { COMMODITIES } from '../engine/data';

export function TradeNetwork() {
  const state = useGameStore(s => s.state);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!state) return null;

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 700;
    const height = 500;

    const countries = Object.values(state.countries);
    const nodes = countries.map((c, i) => ({
      id: c.id,
      name: c.name,
      isHuman: c.isHuman,
    }));

    // Position nodes in a circle
    const angleStep = (2 * Math.PI) / nodes.length;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    nodes.forEach((n, i) => {
      (n as any).x = centerX + radius * Math.cos(i * angleStep - Math.PI / 2);
      (n as any).y = centerY + radius * Math.sin(i * angleStep - Math.PI / 2);
    });

    // Build links from trade history
    const links: { source: string; target: string; value: number; commodityId: string }[] = [];
    const tradeMap = new Map<string, number>();

    for (const round of state.roundHistory) {
      for (const trade of round.trades || []) {
        const key = `${trade.seller}-${trade.buyer}-${trade.commodityId}`;
        tradeMap.set(key, (tradeMap.get(key) || 0) + trade.quantity);
      }
    }

    const commodityColors: Record<string, string> = {
      oil: '#f59e0b', gas: '#3b82f6', wheat: '#eab308', food: '#22c55e',
      steel: '#6b7280', copper: '#f97316', electronics: '#8b5cf6', machinery: '#ef4444',
    };

    for (const [key, value] of tradeMap.entries()) {
      const [source, target, commodityId] = key.split('-');
      links.push({ source, target, value, commodityId });
    }

    // Draw links
    const linkGroup = svg.append('g');
    linkGroup.selectAll('line')
      .data(links.filter(l => l.value > 5))
      .enter()
      .append('line')
      .attr('x1', d => (nodes.find(n => n.id === d.source) as any)?.x ?? 0)
      .attr('y1', d => (nodes.find(n => n.id === d.source) as any)?.y ?? 0)
      .attr('x2', d => (nodes.find(n => n.id === d.target) as any)?.x ?? 0)
      .attr('y2', d => (nodes.find(n => n.id === d.target) as any)?.y ?? 0)
      .attr('stroke', d => commodityColors[d.commodityId] || '#94a3b8')
      .attr('stroke-width', d => Math.max(0.5, Math.min(8, d.value / 10)))
      .attr('stroke-opacity', 0.5)
      .attr('class', 'trade-link');

    // Draw nodes
    const nodeGroup = svg.append('g');
    nodeGroup.selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('cx', d => (d as any).x)
      .attr('cy', d => (d as any).y)
      .attr('r', d => d.isHuman ? 18 : 12)
      .attr('fill', d => d.isHuman ? '#34d399' : '#475569')
      .attr('stroke', d => d.isHuman ? '#6ee7b7' : '#64748b')
      .attr('stroke-width', 2)
      .attr('class', 'country-node');

    // Labels
    nodeGroup.selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('x', d => (d as any).x)
      .attr('y', d => (d as any).y + 24)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.isHuman ? '#6ee7b7' : '#94a3b8')
      .attr('font-size', 10)
      .text(d => d.name);

    // Legend
    const legend = svg.append('g')
      .attr('transform', 'translate(10, 10)');

    const legendItems = COMMODITIES.slice(0, 4);
    legendItems.forEach((c, i) => {
      const g = legend.append('g').attr('transform', `translate(0, ${i * 18})`);
      g.append('rect').attr('width', 12).attr('height', 12).attr('fill', commodityColors[c.id] || '#94a3b8').attr('rx', 2);
      g.append('text').attr('x', 16).attr('y', 10).attr('fill', '#94a3b8').attr('font-size', 10).text(c.name);
    });

  }, [state]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">🔗 Trade Network</h2>
      <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
        <svg ref={svgRef} width="100%" height="500" viewBox="0 0 700 500" preserveAspectRatio="xMidYMid meet" />
      </div>
      <p className="text-xs text-slate-500">
        Node size indicates player country (larger, green). Line thickness = trade volume. Colors = commodity categories.
      </p>
    </div>
  );
}
