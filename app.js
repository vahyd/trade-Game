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
    const selected = action.selectedIds || [];
    const recommended = action.recommendedIds || [];
    const opts = action.options.map((op) => {
      const sel = selected.includes(op.id);
      const rec = recommended.includes(op.id);
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
    const bars = G.history.map((h) => {
      const hgt = clamp0((h.profit / 500000) * 100 + 50);
      return `<div class="pbar"><i style="height:${hgt}%;background:${h.profit >= 0 ? '#46786b' : '#dc764d'}"></i><span>M${h.month}</span></div>`;
    }).join('');
    const evt = last.event
      ? `<div class="event ${last.event.impact === 'positive' ? 'good' : 'bad'}"><span class="badge">${last.event.cat}</span><b>${last.event.name} struck</b><p>${last.event.desc}</p></div>`
      : '';
    const compare = last.expectedProfit != null
      ? `<div class="expected-vs-actual">
          <div><span>Expected profit</span><b>${signedMoney(last.expectedProfit)}</b><small>before the event</small></div>
          <div class="${last.profit >= 0 ? 'good' : 'bad'}"><span>Actual profit</span><b>${signedMoney(last.profit)}</b><small>after the event</small></div>
          <div class="${last.profit - last.expectedProfit >= 0 ? 'good' : 'bad'}"><span>Difference</span><b>${signedMoney(last.profit - last.expectedProfit)}</b><small>event impact</small></div>
        </div>`
      : '';
    const outcome = (evt || compare)
      ? `<div class="card"><h2>Last month — event vs expected</h2>${evt}${compare}</div>`
      : '';
    return outcome + `<div class="card"><h2>Monthly profit</h2><div class="profit-chart">${bars}</div></div>`;
  }

  function decisions() {
    const init = CFO.buildDecision(G, null);
    choices = cloneSel(init.scenarios.find((s) => s.id === 'rec').selections);
    let scenarioId = 'rec';

    function renderDecisions() {
      const dec = CFO.buildDecision(G, choices);
      choices.trades = dec.trades;
      el.innerHTML =
        title('Decisions', 'Optimize exports, imports and financing — then pick the coordinator strategy.', '3 AGENTS + COORDINATOR') +
        `<div class="agent-cols">${exportColumn(dec.agents.export)}${importColumn(dec.agents.import)}${financeColumn(dec.agents.finance)}</div>` +
        coordinatorPanel(dec.scenarios, scenarioId) +
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
          const agent = btn.dataset.agent;
          const key = btn.dataset.key;
          const opt = btn.dataset.opt;
          const arr = choices[agent][key] || [];
          choices[agent][key] = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
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

  function financingRatesCard() {
    const plan = G.agentActions.A.plan;
    const histRows = (G.history || []).filter((h) => h.rates).map((h) => {
      const r = h.rates;
      return `<tr><td>M${h.month}</td><td>${(r.cashRate * 100).toFixed(2)}%</td><td>${(r.debtRate * 100).toFixed(2)}%</td><td>${(r.factoringRate * 100).toFixed(2)}%</td><td>${(r.wacc * 100).toFixed(2)}%</td></tr>`;
    }).join('');
    return `<div class="card"><h2>Financing rates</h2><p class="sub">Monthly cost of each funding source — now and in past months.</p>
      <table class="big"><tr><th>Period</th><th>Cash</th><th>Debt</th><th>Factoring</th><th>WACC</th></tr>
      <tr class="rate-now"><td>Now</td><td>${(plan.cashRate * 100).toFixed(2)}%</td><td>${(plan.debtRate * 100).toFixed(2)}%</td><td>${(plan.factoringRate * 100).toFixed(2)}%</td><td>${(plan.wacc * 100).toFixed(2)}%</td></tr>
      ${histRows}</table></div>`;
  }

  function riskSnapshotCard() {
    const r = CFO.risks(G);
    return `<div class="card"><h2>Risk snapshot</h2><p class="sub">The four drivers behind your overall risk score.</p>
      <div class="risk-list">${[['FX risk', r.fx], ['Credit risk', r.credit], ['Supply chain', r.supply], ['Financing', r.financing]].map((x) => `<div><span>${x[0]}</span><div class="track"><i style="width:${x[1]}%;background:${x[1] > 60 ? '#dc764d' : '#46786b'}"></i></div><b>${x[1]}</b></div>`).join('')}</div>
      <p class="sub" style="margin-top:12px">Overall risk <b>${r.score}/100</b></p>
    </div>`;
  }

  function market() {
    const m = G.market;
    const fx = CFO.CURRENCY_FX || {};
    const sources = CFO.IMPORT_SOURCING_OPTIONS || [];
    const markets = CFO.EXPORT_MARKET_OPTIONS || [];
    const usdTxt = (m.usdChange > 0 ? '+' : '') + pct(m.usdChange);
    const usdCls = m.usdChange > 0.0005 ? 'up' : m.usdChange < -0.0005 ? 'down' : 'flat';

    const srcRows = sources.map((s) => {
      const costTxt = (s.cogsAdj > 0 ? '+' : '') + pct(s.cogsAdj);
      const costCls = s.cogsAdj < 0 ? 'up' : s.cogsAdj > 0 ? 'down' : 'flat';
      const riskCls = s.supplyRisk > 6 ? 'down' : s.supplyRisk < 0 ? 'up' : 'flat';
      return `<tr><td><b>${s.label}</b></td><td><span class="val ${costCls}">${costTxt}</span></td><td><span class="val ${riskCls}">${s.supplyRisk > 0 ? '+' : ''}${s.supplyRisk}</span></td></tr>`;
    }).join('');

    const mkRows = markets.map((mk) => {
      const move = m.usdChange * (fx[mk.focus] || 1);
      const moveTxt = (move >= 0 ? '+' : '') + (move * 100).toFixed(1) + '%';
      const moveCls = move > 0.0005 ? 'up' : move < -0.0005 ? 'down' : 'flat';
      return `<tr><td><b>${mk.label}</b></td><td>${mk.focus}</td><td><span class="val ${moveCls}">${moveTxt}</span></td></tr>`;
    }).join('');

    el.innerHTML = title('Market', 'Import sources and export markets — the data behind each decision.') +
      `<div class="grid">
        <div class="card"><h2>Import sources</h2><p class="sub">Your sourcing options — landed cost vs supply risk.</p>
          <table class="big"><tr><th>Source</th><th>Cost adj.</th><th>Supply risk</th></tr>${srcRows}</table>
          <p class="sub" style="margin-top:12px">Shipping <b>${m.shippingMultiplier.toFixed(2)}×</b> · Tariff <b>${pct(m.tariffRate)}</b> · USD <span class="val ${usdCls}">${usdTxt}</span></p>
        </div>
        <div class="card"><h2>Export markets</h2><p class="sub">Your focus markets and their currency move.</p>
          <table class="big"><tr><th>Market</th><th>Currency</th><th>Move</th></tr>${mkRows}</table>
          <p class="sub" style="margin-top:12px">Demand <b>${Math.round(m.demandIndex)}/100</b> · Recession <b>${Math.round(m.recessionRisk)}/100</b></p>
        </div>
      </div>` +
      financingRatesCard() +
      riskSnapshotCard();
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
  const CURRENCY_COLORS = { USD: '#173f36', EUR: '#5b6b9e', CNY: '#c0392b' };

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

  function hbar(segments) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    if (!total) return `<div class="hbar"><i style="width:100%;background:var(--line)"></i></div>`;
    const parts = segments.filter((x) => x.value > 0).map((x) =>
      `<i style="width:${(x.value / total * 100).toFixed(1)}%;background:${x.color}" title="${x.label} ${Math.round(x.value / total * 100)}%"></i>`).join('');
    return `<div class="hbar">${parts}</div>`;
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
