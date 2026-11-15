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
  let choices = { export: {}, import: {}, finance: { A: { cash: 40, debt: 20, factoring: 40 } }, trades: [] };
  let pendingAdvance = false;

  // Debt is a constant 20% of financing; the trade-off is between cash and factoring.
  function normalizeA(raw) {
    raw = raw || {};
    const cash = clamp0(raw.cash || 0);
    const factoring = clamp0(raw.factoring || 0);
    const sum = (cash + factoring) || 80;
    const c = Math.round((cash / sum) * 80);
    return { cash: c, debt: 20, factoring: 80 - c };
  }
  // Move the cash/factoring trade-off; debt stays fixed at 20%.
  function setShare(key, value) {
    if (key === 'debt') return;
    const A = choices.finance.A;
    const other = key === 'cash' ? 'factoring' : 'cash';
    A[key] = Math.min(80, clamp0(value));
    A[other] = 80 - A[key];
    choices.finance.A = { cash: A.cash, debt: 20, factoring: A.factoring };
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
  function financeColumn(ag) {
    const plan = ag.plan;
    const A = ag.shares;
    const cashPct = A.cash;
    const factoringPct = 80 - cashPct;
    const seg = (label, amount, rate, note = '') => `
      <div class="fin-seg">
        <span>${label}</span>
        <b>${money(amount)}</b>
        <small>${(rate * 100).toFixed(2)}%/mo${note ? ' · ' + note : ''}</small>
      </div>`;
    const total = plan.cashAmount + plan.debtAmount + plan.factoringAmount;
    return `<div class="card finance-card"><h2>Financing</h2><p class="sub">20% of financing always goes through debt. The slider sets how much of available cash is kept as buffer vs used as factoring. A cash buffer absorbs negative event returns; otherwise factoring doubles as a burden.</p>
      <div class="fin-split">
        <div class="fin-slider">
          <div class="cash-bar-line"><span>Available cash</span><b>${money(G.company.cash)}</b></div>
          <input type="range" class="agent-slider" data-key="cash" min="0" max="80" step="1" value="${cashPct}"${pendingAdvance ? ' disabled' : ''}>
          <div class="slider-meta"><span class="slider-val">${money(plan.cashAmount)} buffer</span><span class="slider-rec">${money(plan.factoringAmount)} factoring · ${money(plan.factoringAmount * plan.factoringRate)}/mo</span></div>
        </div>
        <div class="fin-segments">
          ${seg('Debt · 20%', plan.debtAmount, plan.debtRate, 'burden').replace('fin-seg', 'fin-seg debt')}
        </div>
      </div>
      <div class="mix-total">Total financing <b>${money(total)}</b></div>
    </div>`;
  }

  function profitBox(sel) {
    const historyNpv = (G.history || []).reduce((s, h, i) => s + (h.profit || 0) / Math.pow(1.01, i + 1), 0);
    const exp = G.pendingExpected || null;
    const actualMode = !!(pendingAdvance && exp);

    // Both columns come from the engine, so this box always agrees with the
    // "Last month — event vs expected" recap (expectedProfit / profit).
    const expected = actualMode ? exp : CFO.project(G, sel);
    const expectedVals = {
      importContribution: expected.importContribution,
      exportContribution: expected.exportContribution,
      financingCost: expected.financingCost,
    };
    const expectedTotal = expected.profit;

    const last = G.lastResult;
    const actualVals = actualMode && last
      ? {
          importContribution: last.importContribution != null ? last.importContribution : expected.importContribution,
          exportContribution: last.exportContribution != null ? last.exportContribution : expected.exportContribution,
          financingCost: last.financingCost != null ? last.financingCost : expected.financingCost,
        }
      : expectedVals;
    const actualTotal = actualMode && last && last.profit != null ? last.profit : expectedTotal;

    const stages = [
      ['Import', 'importContribution'],
      ['Export', 'exportContribution'],
      ['Financing', 'financingCost'],
    ];
    const stageRows = stages.map(([l, key]) => {
      if (actualMode) {
        return `<tr><td>${l}</td><td class="${expectedVals[key] >= 0 ? 'up' : 'down'}">${signedMoney(expectedVals[key])}</td><td class="${actualVals[key] >= 0 ? 'up' : 'down'}">${signedMoney(actualVals[key])}</td></tr>`;
      }
      return `<tr><td>${l}</td><td class="${expectedVals[key] >= 0 ? 'up' : 'down'}">${signedMoney(expectedVals[key])}</td></tr>`;
    }).join('');

    const eventAdjRow = actualMode && last && Math.abs(last.eventAdjustment || 0) > 0.5
      ? `<tr class="event-adj-row"><td>Event impact</td><td>—</td><td class="${last.eventAdjustment >= 0 ? 'up' : 'down'}">${signedMoney(last.eventAdjustment)}</td></tr>`
      : '';

    const totalRow = actualMode
      ? `<tr class="total-row"><td>Total</td><td class="${expectedTotal >= 0 ? 'up' : 'down'}">${signedMoney(expectedTotal)}</td><td class="${actualTotal >= 0 ? 'up' : 'down'}">${signedMoney(actualTotal)}</td></tr>`
      : `<tr class="total-row"><td>Total</td><td class="${expectedTotal >= 0 ? 'up' : 'down'}">${signedMoney(expectedTotal)}</td></tr>`;
    const headRow = actualMode ? `<tr><th>Step</th><th>Expected</th><th>Actual</th></tr>` : `<tr><th>Step</th><th>Return</th></tr>`;
    const subTxt = actualMode
      ? `Actual vs expected for each step after the event (M${last ? last.month : G.month}) — totals match the recap below.`
      : `Expected return per step for this month (M${G.month}) — engine projection before the event.`;
    return `<div class="card profit-box">
      <h2>Expected profit</h2>
      <p class="sub">${subTxt}</p>
      <div class="profit-total ${expectedTotal >= 0 ? 'up' : 'down'}">${signedMoney(expectedTotal)}</div>
      <table class="profit-stages">
        ${headRow}
        ${stageRows}
        ${eventAdjRow}
        ${totalRow}
      </table>
      <div class="fin-needed"><span>Actual profit this month</span><b class="${actualTotal >= 0 ? 'up' : 'down'}">${signedMoney(actualTotal)}</b><small>${actualMode ? 'after the event' : 'projected'}</small></div>
      <div class="fin-needed"><span>Total cumulative return (NPV)</span><b class="${historyNpv >= 0 ? 'up' : 'down'}">${signedMoney(historyNpv)}</b></div>
    </div>`;
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
          <div class="${last.expectedProfit >= 0 ? 'good' : 'bad'}"><span>Expected profit</span><b>${signedMoney(last.expectedProfit)}</b><small>before the event</small></div>
          <div class="${last.profit >= 0 ? 'good' : 'bad'}"><span>Actual profit</span><b>${signedMoney(last.profit)}</b><small>after the event</small></div>
          <div class="${last.profit - last.expectedProfit >= 0 ? 'good' : 'bad'}"><span>Difference</span><b>${signedMoney(last.profit - last.expectedProfit)}</b><small>event impact</small></div>
        </div>`
      : '';
    const outcome = (evt || compare)
      ? `<div class="card"><h2>${pendingAdvance ? 'This month' : 'Last month'} (M${last.month}) — event vs expected</h2>${evt}${compare}</div>`
      : '';
    return outcome + `<div class="card"><h2>Monthly profit</h2><div class="profit-chart">${bars}</div></div>`;
  }

  function decisions() {
    const init = CFO.buildDecision(G, null);
    if (!pendingAdvance) choices = cloneSel(init.scenarios.find((s) => s.id === 'rec').selections);

    function renderDecisions() {
      updateShell();
      const dec = CFO.buildDecision(G, choices);
      choices.trades = dec.trades;
      const btnLabel = pendingAdvance ? 'Next month →' : 'Run simulation →';
      el.innerHTML =
        title('Decisions', 'Choose import sources, export markets and financing.', 'DECISIONS') +
        marketData() +
        `<div class="fin-row">${financeColumn(dec.agents.finance)}${profitBox(choices)}</div>` +
        `<div class="advance-bar"><button id="advance" class="primary${pendingAdvance ? ' gray' : ''}">${btnLabel}</button></div>` +
        recap();

      if (!pendingAdvance) {
        document.querySelectorAll('.agent-slider').forEach((slider) => {
          slider.oninput = () => {
            setShare(slider.dataset.key, Number(slider.value));
            renderDecisions();
          };
        });
        document.querySelectorAll('[data-agent][data-opt]').forEach((btn) => {
          btn.onclick = () => {
            const agent = btn.dataset.agent;
            const key = btn.dataset.key;
            const opt = btn.dataset.opt;
            const arr = choices[agent][key] || [];
            choices[agent][key] = arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt];
            renderDecisions();
          };
        });
      }
      document.querySelector('#advance').onclick = () => {
        if (!pendingAdvance) {
          // Snapshot the pre-event projection so the actual phase can show expected vs actual.
          const mPre = G.market;
          const revPre = G.company.monthlyRevenue * (0.88 + Math.max(0, Math.min(100, mPre.demandIndex)) / 100 * 0.4);
          G.pendingOptionReturns = { import: {}, export: {} };
          (CFO.IMPORT_SOURCING_OPTIONS ? CFO.IMPORT_SOURCING_OPTIONS(mPre) : []).forEach((s) => {
            G.pendingOptionReturns.import[s.id] = revPre * 0.08 * (1 + Math.abs(s.supplyRisk) * 0.02);
          });
          (CFO.EXPORT_MARKET_OPTIONS ? CFO.EXPORT_MARKET_OPTIONS(mPre) : []).forEach((mk) => {
            G.pendingOptionReturns.export[mk.id] = revPre * 0.04 * (1 + mk.marketRisk * 0.02);
          });
          G.pendingExpected = CFO.project(G, choices);
          CFO.resolveChoices(G, choices, false);
          if (G.phase === 'results') { render(); return; }
          pendingAdvance = true;
          G.pendingAdvance = true;
          save();
          renderDecisions();
        } else {
          CFO.advanceToNextMonth(G);
          pendingAdvance = false;
          G.pendingAdvance = false;
          G.pendingExpected = null;
          G.pendingOptionReturns = null;
          save();
          currentPage = 'Decisions';
          render();
        }
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

  function marketData() {
    const m = G.market;
    const sources = CFO.IMPORT_SOURCING_OPTIONS ? CFO.IMPORT_SOURCING_OPTIONS(m) : [];
    const markets = CFO.EXPORT_MARKET_OPTIONS ? CFO.EXPORT_MARKET_OPTIONS(m) : [];
    const srcSel = choices.import.sourcing || [];
    const mkSel = choices.export.market || [];
    const usdTxt = (m.usdChange > 0 ? '+' : '') + pct(m.usdChange);
    const usdCls = m.usdChange > 0.0005 ? 'up' : m.usdChange < -0.0005 ? 'down' : 'flat';
    const revenue = G.company.monthlyRevenue || 0;
    const RISK_COST_IMPORT = 0.005; // 0.5% of revenue per supply-risk point
    const RISK_COST_EXPORT = 0.01;  // 1% of revenue per market-risk point

    const signCls = (n) => (n < 0 ? 'down' : n > 0 ? 'up' : 'flat');
    const actual = pendingAdvance;
    const negEvent = !!(G.lastResult && G.lastResult.event && G.lastResult.event.impact === 'negative');
    const posEvent = !!(G.lastResult && G.lastResult.event && G.lastResult.event.impact === 'positive');
    const noteImport = actual
      ? 'Expected = pre-event projection · Actual = lower if negative event, higher if positive — shown only for selected sources.'
      : 'Expected profit = revenue × 8% × (1 + |supply risk| × 2%) — realistic margin, higher risk pays more.';
    const noteExport = actual
      ? 'Expected = pre-event projection · Actual = lower if negative event, higher if positive — shown only for selected markets.'
      : 'Expected profit = revenue × 4% × (1 + competitive risk × 2%) — realistic margin, higher risk pays more.';

    const actScale = (v) => (actual ? (negEvent ? v * 0.8 : posEvent ? v * 1.2 : v) : null);

    const srcRows = sources.map((s) => {
      const riskCost = s.supplyRisk * RISK_COST_IMPORT;
      const sel = srcSel.includes(s.id);
      const expVal = actual && G.pendingOptionReturns ? G.pendingOptionReturns.import[s.id] : revenue * 0.08 * (1 + Math.abs(s.supplyRisk) * 0.02);
      const expCls = signCls(expVal);
      const actVal = actScale(expVal);
      const actTxt = actual ? (sel ? signedMoney(actVal) : '—') : '—';
      const actCls = actual && sel ? signCls(actVal) : 'flat';
      return `<tr><td><button class="market-pick${sel ? ' selected' : ''}" data-agent="import" data-key="sourcing" data-opt="${s.id}"${actual ? ' disabled' : ''}>${s.label}</button></td><td><span class="val flat">${Math.abs(s.supplyRisk)}</span></td><td><span class="val flat">${pct(Math.abs(riskCost))}</span></td><td><span class="val ${expCls}">${signedMoney(expVal)}</span></td><td><span class="val ${actCls}">${actTxt}</span></td></tr>`;
    }).join('');

    const mkRows = markets.map((mk) => {
      const riskCost = mk.marketRisk * RISK_COST_EXPORT;
      const sel = mkSel.includes(mk.id);
      const expVal = actual && G.pendingOptionReturns ? G.pendingOptionReturns.export[mk.id] : revenue * 0.04 * (1 + mk.marketRisk * 0.02);
      const expCls = signCls(expVal);
      const actVal = actScale(expVal);
      const actTxt = actual ? (sel ? signedMoney(actVal) : '—') : '—';
      const actCls = actual && sel ? signCls(actVal) : 'flat';
      return `<tr><td><button class="market-pick${sel ? ' selected' : ''}" data-agent="export" data-key="market" data-opt="${mk.id}"${actual ? ' disabled' : ''}>${mk.label}</button></td><td><span class="val flat">${Math.abs(mk.marketRisk)}</span></td><td><span class="val flat">${pct(Math.abs(riskCost))}</span></td><td><span class="val ${expCls}">${signedMoney(expVal)}</span></td><td><span class="val ${actCls}">${actTxt}</span></td></tr>`;
    }).join('');

    return `<div class="market-data">
      <div class="card"><h2>Import sources</h2><p class="sub">Your sourcing options — landed cost vs supply risk.</p>
        <table class="big"><tr><th>Source</th><th>Supply risk</th><th>Risk cost<br><small>0.5%/pt</small></th><th>Expected profit</th><th>Actual return</th></tr>${srcRows}</table>
        <p class="sub" style="margin-top:12px">${noteImport}</p>
        <p class="sub" style="margin-top:12px">Shipping <b>${m.shippingMultiplier.toFixed(2)}×</b> · Tariff <b>${pct(m.tariffRate)}</b> · USD <span class="val ${usdCls}">${usdTxt}</span></p>
      </div>
      <div class="card"><h2>Export markets</h2><p class="sub">Your focus markets and their currency move.</p>
        <table class="big"><tr><th>Market</th><th>Competitive risk</th><th>Risk cost<br><small>1%/pt</small></th><th>Expected profit</th><th>Actual return</th></tr>${mkRows}</table>
        <p class="sub" style="margin-top:12px">${noteExport}</p>
        <p class="sub" style="margin-top:12px">Demand <b>${Math.round(m.demandIndex)}/100</b> · Recession <b>${Math.round(m.recessionRisk)}/100</b></p>
      </div>
    </div>`;
  }

  function market() {
    el.innerHTML = title('Market', 'Financing cost and risk drivers behind your decisions.') +
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
      return `<tr${rec ? ' class="good-row"' : ''}><td>${o.type === 'import' ? 'Import' : 'Export'}</td><td><b>${o.currency}</b></td><td>${money(o.capital)}</td><td>${(o.fxChange >= 0 ? '+' : '') + (o.fxChange * 100).toFixed(1)}%</td><td>${signedMoney(o.eval.economicProfit)}</td></tr>`;
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
        ${[['Cash growth', s.cashGrowth, '20%'], ['Profit growth', s.profitGrowth, '30%'], ['Risk management', s.riskManagement, '20%'], ['Credit rating', s.creditScore, '15%'], ['Survival', s.survival, '15%']].map((x) => `<div class="risk-list"><span>${x[0]} <b>${x[1]}/100 · ${x[2]}</b></span><div class="track"><i style="width:${x[1]}%"></i></div></div>`).join('')}
      </div>` +
      `<div class="metrics">${metric('Company value', money(s.finalCompanyValue), 'Cash + inventory − debt')}${metric('Total profit', signedMoney(s.totalProfit), 'Across 12 months')}${metric('Final cash', money(s.totalCash), 'Ending balance')}${metric('Credit rating', s.creditRating, 'Final')}</div>` +
      `<div class="advance-bar"><button class="primary" id="again">↻ Play again</button></div>`;
    document.querySelector('#again').onclick = () => newGame();
  }

  const pages = { Decisions: decisions, Market: market, Capital: capital, TradeStrategy: tradeStrategy };

  function newGame() {
    G = CFO.createGame(Math.floor(Math.random() * 0xffffffff));
    pendingAdvance = false;
    save();
    currentPage = 'Decisions';
    render();
  }

  /* ---------- init ---------- */
  G = load() || CFO.createGame(Math.floor(Math.random() * 0xffffffff));
  pendingAdvance = !!(G && G.pendingAdvance);
  save();

  document.querySelectorAll('nav button').forEach((b) => {
    b.onclick = () => { currentPage = b.dataset.page; render(); };
  });
  document.querySelector('.menu').onclick = () => document.querySelector('aside').classList.toggle('open');
  document.querySelector('#newgame').onclick = () => newGame();

  /* ---------- dark theme ---------- */
  const THEME_KEY = 'trade-cfo-theme';
  const themeBtn = document.querySelector('#theme-toggle');
  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    if (themeBtn) themeBtn.textContent = dark ? '◐ Dark' : '◐ Light';
  }
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyTheme(theme !== 'light'); // dark by default
  if (themeBtn) themeBtn.onclick = () => {
    const dark = !document.body.classList.contains('dark');
    applyTheme(dark);
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
  };

  render();
})();
