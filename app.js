/* Trade CFO Simulator — UI (vanilla JS). */
'use strict';
(function () {
  const el = document.querySelector('#view');
  const CFO = window.CFO;
  const money = CFO.money;
  const signedMoney = CFO.signedMoney;
  const pct = CFO.pct;
  const clamp0 = (n) => Math.max(0, Math.min(100, n));

  const SAVE_KEY = 'trade-cfo-v1';
  const TYPE_LABEL = { currency: 'Currency Risk', credit: 'Customer Credit', inventory: 'Inventory' };
  let G = null;
  let currentPage = 'Dashboard';
  let selections = {};

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.month && !s.gameOver) return s; }
    } catch (e) {}
    return null;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }

  const title = (name, desc, tag) =>
    `<div class="title"><div><span>TRADE CFO · MONTH ${G.month} / ${CFO.TOTAL_MONTHS}</span><h1>${name}</h1><p>${desc}</p></div><i class="status">● ${tag}</i></div>`;
  const metric = (l, v, s, w = '') => `<div class="metric ${w}"><label>${l}</label><b>${v}</b><small>${s}</small></div>`;

  function eventBanner() {
    if (!G.event) return '';
    const e = G.event, f = e.effects, fx = [];
    if (f.usdChange) fx.push(`USD ${f.usdChange > 0 ? '+' : ''}${pct(f.usdChange)}`);
    if (f.shipping) fx.push(`Shipping ${f.shipping > 0 ? '+' : ''}${f.shipping.toFixed(1)}×`);
    if (f.tariff) fx.push(`Tariff ${f.tariff > 0 ? '+' : ''}${pct(f.tariff)}`);
    if (f.demand) fx.push(`Demand ${f.demand > 0 ? '+' : ''}${f.demand}`);
    if (f.recession) fx.push(`Recession ${f.recession > 0 ? '+' : ''}${f.recession}`);
    if (f.interestSurcharge) fx.push(`Rates ${f.interestSurcharge > 0 ? '+' : ''}${pct(f.interestSurcharge)}`);
    if (f.costPressure) fx.push(`Costs ${f.costPressure > 0 ? '+' : ''}${pct(f.costPressure)}`);
    return `<div class="event ${e.impact === 'positive' ? 'good' : 'bad'}">
      <span class="badge">${e.cat}</span><b>${e.name}</b>
      <p>${e.desc}</p>
      ${fx.length ? `<div class="chips">${fx.map((x) => `<span>${x}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  function updateShell() {
    const r = CFO.risks(G);
    const hq = document.querySelector('#hdr-month');
    if (hq) hq.textContent = 'Month ' + G.month + ' of ' + CFO.TOTAL_MONTHS;
    const sr = document.querySelector('#side-rating');
    if (sr) sr.textContent = G.company.creditRating + ' · risk ' + G.company.riskScore;
    const sp = document.querySelector('#side-rep');
    if (sp) sp.textContent = 'Risk score ' + G.company.riskScore + '/100';
    const sb = document.querySelector('#side-bar');
    if (sb) sb.style.width = clamp0(G.company.riskScore) + '%';
    const sc = document.querySelector('#side-cash');
    if (sc) sc.textContent = 'Cash ' + money(G.company.cash) + ' · debt ' + money(G.company.debt);
  }

  function render() {
    updateShell();
    document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('active', x.dataset.page === currentPage));
    if (G.gameOver) { results(); return; }
    pages[currentPage]();
  }

  /* ---------- pages ---------- */
  function dashboard() {
    const r = CFO.risks(G);
    const c = G.company;
    const m = G.market;
    const last = G.lastResult;
    const advisors = CFO.generateAdvisorBoard(m);
    el.innerHTML = title('Company dashboard', 'Financial position, market conditions, and key risks.') +
      `<div class="metrics">${metric('Cash', money(c.cash), 'Available liquidity')}${metric('Revenue (last)', money(last ? last.revenue : c.monthlyRevenue), 'Capacity ' + money(c.monthlyRevenue) + '/mo')}${metric('Profit (last)', last ? signedMoney(last.profit) : '—', 'Cumulative ' + signedMoney(c.cumulativeProfit), c.cumulativeProfit < 0 ? 'warn' : '')}${metric('Debt', money(c.debt), 'Inventory ' + money(c.inventory))}</div>` +
      eventBanner() +
      `<div class="grid">
        <div class="card"><h2>Key risks</h2><p class="sub">Monthly risk indicators</p>
          <div class="risk-list">${[['FX risk', r.fx], ['Credit risk', r.credit], ['Supply chain', r.supply], ['Financing', r.financing]].map((x) => `<div><span>${x[0]}</span><div class="track"><i style="width:${x[1]}%;background:${x[1] > 60 ? '#dc764d' : '#46786b'}"></i></div><b>${x[1]}</b></div>`).join('')}</div></div>
        <div class="card"><h2>Advisor board</h2><p class="sub">Three AI advisors</p>
          ${advisors.map((a) => `<div class="lesson" style="margin-top:8px"><b>${a.advisor}</b><p>${a.message}</p></div>`).join('')}</div>
      </div>
      <div class="card"><h2>Company summary</h2>
        <table><tr><td>Credit rating</td><td><b>${c.creditRating}</b></td></tr><tr><td>Risk score</td><td><b>${c.riskScore}/100</b></td></tr><tr><td>Employees</td><td><b>${c.employees}</b></td></tr><tr><td>Markets</td><td><b>${c.markets.join(', ')}</b></td></tr><tr><td>Suppliers</td><td><b>${c.suppliers.join(', ')}</b></td></tr></table></div>`;
  }

  function decisionCard(d) {
    const rec = d.recommendation;
    return `<div class="card decision">
      <div class="d-head"><b>${d.title}</b><span class="badge">${TYPE_LABEL[d.type] || d.type}</span></div>
      <p class="d-desc">${d.description}</p>
      <div class="d-options">${d.options.map((o) => `<button class="d-option" data-decision="${d.id}" data-option="${o.id}"><b>${o.label}</b><span>${o.desc}</span></button>`).join('')}</div>
      <div class="rec"><i>${rec.advisor}</i><b>${rec.actionLabel}</b><span>${rec.confidence}% confidence — ${rec.reason}</span></div>
    </div>`;
  }

  function decisions() {
    selections = {};
    G.decisions.forEach((d) => (selections[d.id] = d.recommendation.optionId));
    el.innerHTML = title('Monthly decisions', 'Review the market, follow your advisors, then advance the month.') +
      eventBanner() +
      `<div class="decisions">${G.decisions.map(decisionCard).join('')}</div>` +
      `<div class="advance-bar"><button id="advance" class="primary">Advance month →</button></div>`;

    document.querySelectorAll('.d-option').forEach((btn) => {
      btn.onclick = () => {
        selections[btn.dataset.decision] = btn.dataset.option;
        btn.closest('.decision').querySelectorAll('.d-option').forEach((o) => o.classList.toggle('active', o.dataset.option === selections[btn.dataset.decision]));
      };
    });
    document.querySelectorAll('.decision').forEach((card) => {
      const did = card.querySelector('.d-option').dataset.decision;
      card.querySelectorAll('.d-option').forEach((o) => o.classList.toggle('active', o.dataset.option === selections[did]));
    });
    document.querySelector('#advance').onclick = () => {
      const choices = G.decisions.map((d) => ({ decisionId: d.id, optionId: selections[d.id] }));
      CFO.resolveChoices(G, choices);
      save();
      currentPage = 'Reports';
      render();
    };
  }

  function market() {
    const m = G.market;
    el.innerHTML = title('Market', 'Global market conditions for the month.') +
      `<div class="metrics">${metric('USD change', (m.usdChange > 0 ? '+' : '') + pct(m.usdChange), 'vs your home currency')}${metric('Shipping', m.shippingMultiplier.toFixed(1) + '×', 'Freight cost multiplier')}${metric('Import tariff', pct(m.tariffRate), 'On imported goods')}${metric('Demand index', Math.round(m.demandIndex) + '/100', 'Customer demand')}</div>` +
      `<div class="grid">
        <div class="card"><h2>Market indicators</h2><table>
          <tr><td>USD movement</td><td><b>${(m.usdChange > 0 ? '+' : '') + pct(m.usdChange)}</b></td></tr>
          <tr><td>Shipping costs</td><td><b>${m.shippingMultiplier.toFixed(2)}×</b></td></tr>
          <tr><td>Import tariff</td><td><b>${pct(m.tariffRate)}</b></td></tr>
          <tr><td>Demand index</td><td><b>${Math.round(m.demandIndex)}/100</b></td></tr>
          <tr><td>Recession risk</td><td><b>${Math.round(m.recessionRisk)}/100</b></td></tr>
        </table></div>
        <div class="card"><h2>Trading context</h2><table>
          <tr><td>Markets</td><td><b>${G.company.markets.join(', ')}</b></td></tr>
          <tr><td>Suppliers</td><td><b>${G.company.suppliers.join(', ')}</b></td></tr>
          <tr><td>Revenue capacity</td><td><b>${money(G.company.monthlyRevenue)}/mo</b></td></tr>
          <tr><td>Inventory</td><td><b>${money(G.company.inventory)}</b></td></tr>
        </table></div>
      </div>
      <div class="callout"><i>i</i><div><b>Market news</b><p>${G.news.map((n) => n.headline).join(' · ')}</p></div></div>`;
  }

  function financing() {
    const r = CFO.risks(G);
    const c = G.company;
    el.innerHTML = title('Financing', 'Capital structure, cost of money, and leverage.') +
      `<div class="metrics">${metric('Debt', money(c.debt), 'Total borrowings')}${metric('Interest / mo', money(c.debt * 0.005), 'At BBB base rate')}${metric('Credit rating', c.creditRating, 'Company credit')}${metric('Ownership', Math.round(c.ownership * 100) + '%', 'Shareholder stake')}</div>` +
      `<div class="grid">
        <div class="card"><h2>Balance sheet</h2><div class="progress">
          ${[['Cash', c.cash, clamp0(c.cash / Math.max(c.cash + c.inventory, 1) * 100)], ['Inventory', c.inventory, clamp0(c.inventory / Math.max(c.cash + c.inventory, 1) * 100)]].map((x) => `<div><span>${x[0]}</span><b>${money(x[1])}</b></div><div class="track"><i style="width:${x[2]}%"></i></div>`).join('')}
          </div></div>
        <div class="card"><h2>Leverage & rating</h2>
          <table><tr><td>Credit rating</td><td><b>${c.creditRating}</b></td></tr><tr><td>Financing risk</td><td><b>${r.financing}/100</b></td></tr><tr><td>Debt / assets</td><td><b>${(c.debt / Math.max(c.cash + c.inventory, 1) * 100).toFixed(0)}%</b></td></tr><tr><td>Risk score</td><td><b>${c.riskScore}/100</b></td></tr></table></div>
      </div>
      <div class="callout"><i>i</i><div><b>Cost of money</b><p>Interest is charged monthly at a rate tied to your credit rating, plus any market interest surcharges.</p></div></div>`;
  }

  function reports() {
    const last = G.lastResult;
    if (!last) { el.innerHTML = title('Performance report', 'Advance a month to see results.', 'NO DATA'); return; }
    const lessons = last.outcomes.map((o) => `<div class="lesson"><b>${o.title}</b><p>${o.detail}</p></div>`).join('');
    const bars = G.history.map((h) => {
      const hgt = clamp0((h.profit / 500000) * 100 + 50);
      return `<div class="pbar"><i style="height:${hgt}%;background:${h.profit >= 0 ? '#46786b' : '#dc764d'}"></i><span>M${h.month}</span></div>`;
    }).join('');
    const table = G.history.slice().reverse().map((h) => `<tr><td><b>M${h.month}</b></td><td>${money(h.revenue)}</td><td>${h.profit >= 0 ? '' : '-'}${money(Math.abs(h.profit))}</td><td>${money(h.cashAfter)}</td><td>${h.riskScore}</td><td>${h.creditRating}</td></tr>`).join('');
    el.innerHTML = title('Performance report', 'What happened this month, in plain language.') +
      `<div class="metrics">${metric('Revenue', money(last.revenue), 'This month')}${metric('Profit', signedMoney(last.profit), 'This month', last.profit < 0 ? 'warn' : '')}${metric('Cash', money(last.cashAfter), 'Ending balance')}${metric('Risk score', last.riskScore + '/100', last.creditRating + ' credit')}</div>` +
      `<div class="card"><h2>What happened</h2>${lessons || '<p class="sub">No events this month.</p>'}</div>` +
      `<div class="card"><h2>Monthly profit</h2><div class="profit-chart">${bars}</div></div>` +
      `<div class="card data-table"><h2>History</h2><table><thead><tr><th>Month</th><th>Revenue</th><th>Profit</th><th>Cash</th><th>Risk</th><th>Rating</th></tr></thead><tbody>${table}</tbody></table></div>`;
  }

  function results() {
    const s = G.finalScore;
    el.innerHTML = title(G.bankrupt ? 'Company bankrupt' : 'Simulation complete', 'Twelve months of trading leadership, scored.', 'FINAL') +
      `<div class="result-hero"><div class="score">${s.score}</div><div class="rank">${s.ranking}</div></div>` +
      `<div class="card"><h2>Score breakdown</h2>
        ${[['Cash growth', s.cashGrowth, '30%'], ['Profit growth', s.profitGrowth, '30%'], ['Risk management', s.riskManagement, '20%'], ['Credit rating', s.creditScore, '10%'], ['Survival', s.survival, '10%']].map((x) => `<div class="risk-list"><span>${x[0]} <b>${x[1]}/100 · ${x[2]}</b></span><div class="track"><i style="width:${x[1]}%"></i></div></div>`).join('')}
      </div>` +
      `<div class="metrics">${metric('Company value', money(s.finalCompanyValue), 'Cash + inventory − debt')}${metric('Total profit', signedMoney(s.totalProfit), 'Across 12 months')}${metric('Final cash', money(s.totalCash), 'Ending balance')}${metric('Credit rating', s.creditRating, 'Final')}</div>` +
      `<div class="advance-bar"><button class="primary" id="again">↻ Play again</button></div>`;
    document.querySelector('#again').onclick = () => newGame();
  }

  const pages = { Dashboard: dashboard, Decisions: decisions, Market: market, Financing: financing, Reports: reports };

  function newGame() {
    G = CFO.createGame(Math.floor(Math.random() * 0xffffffff));
    save();
    currentPage = 'Dashboard';
    render();
  }

  /* ---------- init ---------- */
  G = load() || CFO.createGame(Math.floor(Math.random() * 0xffffffff));
  save();

  document.querySelectorAll('nav button').forEach((b) => {
    b.onclick = () => { currentPage = b.dataset.page; render(); };
  });
  document.querySelector('.menu').onclick = () => document.querySelector('aside').classList.toggle('open');
  document.querySelector('#newgame').onclick = () => newGame();

  render();
})();
