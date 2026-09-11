/* Trade CFO Simulator — UI (vanilla JS). */
'use strict';
(function () {
  const el = document.querySelector('#view');
  const CFO = window.CFO;
  const money = CFO.money;
  const signedMoney = CFO.signedMoney;
  const pct = CFO.pct;
  const clamp0 = (n) => Math.max(0, Math.min(100, n));

  const SAVE_KEY = 'trade-cfo-agents-v5';
  let G = null;
  let currentPage = 'Decisions';
  let choices = { export: {}, import: {}, finance: { A: { cash: 34, debt: 33, factoring: 33 } }, trades: [] };

  const SHARE_KEYS = ['cash', 'debt', 'factoring'];
  function normalizeA(raw) {
    raw = raw || {};
    let v = SHARE_KEYS.map((k) => clamp0(raw[k] || 0));
    const sum = v.reduce((a, b) => a + b, 0) || 100;
    v = v.map((x) => Math.round((x / sum) * 100));
    const diff = 100 - v.reduce((a, b) => a + b, 0);
    if (diff !== 0) v[v.indexOf(Math.max(...v))] += diff;
    return { cash: v[0], debt: v[1], factoring: v[2] };
  }
  // Move one financing share while keeping the three shares summing to 100%.
  function setShare(key, value) {
    const A = choices.finance.A;
    const delta = value - A[key];
    const others = SHARE_KEYS.filter((k) => k !== key);
    let rem = -delta;
    const otherSum = others.reduce((s, k) => s + A[k], 0);
    if (otherSum > 0) {
      others.forEach((k, i) => {
        const take = i === others.length - 1 ? rem : Math.round(rem * (A[k] / otherSum));
        A[k] = clamp0(A[k] + take);
        rem -= take;
      });
    } else {
      A[others[0]] = clamp0(A[others[0]] + rem);
    }
    A[key] = clamp0(value);
    choices.finance.A = normalizeA(A);
  }

  function cloneSel(s) { return JSON.parse(JSON.stringify(s)); }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const s = JSON.parse(raw); if (s && s.month && s.agentActions && s.phase !== 'results') return s; }
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
    if (G.phase === 'results') { results(); return; }
    pages[currentPage]();
  }

  /* ---------- pages ---------- */
  function agentHead(ag) {
    return `<div class="agent-col-head"><b>${ag.name}</b><small>${ag.objective}</small></div><p class="agent-col-sum">${ag.inputs.join(' · ')}</p>`;
  }

  function agentGroup(agentKey, action) {
    const opts = action.options.map((op) => {
      const sel = op.id === action.selectedId;
      const rec = op.id === action.recommendedId;
      return `<button class="agent-action${rec ? ' recommended' : ''}${sel ? ' selected' : ''}" data-agent="${agentKey}" data-key="${action.key}" data-opt="${op.id}"><b>${op.label}</b>${rec ? '<i>Rec</i>' : ''}</button>`;
    }).join('');
    return `<div class="agent-group"><div class="group-label">${action.label}</div><div class="agent-options">${opts}</div></div>`;
  }

  function exportColumn(ag) {
    return `<div class="agent-col" data-key="export">${agentHead(ag)}${ag.actions.map((a) => agentGroup('export', a)).join('')}</div>`;
  }

  function importColumn(ag) {
    return `<div class="agent-col" data-key="import">${agentHead(ag)}${ag.actions.map((a) => agentGroup('import', a)).join('')}</div>`;
  }

  function financeColumn(ag) {
    const plan = ag.plan;
    const A = ag.shares;
    const sources = [
      { key: 'cash', label: 'Cash', amount: plan.cashAmount, rate: plan.cashRate },
      { key: 'debt', label: 'Debt', amount: plan.debtAmount, rate: plan.debtRate },
      { key: 'factoring', label: 'Factoring', amount: plan.factoringAmount, rate: plan.factoringRate },
    ];
    const sliders = sources.map((s) => `
      <div class="slider-row">
        <div class="slider-labels"><span>${s.label}</span><span class="slider-pct">${A[s.key]}%</span></div>
        <input type="range" class="agent-slider" data-key="${s.key}" min="0" max="100" step="1" value="${A[s.key]}">
        <div class="slider-meta"><span class="slider-val">${money(s.amount)}</span><span class="slider-rec">${(s.rate * 100).toFixed(2)}%/mo</span></div>
      </div>`).join('');
    const total = plan.cashAmount + plan.debtAmount + plan.factoringAmount;
    return `<div class="agent-col" data-key="finance">${agentHead(ag)}
      <div class="slider-wrap">${sliders}<div class="mix-total">Total financing <b>${money(total)}</b></div></div>
      ${ag.actions.map((a) => agentGroup('finance', a)).join('')}
    </div>`;
  }

  function coordinatorPanel(scenarios, activeId) {
    const opts = scenarios.map((s) => {
      const active = s.id === activeId;
      return `<button class="scenario${active ? ' active' : ''}" data-scenario="${s.id}"><b>${s.label}</b><span>${signedMoney(s.profit)}</span><small>Risk ${s.risk}/100</small></button>`;
    }).join('');
    return `<div class="card coordinator"><h2>Trade Strategy Coordinator</h2><p class="sub">Risk-adjusted profit = Revenue − Procurement − Financing − Risk cost. Pick a scenario.</p><div class="scenario-list">${opts}</div></div>`;
  }

  function recap() {
    const last = G.lastResult;
    if (!last) return '';
    const lessons = last.outcomes.map((o) => `<div class="lesson"><b>${o.title}</b><p>${o.detail}</p></div>`).join('');
    const bars = G.history.map((h) => {
      const hgt = clamp0((h.profit / 500000) * 100 + 50);
      return `<div class="pbar"><i style="height:${hgt}%;background:${h.profit >= 0 ? '#46786b' : '#dc764d'}"></i><span>M${h.month}</span></div>`;
    }).join('');
    return `<div class="card recap"><h2>Last month — M${last.month} results</h2>
      <div class="metrics">${metric('Revenue', money(last.revenue), 'Month ' + last.month)}${metric('Profit', signedMoney(last.profit), 'This month', last.profit < 0 ? 'warn' : '')}${metric('Cash', money(last.cashAfter), 'Ending balance')}${metric('Risk', last.riskScore + '/100', last.creditRating + ' credit')}</div>
      ${lessons}
    </div>
    <div class="card"><h2>Monthly profit</h2><div class="profit-chart">${bars}</div></div>`;
  }

  function decisions() {
    const init = CFO.buildDecision(G, null);
    choices = cloneSel(init.scenarios.find((s) => s.id === 'rec').selections);
    let scenarioId = 'rec';

    function renderDecisions() {
      const dec = CFO.buildDecision(G, choices);
      choices.trades = dec.trades;
      const r = CFO.risks(G);
      const c = G.company;
      const last = G.lastResult;
      el.innerHTML =
        title('Decisions', 'Optimize exports, imports and financing — then pick the coordinator strategy.', '3 AGENTS + COORDINATOR') +
        `<div class="metrics">${metric('Cash', money(c.cash), 'Available liquidity')}${metric('Revenue (last)', money(last ? last.revenue : c.monthlyRevenue), 'Capacity ' + money(c.monthlyRevenue) + '/mo')}${metric('Profit (last)', last ? signedMoney(last.profit) : '—', 'Cumulative ' + signedMoney(c.cumulativeProfit), c.cumulativeProfit < 0 ? 'warn' : '')}${metric('Debt', money(c.debt), 'Inventory ' + money(c.inventory))}</div>` +
        `<div class="card"><h2>Key risks</h2>
          <div class="risk-list">${[['FX risk', r.fx], ['Credit risk', r.credit], ['Supply chain', r.supply], ['Financing', r.financing]].map((x) => `<div><span>${x[0]}</span><div class="track"><i style="width:${x[1]}%;background:${x[1] > 60 ? '#dc764d' : '#46786b'}"></i></div><b>${x[1]}</b></div>`).join('')}</div>
        </div>` +
        `<div class="agent-cols">${exportColumn(dec.agents.export)}${importColumn(dec.agents.import)}${financeColumn(dec.agents.finance)}</div>` +
        coordinatorPanel(dec.scenarios, scenarioId) +
        portfolioChartColumn() +
        eventBanner() +
        `<div class="advance-bar"><button id="advance" class="primary">Advance month →</button></div>` +
        recap();

      document.querySelectorAll('.agent-slider').forEach((slider) => {
        slider.oninput = () => {
          setShare(slider.dataset.key, Number(slider.value));
          scenarioId = 'current';
          renderDecisions();
        };
      });
      document.querySelectorAll('.agent-action[data-agent]').forEach((btn) => {
        btn.onclick = () => {
          choices[btn.dataset.agent][btn.dataset.key] = btn.dataset.opt;
          scenarioId = 'current';
          renderDecisions();
        };
      });
      document.querySelectorAll('.scenario').forEach((btn) => {
        btn.onclick = () => {
          const id = btn.dataset.scenario;
          const scen = dec.scenarios.find((s) => s.id === id);
          if (scen) { choices = cloneSel(scen.selections); scenarioId = id; }
          renderDecisions();
        };
      });
      document.querySelector('#advance').onclick = () => {
        CFO.resolveChoices(G, choices);
        save();
        currentPage = 'Decisions';
        render();
      };
    }

    renderDecisions();
  }

  function currencyValuesCard() {
    const m = G.market;
    const fx = CFO.CURRENCY_FX || {};
    const rows = Object.keys(fx).map((ccy) => {
      const vol = fx[ccy] || 1;
      const move = m.usdChange * vol;
      return `<tr><td><b>${ccy}</b></td><td>${vol.toFixed(1)}×</td><td>${(move >= 0 ? '+' : '') + (move * 100).toFixed(1)}%</td><td>${(1 + move).toFixed(3)}</td></tr>`;
    }).join('');
    return `<div class="card"><h2>Currency values</h2><p class="sub">Each currency's move and relative value vs your home currency.</p>
      <table><tr><th>Currency</th><th>Volatility</th><th>Move</th><th>Value</th></tr>${rows}</table></div>`;
  }

  function financingRatesCard() {
    const plan = G.agentActions.A.plan;
    const histRows = (G.history || []).filter((h) => h.rates).map((h) => {
      const r = h.rates;
      return `<tr><td>M${h.month}</td><td>${(r.cashRate * 100).toFixed(2)}%</td><td>${(r.debtRate * 100).toFixed(2)}%</td><td>${(r.factoringRate * 100).toFixed(2)}%</td><td>${(r.wacc * 100).toFixed(2)}%</td></tr>`;
    }).join('');
    return `<div class="card"><h2>Financing rates</h2><p class="sub">Monthly cost of each funding source — now and in past months.</p>
      <table><tr><th>Period</th><th>Cash</th><th>Debt</th><th>Factoring</th><th>WACC</th></tr>
      <tr class="rate-now"><td>Now</td><td>${(plan.cashRate * 100).toFixed(2)}%</td><td>${(plan.debtRate * 100).toFixed(2)}%</td><td>${(plan.factoringRate * 100).toFixed(2)}%</td><td>${(plan.wacc * 100).toFixed(2)}%</td></tr>
      ${histRows}</table></div>`;
  }

  function market() {
    const m = G.market;
    const rows = [
      ['USD movement', (m.usdChange > 0 ? '+' : '') + pct(m.usdChange), m.usdChange > 0 ? 'USD is stronger — imports cost more, exports earn more in USD.' : m.usdChange < 0 ? 'USD is weaker — imports are cheaper, exports earn less in USD.' : 'USD is flat — FX risk is low across your currency trades.'],
      ['Shipping costs', m.shippingMultiplier.toFixed(2) + '×', m.shippingMultiplier > 1.2 ? 'Elevated — freight eats into operating profit on every shipment.' : m.shippingMultiplier < 0.85 ? 'Low — cheap to move goods, so trading margins improve.' : 'Normal — freight is not a major factor this month.'],
      ['Import tariff', pct(m.tariffRate), m.tariffRate > 0.1 ? 'High — raises COGS on imported goods, shrinking import margins.' : m.tariffRate > 0 ? 'Moderate — a small drag on import margins.' : 'None — imports face no tariff drag.'],
      ['Demand index', Math.round(m.demandIndex) + '/100', m.demandIndex > 75 ? 'Strong — larger export deals are on offer.' : m.demandIndex < 45 ? 'Weak — deals are smaller and carry more risk.' : 'Moderate — deal sizes are balanced.'],
      ['Recession risk', Math.round(m.recessionRisk) + '/100', m.recessionRisk > 60 ? 'Elevated — export buyers are more likely to default.' : m.recessionRisk < 20 ? 'Low — credit risk is subdued.' : 'Moderate — normal credit risk.'],
    ];
    el.innerHTML = title('Market', 'Global conditions and what they mean for your decisions.') +
      `<div class="metrics">${metric('USD change', (m.usdChange > 0 ? '+' : '') + pct(m.usdChange), 'vs your home currency')}${metric('Shipping', m.shippingMultiplier.toFixed(1) + '×', 'Freight cost multiplier')}${metric('Import tariff', pct(m.tariffRate), 'On imported goods')}${metric('Demand index', Math.round(m.demandIndex) + '/100', 'Customer demand')}</div>` +
      `<div class="card"><h2>Decision relevance</h2><p class="sub">How each indicator affects this month's choices.</p>
        ${rows.map((x) => `<div class="impact-row"><div><b>${x[0]}</b><span>${x[1]}</span></div><p>${x[2]}</p></div>`).join('')}
      </div>` +
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
      </div>` +
      currencyValuesCard() +
      financingRatesCard() +
      `<div class="callout"><i>i</i><div><b>Market news</b><p>${G.news.map((n) => n.headline).join(' · ')}</p></div></div>`;
  }

  function currentPortfolio() {
    const selected = new Set(choices.trades || []);
    const trades = G.opportunities
      .filter((o) => selected.has(o.id))
      .map((o) => ({ type: o.type, currency: o.currency, capital: o.capital }));
    const funded = trades.reduce((s, t) => s + t.capital, 0);
    const sh = choices.finance.A;
    return {
      trades,
      funded,
      financing: {
        cashAmount: funded * sh.cash / 100,
        debtAmount: funded * sh.debt / 100,
        factoringAmount: funded * sh.factoring / 100,
      },
    };
  }

  function portfolioSeries() {
    const rows = (G.history || []).filter((h) => h.portfolio).map((h) => ({
      month: h.month, current: false,
      trades: h.portfolio.trades, funded: h.portfolio.funded, financing: h.portfolio.financing,
    }));
    const cp = currentPortfolio();
    rows.push({ month: G.month, current: true, trades: cp.trades, funded: cp.funded, financing: cp.financing });
    return rows;
  }

  function tradeStructureTable() {
    const rows = portfolioSeries();
    if (!rows.length) return '';
    let running = 0;
    const body = rows.map((r) => {
      running += r.funded || 0;
      const label = r.current ? `M${r.month} · current` : `M${r.month}`;
      const parts = (r.trades || []).map((t) => (t.type === 'import' ? 'Import' : 'Export') + ' ' + t.currency + ' ' + money(t.capital)).join(' · ');
      return `<tr><td>${label}</td><td>${parts || '—'}</td><td>${money(r.funded || 0)}</td><td>${money(running)}</td></tr>
        <tr class="hbar-row"><td colspan="4">
          <div class="hbar-line"><span class="hbar-tag">Export</span>${hbar(currencySegmentsFor(r.trades, 'export'))}</div>
          <div class="hbar-line"><span class="hbar-tag">Import</span>${hbar(currencySegmentsFor(r.trades, 'import'))}</div>
        </td></tr>`;
    }).join('');
    return `<div class="card"><h2>Portfolio structure · Trade</h2><p class="sub">Selected trades each month, with the cumulative total.</p>
      <table><tr><th>Month</th><th>Trades</th><th>Funded</th><th>Running total</th></tr>${body}</table></div>`;
  }

  function financingStructureTable() {
    const rows = portfolioSeries();
    if (!rows.length) return '';
    let runC = 0, runD = 0, runF = 0;
    const body = rows.map((r) => {
      const f = r.financing || {};
      runC += f.cashAmount || 0; runD += f.debtAmount || 0; runF += f.factoringAmount || 0;
      const total = (f.cashAmount || 0) + (f.debtAmount || 0) + (f.factoringAmount || 0);
      const label = r.current ? `M${r.month} · current` : `M${r.month}`;
      return `<tr><td>${label}</td><td>${money(f.cashAmount || 0)}</td><td>${money(f.debtAmount || 0)}</td><td>${money(f.factoringAmount || 0)}</td><td>${money(total)}</td><td>${money(runC + runD + runF)}</td></tr>
        <tr class="hbar-row"><td colspan="6">${hbar(financingSegmentsFor(f))}</td></tr>`;
    }).join('');
    return `<div class="card"><h2>Portfolio structure · Financing</h2><p class="sub">How each month's funded portfolio was financed, with running totals.</p>
      <table><tr><th>Month</th><th>Cash</th><th>Debt</th><th>Factoring</th><th>Total</th><th>Running</th></tr>${body}</table></div>`;
  }

  const FINANCE_COLORS = { Cash: '#46786b', Debt: '#dc764d', Factoring: '#e4b85d' };
  const IMPORT_COLOR = '#9fd0b8'; // light green
  const EXPORT_COLOR = '#173f36'; // dark green
  const CURRENCY_COLORS = { USD: '#173f36', EUR: '#5b6b9e', GBP: '#dc764d', AED: '#e4b85d', CNY: '#c0392b' };

  function financingSegmentsFor(financing) {
    return [
      { label: 'Cash', value: financing.cashAmount || 0, color: FINANCE_COLORS.Cash },
      { label: 'Debt', value: financing.debtAmount || 0, color: FINANCE_COLORS.Debt },
      { label: 'Factoring', value: financing.factoringAmount || 0, color: FINANCE_COLORS.Factoring },
    ];
  }

  function currencySegmentsFor(trades, type) {
    const byCcy = {};
    (trades || []).forEach((t) => {
      if (t.type !== type) return;
      byCcy[t.currency] = (byCcy[t.currency] || 0) + t.capital;
    });
    return Object.keys(byCcy).map((ccy) => ({
      label: ccy,
      value: byCcy[ccy],
      color: CURRENCY_COLORS[ccy] || '#9aa4a1',
    }));
  }

  function chartLegend(segments) {
    if (!segments.length) return `<div class="chart-row"><span>None selected</span></div>`;
    return `<div class="chart-legend">${segments.map((x) => `<div class="chart-row"><i style="background:${x.color}"></i><span>${x.label}</span><b>${money(x.value)}</b></div>`).join('')}</div>`;
  }

  function hbar(segments) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    if (!total) return `<div class="hbar"><i style="width:100%;background:var(--line)"></i></div>`;
    const parts = segments.filter((x) => x.value > 0).map((x) =>
      `<i style="width:${(x.value / total * 100).toFixed(1)}%;background:${x.color}" title="${x.label} ${Math.round(x.value / total * 100)}%"></i>`).join('');
    return `<div class="hbar">${parts}</div>`;
  }

  function totalFinancingSegments() {
    const agg = { cashAmount: 0, debtAmount: 0, factoringAmount: 0 };
    portfolioSeries().forEach((r) => {
      const f = r.financing || {};
      agg.cashAmount += f.cashAmount || 0;
      agg.debtAmount += f.debtAmount || 0;
      agg.factoringAmount += f.factoringAmount || 0;
    });
    return financingSegmentsFor(agg);
  }

  function tradeByCurrency() {
    const map = {};
    portfolioSeries().forEach((r) => (r.trades || []).forEach((t) => {
      if (!map[t.currency]) map[t.currency] = { import: 0, export: 0 };
      map[t.currency][t.type] += t.capital;
    }));
    return Object.keys(map).map((ccy) => ({
      currency: ccy,
      import: map[ccy].import || 0,
      export: map[ccy].export || 0,
    }));
  }

  function tradeCurrencyBars() {
    const rows = tradeByCurrency();
    if (!rows.length) return `<div class="chart-row"><span>None selected</span></div>`;
    return rows.map((r) => {
      const segs = [
        { label: 'Import ' + r.currency, value: r.import, color: IMPORT_COLOR },
        { label: 'Export ' + r.currency, value: r.export, color: EXPORT_COLOR },
      ];
      return `<div class="ccy-row">
        <div class="ccy-head"><b>${r.currency}</b><span>${money(r.import)} imp · ${money(r.export)} exp</span></div>
        ${hbar(segs)}
      </div>`;
    }).join('');
  }

  function portfolioChartColumn() {
    const fSeg = totalFinancingSegments();
    return `<div class="agent-col chart-col">
      <div class="agent-col-head"><b>Portfolio structure</b><small>Total · all months</small></div>
      <div class="chart-block">
        <div class="chart-title">Financing</div>
        ${hbar(fSeg)}
        ${chartLegend(fSeg)}
      </div>
      <div class="chart-block">
        <div class="chart-title">Trade · import / export</div>
        ${tradeCurrencyBars()}
      </div>
    </div>`;
  }

  function tradeStrategy() {
    const m = G.market;
    const B = G.agentActions.B;
    const r = CFO.risks(G);
    const vol = Math.abs(m.usdChange);
    const totalFx = G.opportunities.reduce((s, o) => s + (o.fxExposure || 0), 0);
    const tradeRows = G.opportunities.map((o) => {
      const rec = o.eval.economicProfit > 0;
      return `<tr${rec ? ' style="background:#eef4f1"' : ''}><td>${o.type === 'import' ? 'Import' : 'Export'}</td><td><b>${o.currency}</b></td><td>${money(o.capital)}</td><td>${(o.fxChange >= 0 ? '+' : '') + (o.fxChange * 100).toFixed(1)}%</td><td>${signedMoney(o.eval.economicProfit)}</td></tr>`;
    }).join('');

    el.innerHTML = title('Trade', 'Specific import and export trades in their own currencies.', 'TRADE') +
      `<div class="metrics">${metric('FX volatility', (vol * 100).toFixed(1) + '%', 'USD move')}${metric('FX exposure', money(totalFx), 'Across deals')}${metric('FX risk score', r.fx + '/100', 'From risk engine')}${metric('Trades', G.opportunities.length, 'On offer this month')}</div>` +
      `<div class="card"><h2>Recommendation</h2><p class="sub">${B.summary}</p></div>` +
      `<div class="card"><h2>Specific trades</h2>
        <table><tr><th>Type</th><th>Currency</th><th>Amount</th><th>FX move</th><th>Economic profit</th></tr>${tradeRows}</table></div>` +
      tradeStructureTable();
  }

  function capital() {
    const c = G.company, m = G.market;
    const A = G.agentActions.A;
    const plan = A.plan;
    const cashRatio = c.cash / Math.max(c.monthlyRevenue, 1);
    const assets = c.cash + c.inventory + (c.expansion || 0);
    const leverage = c.debt / Math.max(assets, 1);

    el.innerHTML = title('Capital', 'Financing mix across cash, debt and factoring.', 'CAPITAL') +
      `<div class="metrics">${metric('Financing split', 'C' + choices.finance.A.cash + ' / D' + choices.finance.A.debt + ' / F' + choices.finance.A.factoring, 'Cash / Debt / Factoring %')}${metric('Cash ratio', cashRatio.toFixed(1) + '×', 'Cash ÷ revenue')}${metric('Leverage', Math.round(leverage * 100) + '%', 'Debt ÷ assets')}${metric('Credit rating', c.creditRating, 'Company credit')}</div>` +
      `<div class="card"><h2>Recommendation</h2><p class="sub">${A.summary}</p></div>` +
      `<div class="card"><h2>Financing sources</h2><p class="sub">Amounts and rates for this month's mix.</p>
        <table><tr><th>Source</th><th>Amount</th><th>Rate</th></tr>
        <tr><td>Cash</td><td><b>${money(plan.cashAmount)}</b></td><td>${(plan.cashRate * 100).toFixed(2)}%/mo</td></tr>
        <tr><td>Debt</td><td><b>${money(plan.debtAmount)}</b></td><td>${(plan.debtRate * 100).toFixed(2)}%/mo</td></tr>
        <tr><td>Factoring</td><td><b>${money(plan.factoringAmount)}</b></td><td>${(plan.factoringRate * 100).toFixed(2)}%/mo</td></tr>
        <tr><td>Blended (WACC)</td><td>—</td><td><b>${(plan.wacc * 100).toFixed(2)}%/mo</b></td></tr></table></div>` +
      financingStructureTable();
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

  const pages = { Decisions: decisions, Market: market, Capital: capital, TradeStrategy: tradeStrategy };

  function newGame() {
    G = CFO.createGame(Math.floor(Math.random() * 0xffffffff));
    save();
    currentPage = 'Decisions';
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
