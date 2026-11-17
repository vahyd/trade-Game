/* Trade CFO → AI CFO Platform — first modules (Cash Flow, Advisor, Scenarios).
   All numbers are computed from the shared Trade CFO engine (window.CFO).
   Output is advisory only: estimates and forecasts are labeled as such. */
'use strict';
(function () {
  const CFO = window.CFO;
  const money = CFO.money;
  const signedMoney = CFO.signedMoney;
  const pct = CFO.pct;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  const title = (G, name, desc, tag) =>
    `<div class="title"><div><span>AI CFO · MONTH ${G.month} / ${CFO.TOTAL_MONTHS}</span><h1>${name}</h1><p>${desc}</p></div><i class="status">● ${tag}</i></div>`;
  const metric = (l, v, s, w = '') => `<div class="metric ${w}"><label>${l}</label><b>${v}</b><small>${s}</small></div>`;

  function demandMultiplier(market) {
    return 0.88 + clamp(market.demandIndex, 0, 100) / 100 * 0.4;
  }

  function withFin(sel, cashPct) {
    const s = JSON.parse(JSON.stringify(sel));
    s.finance = s.finance || { A: {} };
    s.finance.A = { cash: cashPct, debt: 20, factoring: 80 - cashPct };
    return s;
  }

  /* ---------- Cash flow & working capital engine ---------- */
  function cashflowForecast(G, sel) {
    const c = G.company, m = G.market;
    const proj = CFO.project(G, sel);
    const revenue = c.monthlyRevenue * demandMultiplier(m);
    const cogs = revenue * 0.6;
    const opex = revenue * 0.18;
    const financingOut = Math.abs(proj.financingCost);
    const netMonthly = proj.profit;
    const weeklyNet = netMonthly / 4.33;
    const weeklyOut = (cogs + opex + financingOut) / 4.33;
    let cash = c.cash;
    const series = [];
    for (let w = 1; w <= 13; w++) {
      cash += weeklyNet;
      series.push({ week: w, cash: Math.round(cash) });
    }
    const buffer = Math.round(weeklyOut * 4);
    const minCash = Math.min(...series.map((s) => s.cash));
    const gaps = series
      .filter((s) => s.cash < buffer)
      .map((s) => ({ week: s.week, cash: s.cash, gap: Math.round(buffer - s.cash) }));
    const dso = 45, dpo = 40;
    const ar = Math.round(revenue * (dso / 30) * 0.85);
    const ap = Math.round(cogs * (dpo / 30));
    const dio = (c.inventory / Math.max(cogs, 1)) * 30;
    const wcReq = Math.round(ar + c.inventory - ap);
    const ccc = Math.round(dio + dso - dpo);
    return {
      proj, revenue, cogs, opex, financingOut, netMonthly, weeklyOut,
      series, buffer, minCash, gaps, dso, dpo, dio, ar, ap, wcReq, ccc,
    };
  }

  function liquidityActions(f, G) {
    const acts = [];
    if (f.gaps.length) {
      acts.push(`Draw on the credit facility — up to ${money(G.company.cash * 0.5)} of headroom (max debt = 50% of cash).`);
      acts.push(`Shift the mix toward factoring to protect the cash buffer (buffer ${money(f.buffer)} vs forecast low ${money(f.minCash)}).`);
      acts.push(`Shorten customer terms from 45 to 30 days to collect ~${money(f.ar * 15 / 45)} earlier.`);
      acts.push(`Cut inventory purchases — each 10% reduction frees ~${money(G.company.inventory * 0.1)}.`);
    } else {
      acts.push('No liquidity gap over the next 13 weeks under the current plan.');
      acts.push(`Maintain a buffer of at least ${money(f.buffer)} (4 weeks of outflows) to absorb event shocks.`);
      acts.push(`Surplus above ~${money(f.buffer * 1.5)} could fund additional trades or reduce debt.`);
    }
    return acts;
  }

  /* ---------- Scenario engine ---------- */
  const SCENARIOS = [
    { id: 'usd5', label: 'USD +5%', apply: (m) => { m.usdChange += 0.05; }, response: 'Hedge more USD exposure; USD-paying buyers earn more.' },
    { id: 'usd10', label: 'USD +10%', apply: (m) => { m.usdChange += 0.10; }, response: 'Increase the FX hedge ratio and favour USD-paying buyers.' },
    { id: 'usd15', label: 'USD +15%', apply: (m) => { m.usdChange += 0.15; }, response: 'Fully hedge USD receivables; renegotiate CNY supplier pricing.' },
    { id: 'ship20', label: 'Shipping +20%', apply: (m) => { m.shippingMultiplier += 0.20; }, response: 'Lock freight contracts and shift sourcing toward Mexico.' },
    { id: 'ship40', label: 'Shipping +40%', apply: (m) => { m.shippingMultiplier += 0.40; }, response: 'Prioritise near-shore low-risk suppliers; raise selling prices.' },
    { id: 'tariff5', label: 'Tariffs +5 pts', apply: (m) => { m.tariffRate += 0.05; }, response: 'Switch sourcing to lower-tariff countries; include duties in landed cost.' },
    { id: 'tariff10', label: 'Tariffs +10 pts', apply: (m) => { m.tariffRate += 0.10; }, response: 'Review country exposure; prefer Mexico sourcing.' },
    { id: 'rate2', label: 'Rates +2 pts', apply: (m) => { m.interestSurcharge += 0.02; }, response: 'Lock fixed-rate debt; use factoring only for short cycles.' },
    { id: 'demand10', label: 'Demand −10', apply: (m) => { m.demandIndex -= 10; }, response: 'Tighten inventory and credit terms; protect the cash buffer.' },
    { id: 'demand20', label: 'Demand −20', apply: (m) => { m.demandIndex -= 20; }, response: 'Cut inventory aggressively; factor receivables to unlock cash.' },
    { id: 'supplier', label: 'Supplier bankruptcy', apply: (m) => { m.shippingMultiplier += 0.50; m.costPressure += 0.10; }, response: 'Dual-source critical inputs; hold larger safety stock.' },
    { id: 'traderev', label: 'Trade restrictions', apply: (m) => { m.tariffRate += 0.15; m.demandIndex -= 15; }, response: 'Diversify markets away from restricted routes; stress-test FX.' },
    { id: 'liquidity', label: 'Liquidity crisis', apply: (m) => { m.interestSurcharge += 0.02; m.recessionRisk += 30; }, response: 'Raise the cash buffer, extend debt maturity, reduce factoring dependency.' },
  ];

  function runScenario(G, sel, sc) {
    const mkt = JSON.parse(JSON.stringify(G.market));
    sc.apply(mkt);
    const st = { company: G.company, market: mkt, opportunities: G.opportunities };
    const base = CFO.project(G, sel);
    const scen = CFO.project(st, sel);
    const baseRisk = CFO.risks(G).score;
    const scenRisk = CFO.risks(st).score;
    return {
      st, base, scen, baseRisk, scenRisk,
      deltaProfit: scen.profit - base.profit,
      deltaFinancing: scen.financingCost - base.financingCost,
      deltaRisk: scenRisk - baseRisk,
    };
  }

  /* ---------- Advisor engine ---------- */
  function advisorAnswer(G, sel, q) {
    const t = (q || '').toLowerCase();
    const c = G.company, m = G.market;
    const f = cashflowForecast(G, sel);
    const p = CFO.project(G, sel);
    const r = CFO.risks(G);
    const revenue = f.revenue;
    const sources = CFO.IMPORT_SOURCING_OPTIONS(m)
      .map((s) => ({ ...s, exp: revenue * 0.08 * (1 + Math.abs(s.supplyRisk) * 0.02) }))
      .sort((a, b) => b.exp - a.exp);
    const markets = CFO.EXPORT_MARKET_OPTIONS(m)
      .map((mk) => {
        const exp = revenue * 0.04 * (1 + mk.marketRisk * 0.02);
        return { ...mk, exp, adj: exp / (1 + mk.marketRisk) };
      })
      .sort((a, b) => b.adj - a.adj);
    const list = (arr) => arr.map((x, i) => `${i + 1}. ${x.label} ${signedMoney(x.exp)}${x.adj != null ? ` (risk-adjusted ${x.adj.toFixed(2)})` : ''}`).join(' · ');

    if (/cash|next 3|three month|3 months|weeks/.test(t) && !/working capital/.test(t)) {
      const need = Math.round(f.weeklyOut * 13);
      const gapTxt = f.gaps.length ? `a liquidity gap of ${money(f.gaps[0].gap)} opens in week ${f.gaps[0].week}` : 'no liquidity gap';
      return `You will need about ${money(need)} to cover the next 13 weeks of outflows (${money(Math.round(f.weeklyOut))}/week). Expected net monthly return is ${signedMoney(f.netMonthly)}. The forecast shows ${gapTxt} against the ${money(f.buffer)} buffer. Assumption: current plan holds and demand stays at ${Math.round(m.demandIndex)}/100.`;
    }
    if (/import|china|source|supplier/.test(t)) {
      const cn = sources.find((s) => s.label === 'China');
      return `Ranked import sources: ${list(sources)}. ${sources[0].label} has the highest expected return this month. China adds return but carries supply risk ${cn ? cn.supplyRisk : '—'} — verify landed cost (tariff ${pct(m.tariffRate)}, shipping ${m.shippingMultiplier.toFixed(2)}×) before increasing imports.`;
    }
    if (/export|market/.test(t)) {
      return `Ranked export markets by risk-adjusted return: ${list(markets)}. ${markets[0].label} offers the best risk-adjusted return this month.`;
    }
    if (/factor|bank|debt|credit facility/.test(t)) {
      const cur = { label: 'Current mix', cost: p.financingCost, profit: p.profit };
      const cash = CFO.project(G, withFin(sel, 80));
      const fact = CFO.project(G, withFin(sel, 0));
      return [cur,
        { label: 'All cash (80%)', cost: cash.financingCost, profit: cash.profit },
        { label: 'All factoring (80%)', cost: fact.financingCost, profit: fact.profit },
      ].map((v) => `${v.label}: financing cost ${signedMoney(v.cost)}, expected profit ${signedMoney(v.profit)}`).join(' · ') +
        '. Factoring costs 3%/mo but funds more deals and lowers default risk; cash is cheapest but ties up the buffer.';
    }
    if (/usd|appreciat|fx|exchange/.test(t)) {
      const sc = SCENARIOS.find((x) => x.id === 'usd10');
      const res = runScenario(G, sel, sc);
      return `If the USD appreciates 10%: expected profit moves ${signedMoney(res.deltaProfit)} (${signedMoney(res.base.profit)} → ${signedMoney(res.scen.profit)}), financing cost ${signedMoney(res.deltaFinancing)}, risk score ${res.deltaRisk > 0 ? '+' : ''}${res.deltaRisk}. ${sc.response}`;
    }
    if (/credit risk|customer|buyer/.test(t)) {
      const worst = CFO.EXPORT_MARKET_OPTIONS(m).slice().sort((a, b) => b.marketRisk - a.marketRisk)[0];
      return `Highest credit risk: ${worst.label} buyers (market risk ${worst.marketRisk}/100). Overall credit risk is ${r.credit}/100, tracking recession risk (${Math.round(m.recessionRisk)}/100). Tighten terms in ${worst.label} or factor those receivables.`;
    }
    if (/afford|contract|accept/.test(t)) {
      const shares = (sel.finance && sel.finance.A) || { cash: 40, debt: 20, factoring: 40 };
      const csh = shares.cash / 100, fac = shares.factoring / 100;
      const cashShare = csh / (csh + fac || 1) * 0.8, factShare = fac / (csh + fac || 1) * 0.8;
      const budget = c.cash * 0.85 * (cashShare * 1 + 0.2 * 3 + factShare * 3.5);
      const funded = p.financingNeeded;
      const headroom = Math.round(budget - funded);
      return headroom > 0
        ? `Yes — about ${money(headroom)} of working-capital budget remains after this month's portfolio (${money(funded)} funded of ${money(Math.round(budget))}).`
        : `No — the portfolio already uses ${money(funded)} of a ${money(Math.round(budget))} budget. Shift the mix toward factoring to raise the budget by up to ${money(Math.round(G.opportunities.reduce((s, o) => s + o.capital, 0) * 0.8 * 2.5))}.`;
    }
    if (/risk/.test(t) && /biggest|main|top|major/.test(t)) {
      const rows = [['FX', r.fx], ['Credit', r.credit], ['Supply chain', r.supply], ['Financing', r.financing]].sort((a, b) => b[1] - a[1]);
      const tip = rows[0][0] === 'FX' ? 'consider hedging more USD exposure'
        : rows[0][0] === 'Credit' ? 'tighten customer terms or factor receivables'
          : rows[0][0] === 'Supply chain' ? 'diversify suppliers and lock freight' : 'reduce leverage or shift the financing mix';
      return `Biggest risks: ${rows.map((x) => `${x[0]} ${x[1]}/100`).join(' · ')} (overall ${r.score}/100). Top driver is ${rows[0][0]} — ${tip}.`;
    }
    if (/working capital|improve|warning|action/.test(t)) {
      return `Working-capital position: receivables ${money(f.ar)}, payables ${money(f.ap)}, inventory ${money(c.inventory)} → requirement ${money(f.wcReq)} (cash conversion cycle ~${f.ccc} days). ${liquidityActions(f, G).join(' ')}`;
    }
    return 'I can answer: 3-month cash needs, most profitable imports/exports, China sourcing, best export market, factoring vs bank financing, USD scenarios, customer credit risk, new contract affordability, biggest risks, and working-capital actions. Every figure comes from the financial engine; assumptions are stated in each answer.';
  }

  /* ---------- UI pages ---------- */
  function cashflowPage(el, G, sel) {
    const f = cashflowForecast(G, sel);
    const acts = liquidityActions(f, G);
    const rows = f.series.map((s) => {
      const short = s.cash < f.buffer;
      return `<tr${short ? ' class="warn"' : ''}><td>W${s.week}</td><td>${money(s.cash)}</td><td>${short ? money(f.buffer - s.cash) + ' gap' : '—'}</td></tr>`;
    }).join('');
    el.innerHTML =
      title(G, 'Cash flow & working capital', '13-week cash forecast, working-capital requirements and liquidity warnings — simulated company data.', 'CASH FLOW') +
      `<div class="metrics">${metric('Cash', money(G.company.cash), 'Current position')}${metric('13-wk low', money(f.minCash), 'Forecast minimum')}${metric('Buffer need', money(f.buffer), '4 weeks of outflows')}${metric('WC required', money(f.wcReq), 'AR + inventory − AP')}</div>
      <div class="grid cf-grid">
        <div class="card"><h2>13-week cash forecast</h2><p class="sub">Expected cash balance per week under the current plan — forecast, not actuals.</p>
          <table class="big"><tr><th>Week</th><th>Forecast cash</th><th>Vs buffer</th></tr>${rows}</table></div>
        <div class="card"><h2>Working capital</h2><p class="sub">Estimated from revenue and the financing mix.</p>
          <table><tr><td>Receivables (AR)</td><td><b>${money(f.ar)}</b></td></tr><tr><td>Payables (AP)</td><td><b>${money(f.ap)}</b></td></tr><tr><td>Inventory</td><td><b>${money(G.company.inventory)}</b></td></tr><tr><td>Working-capital req.</td><td><b>${money(f.wcReq)}</b></td></tr><tr><td>Cash conversion cycle</td><td><b>~${f.ccc} days</b></td></tr></table>
          <p class="sub" style="margin-top:12px">Inflows ${money(Math.round(f.revenue))}/mo · Outflows ${money(Math.round(f.weeklyOut * 4.33))}/mo · Net ${signedMoney(f.netMonthly)}/mo</p></div>
      </div>
      <div class="card"><h2>Liquidity actions</h2>${acts.map((a) => `<div class="lesson"><p>${a}</p></div>`).join('')}
        <p class="sub" style="margin-top:12px">${f.gaps.length ? `⚠ ${f.gaps.length} week(s) fall below the buffer — act before advancing.` : 'No liquidity gap detected over the next 13 weeks.'}</p></div>`;
  }

  const CHAT_QUESTIONS = [
    'How much cash will we need over the next three months?',
    'Which import transactions are most profitable?',
    'Should we increase imports from China?',
    'Which export market offers the highest risk-adjusted return?',
    'Should we use factoring or bank financing?',
    'What happens if the USD appreciates by 10%?',
    'Which customers represent the highest credit risk?',
    'Can we afford to accept this new export contract?',
    'What are the biggest financial risks facing the company?',
    'How can we improve our working-capital position?',
  ];
  let chat = [];

  function advisorPage(el, G, sel) {
    const body = chat.map((msg) => `<div class="chat-msg ${msg.who}"><b>${msg.who === 'user' ? 'You' : 'AI CFO'}</b><p>${msg.text}</p></div>`).join('');
    el.innerHTML =
      title(G, 'AI CFO advisor', 'Conversational decision support — every number is computed by the financial engine. Advisory only.', 'AI CFO') +
      `<div class="card chat-card"><div class="chat-log">${body || '<p class="sub">Ask about cash, imports, exports, financing, risk or scenarios.</p>'}</div>
      <div class="chat-chips" id="chat-chips"></div>
      <div class="chat-input"><input id="chat-q" placeholder="Ask the AI CFO…" /><button id="chat-send" class="primary">Ask</button></div>
      <p class="sub">Advisory only — the AI never executes payments, borrowing or trading. Assumptions are stated with each answer.</p></div>`;
    const send = () => {
      const input = el.querySelector('#chat-q');
      const q = (input.value || '').trim();
      if (!q) return;
      chat.push({ who: 'user', text: q });
      chat.push({ who: 'bot', text: advisorAnswer(G, sel, q) });
      advisorPage(el, G, sel);
    };
    el.querySelector('#chat-send').onclick = send;
    el.querySelector('#chat-q').onkeydown = (e) => { if (e.key === 'Enter') send(); };
    const chipsEl = el.querySelector('#chat-chips');
    CHAT_QUESTIONS.forEach((q, i) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = q;
      b.onclick = () => {
        chat.push({ who: 'user', text: q });
        chat.push({ who: 'bot', text: advisorAnswer(G, sel, q) });
        advisorPage(el, G, sel);
      };
      chipsEl.appendChild(b);
    });
  }

  let activeScenario = null;

  function scenariosPage(el, G, sel) {
    const baseRisk = CFO.risks(G).score;
    const btns = SCENARIOS.map((s) => `<button class="market-pick${activeScenario === s.id ? ' selected' : ''}" data-sc="${s.id}">${s.label}</button>`).join('');
    let detail = '<p class="sub">Select a scenario to see its impact versus the baseline forecast.</p>';
    if (activeScenario) {
      const sc = SCENARIOS.find((s) => s.id === activeScenario);
      const res = runScenario(G, sel, sc);
      const fBase = cashflowForecast(G, sel);
      const fScen = cashflowForecast(res.st, sel);
      detail = `<div class="metrics">
        ${metric('Δ Expected profit', signedMoney(res.deltaProfit), `${signedMoney(res.base.profit)} → ${signedMoney(res.scen.profit)}`)}
        ${metric('Δ Financing cost', signedMoney(res.deltaFinancing), 'Scenario vs baseline')}
        ${metric('Δ Risk score', (res.deltaRisk > 0 ? '+' : '') + res.deltaRisk, `${res.baseRisk} → ${res.scenRisk}`)}
        ${metric('Δ 13-wk low cash', signedMoney(fScen.minCash - fBase.minCash), `${money(fBase.minCash)} → ${money(fScen.minCash)}`)}
      </div>
      <div class="card"><h2>Recommended response</h2><p class="sub">${sc.response}</p></div>
      <p class="sub">Hypothetical scenario — simulated market shock, not a prediction.</p>`;
    }
    el.innerHTML =
      title(G, 'Scenario analysis', 'Stress-test the plan against market shocks — hypothetical outputs, clearly labeled.', 'SCENARIOS') +
      `<div class="card"><h2>Shock scenarios</h2><p class="sub">A shock is applied to a copy of this month's market and the engine re-run.</p><div class="scenario-grid">${btns}</div></div>${detail}`;
    el.querySelectorAll('[data-sc]').forEach((b) => {
      b.onclick = () => {
        activeScenario = activeScenario === b.dataset.sc ? null : b.dataset.sc;
        scenariosPage(el, G, sel);
      };
    });
  }

  window.CFOPLATFORM = {
    cashflowPage, advisorPage, scenariosPage,
    cashflowForecast, liquidityActions, runScenario, advisorAnswer, SCENARIOS,
  };
})();
