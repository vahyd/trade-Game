/* Trade CFO Simulator — game engine (pure JS, no DOM).
   Three-agent decision model:
     - Agent A  : Working Capital Management    (inventory + credit terms policy)
     - Agent B  : Currency & Hedging            (cost & risk adjuster)
     - Agent C  : Financing                     (cash / debt / factoring funding mix)
   Each month a portfolio of ranked opportunities is generated; the agents score
   every opportunity and the engine selects the capital-efficient combination.
   Expected Economic Profit = PnL − Capital Charge (funding cost) − Hedge Cost − Residual Risk Penalty.
*/
'use strict';
(function (global) {
  const TOTAL_MONTHS = 12;
  const STARTING = {
    cash: 5000000, debt: 2000000, inventory: 3000000, monthlyRevenue: 1000000,
    employees: 20, markets: ['Europe'], suppliers: ['China'], ownership: 1,
    creditRating: 'BBB', riskScore: 30,
  };
  const COGS_RATIO = 0.55;
  const SALARY_PER_EMPLOYEE = 9000;
  const FIXED_OVERHEAD = 175000;
  const BASE_SHIPPING = 70000;
  const INVENTORY_CARRY_RATE = 0.01;
  const IMPORT_MARGIN = 0.10;
  const EXPORT_MARGIN = 0.07;
  const DEFAULT_LOSS_RATE = 0.85;      // share of a receivable written off on default
  const INTEREST_RATE = { AAA: 0.0025, AA: 0.003, A: 0.0035, BBB: 0.004, BB: 0.006, B: 0.009, CCC: 0.014, D: 0.025 };
  const SCORING_WEIGHTS = { cashGrowth: 0.12, profitGrowth: 0.12, riskManagement: 0.54, creditRating: 0.12, survival: 0.10 };
  const BANKRUPTCY_CASH_FLOOR = -1000000;

  /* ---------- Agent parameters ---------- */
  const HEDGE_FEE_RATE = 0.005;      // cost of hedging per $ of exposure
  const FX_RISK_FACTOR = 1.0;        // residual FX risk penalty multiplier
  const SHORT_RATE = 0.004;          // liquidity cost of tying up cash
  const HIGH_DEFAULT_RISK = 0.3;      // Agent A threshold for a "limited" flag

  // Agent A working-capital postures — inventory target + credit terms + cash reserve
  const WC_POSTURES = {
    lean:       { limit: 0.4, floor: 0.25, invMult: 2.0, creditEase: -0.10, demandShift: -6 },
    balanced:   { limit: 0.6, floor: 0.15, invMult: 3.0, creditEase: 0.00, demandShift: 0 },
    aggressive: { limit: 0.8, floor: 0.05, invMult: 4.0, creditEase: 0.10, demandShift: 6 },
  };
  // Currencies traded — volatility factor relative to USD.
  const CURRENCY_FX = { USD: 1.0, EUR: 0.9, CNY: 0.4 };
  const FACTORING_FEE_RATE = 0.006;
  const FUNDING_MODES = {
    cash:      { label: 'Cash',      budgetMult: 1.0, riskAdd: 0 },
    debt:      { label: 'Debt',      budgetMult: 3.0, riskAdd: 3 },
    factoring: { label: 'Factoring', budgetMult: 3.5, riskAdd: -18 },
  };
  // Financing mix — three source shares (cash / debt / factoring) that always sum to 1.
  function financingPlan(company, market, totalCapital, shares) {
    const debtRate = INTEREST_RATE[company.creditRating] + (market.interestSurcharge || 0);
    const cashRate = SHORT_RATE;
    const factoringRate = FACTORING_FEE_RATE;
    const c = clamp(shares.cash || 0, 0, 1);
    const d = clamp(shares.debt || 0, 0, 1);
    const f = clamp(shares.factoring || 0, 0, 1);
    const sum = (c + d + f) || 1;
    const cash = c / sum, debt = d / sum, factoring = f / sum;
    return {
      debtShare: debt, cashShare: cash, factoringShare: factoring,
      debtRate, cashRate, factoringRate,
      wacc: debt * debtRate + cash * cashRate + factoring * factoringRate,
      budgetMult: cash * 1 + debt * 3 + factoring * 3.5,
      riskAdd: debt * 3 + factoring * -18,
      debtAmount: totalCapital * debt,
      cashAmount: totalCapital * cash,
      factoringAmount: totalCapital * factoring,
    };
  }
  // Recommended cash / debt / factoring shares (fractions summing to 1).
  // Factoring is favored because it transfers receivables default risk and is now cheap.
  function recommendShares(company, market, totalCapital) {
    const rate = INTEREST_RATE[company.creditRating] + (market.interestSurcharge || 0);
    const cashMax = totalCapital > 0 ? (company.cash * 0.5) / totalCapital : 0;
    const cash = Math.min(0.30, cashMax);
    // Grow factoring with default risk (recession) — it removes receivables risk.
    const factoring = clamp(0.35 + market.recessionRisk / 200, 0.35, 0.55);
    const debt = clamp(1 - cash - factoring, 0, 1);
    // If borrowing is expensive, shift debt into factoring instead.
    const expensive = rate > FACTORING_FEE_RATE;
    const d = expensive ? Math.min(debt, 0.30) : debt;
    return { cash, debt: d, factoring: clamp(1 - cash - d, 0, 1) };
  }
  // Convert a { cash, debt, factoring } percentage object (0–100 each) to fractions.
  function sharesFromPct(pct) {
    return {
      cash: clamp(pct.cash != null ? pct.cash : 0, 0, 100) / 100,
      debt: clamp(pct.debt != null ? pct.debt : 0, 0, 100) / 100,
      factoring: clamp(pct.factoring != null ? pct.factoring : 0, 0, 100) / 100,
    };
  }
  // Round a fraction triplet into integer percentages that sum to exactly 100.
  function pctTriplet(cash, debt, factoring) {
    const v = [cash, debt, factoring].map((x) => Math.round(x * 100));
    const diff = 100 - (v[0] + v[1] + v[2]);
    if (diff !== 0) {
      const idx = v.indexOf(Math.max(v[0], v[1], v[2]));
      v[idx] += diff;
    }
    return { cash: v[0], debt: v[1], factoring: v[2] };
  }

  /* ---------- RNG ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function createRng(seed) {
    const r = mulberry32(seed);
    return {
      next: r,
      float: (a, b) => a + r() * (b - a),
      int: (a, b) => Math.floor(r() * (b - a + 1)) + a,
      pick: (a) => a[Math.floor(r() * a.length)],
      chance: (p) => r() < p,
    };
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function round1(n) { return Math.round(n * 10) / 10; }
  function monthSeed(seed, month) { return (seed ^ Math.imul(month + 1, 2654435761)) >>> 0; }
  function money(n) {
    const s = n < 0 ? '-' : '';
    const a = Math.abs(n);
    if (a >= 1000000) return s + '$' + (a / 1000000).toFixed(1) + 'M';
    if (a >= 10000) return s + '$' + Math.round(a / 1000) + 'K';
    if (a >= 1000) return s + '$' + (a / 1000).toFixed(1) + 'K';
    return s + '$' + Math.round(a);
  }
  function signedMoney(n) { return (n >= 0 ? '+' : '−') + money(Math.abs(n)); }

  /* ---------- Events ---------- */
  const EVENTS = [
    { id: 'recession', cat: 'Economic', name: 'Recession', desc: 'The economy contracts sharply; demand drops and recession risk spikes.', impact: 'negative', effects: { demand: -32, recession: 40 } },
    { id: 'inflation-shock', cat: 'Economic', name: 'Inflation shock', desc: 'Input prices surge, raising your cost of goods sold.', impact: 'negative', effects: { costPressure: 0.09, demand: -10 } },
    { id: 'rate-hike', cat: 'Economic', name: 'Interest-rate hike', desc: 'The central bank raises rates, increasing your borrowing costs.', impact: 'negative', effects: { interestSurcharge: 0.008, demand: -10 } },
    { id: 'banking-crisis', cat: 'Economic', name: 'Banking crisis', desc: 'Credit markets seize up; default risk and currency stress spike.', impact: 'negative', effects: { recession: 35, usdChange: 0.06 } },
    { id: 'trade-war', cat: 'Geopolitical', name: 'Trade war', desc: 'Tit-for-tat tariffs hit your markets and soften demand.', impact: 'negative', effects: { tariff: 0.14, demand: -16 } },
    { id: 'sanctions', cat: 'Geopolitical', name: 'Sanctions', desc: 'New sanctions disrupt trade routes and raise tariffs.', impact: 'negative', effects: { tariff: 0.09, shipping: 0.25 } },
    { id: 'tariff-increase', cat: 'Geopolitical', name: 'Tariff increases', desc: 'Import tariffs are raised across the board.', impact: 'negative', effects: { tariff: 0.11 } },
    { id: 'trade-agreement', cat: 'Geopolitical', name: 'New trade agreement', desc: 'A new pact lowers tariffs and lifts demand.', impact: 'positive', effects: { tariff: -0.09, demand: 14 } },
    { id: 'cyberattack', cat: 'Operational', name: 'Cyberattack', desc: 'A cyberattack disrupts operations, adding costs and slowing sales.', impact: 'negative', effects: { costPressure: 0.05, demand: -10 } },
    { id: 'supplier-bankruptcy', cat: 'Operational', name: 'Supplier bankruptcy', desc: 'A key supplier goes under, tightening supply and raising freight costs.', impact: 'negative', effects: { shipping: 0.32, demand: -10 } },
    { id: 'port-closure', cat: 'Operational', name: 'Port closure', desc: 'A major port shuts down, sending shipping costs soaring.', impact: 'negative', effects: { shipping: 0.5, demand: -14 } },
    { id: 'labor-strike', cat: 'Operational', name: 'Labor strike', desc: 'Dock workers strike, slowing shipments and raising costs.', impact: 'negative', effects: { shipping: 0.25, costPressure: 0.04 } },
  ];

  /* ---------- Market ---------- */
  function generateMarket(rng, prev) {
    if (!prev) {
      return {
        usdChange: rng.float(-0.06, 0.06),
        shippingMultiplier: clamp(1 + rng.float(-0.25, 0.25), 0.6, 1.5),
        tariffRate: rng.chance(0.35) ? rng.float(0.05, 0.15) : 0,
        demandIndex: rng.int(45, 95),
        recessionRisk: rng.int(5, 55),
        interestSurcharge: 0,
        costPressure: 0,
      };
    }
    const usdChange = clamp(prev.usdChange * 0.2 + rng.float(-0.05, 0.05), -0.12, 0.12);
    const shippingMultiplier = clamp(1 + (prev.shippingMultiplier - 1) * 0.35 + rng.float(-0.28, 0.28), 0.5, 1.9);
    let tariffRate = prev.tariffRate;
    if (rng.chance(0.3)) tariffRate = clamp(tariffRate + rng.float(0.05, 0.14), 0, 0.5);
    else if (rng.chance(0.3)) tariffRate = clamp(tariffRate - rng.float(0.02, 0.08), 0, 0.5);
    const demandIndex = clamp(prev.demandIndex + rng.float(-26, 26), 10, 100);
    const recessionRisk = clamp(prev.recessionRisk + rng.float(-25, 25), 0, 100);
    return { usdChange, shippingMultiplier, tariffRate, demandIndex, recessionRisk, interestSurcharge: 0, costPressure: 0 };
  }

  function generateNews(rng, market, month) {
    const { usdChange, shippingMultiplier, tariffRate, demandIndex, recessionRisk } = market;
    const items = [];
    if (usdChange > 0.03) items.push({ headline: 'USD strengthens sharply against major currencies', impact: 'negative' });
    else if (usdChange < -0.03) items.push({ headline: 'USD weakens as markets shift risk appetite', impact: 'positive' });
    else items.push({ headline: 'USD trades in a narrow range this month', impact: 'neutral' });
    if (shippingMultiplier > 1.2) items.push({ headline: 'Container shipping costs surge on capacity shortages', impact: 'negative' });
    else if (shippingMultiplier < 0.85) items.push({ headline: 'Freight rates fall as new vessel capacity arrives', impact: 'positive' });
    if (tariffRate > 0.1) items.push({ headline: 'New import tariff announced (' + Math.round(tariffRate * 100) + '%)', impact: 'negative' });
    if (recessionRisk > 60) items.push({ headline: 'Economists warn of a possible recession', impact: 'negative' });
    else if (recessionRisk < 20) items.push({ headline: 'Economic outlook improves across key markets', impact: 'positive' });
    if (demandIndex > 82) items.push({ headline: 'Strong customer demand reported in your markets', impact: 'positive' });
    else if (demandIndex < 45) items.push({ headline: 'Customer demand softens this month', impact: 'negative' });
    if (rng.chance(0.12)) items.push({ headline: 'A major industry customer defaults on payments', impact: 'negative' });
    return items;
  }

  function pickEvent(rng, prevId) {
    let pool = EVENTS.filter((e) => e.id !== prevId);
    if (!pool.length) pool = EVENTS;
    return pool[Math.floor(rng.next() * pool.length)];
  }
  function applyEvent(market, evt) {
    const fx = evt.effects;
    if (fx.usdChange) market.usdChange += fx.usdChange;
    if (fx.shipping) market.shippingMultiplier += fx.shipping;
    if (fx.tariff) market.tariffRate = Math.max(0, market.tariffRate + fx.tariff);
    if (fx.demand) market.demandIndex += fx.demand;
    if (fx.recession) market.recessionRisk += fx.recession;
    if (fx.interestSurcharge) market.interestSurcharge += fx.interestSurcharge;
    if (fx.costPressure) market.costPressure += fx.costPressure;
    market.usdChange = clamp(market.usdChange, -0.2, 0.2);
    market.shippingMultiplier = clamp(market.shippingMultiplier, 0.6, 2.0);
    market.tariffRate = clamp(market.tariffRate, 0, 0.5);
    market.demandIndex = clamp(market.demandIndex, 10, 100);
    market.recessionRisk = clamp(market.recessionRisk, 0, 100);
  }

  /* ---------- Opportunities (portfolio) ---------- */
  function makeOpp(id, type, title, description, expectedPnL, capital, creditRisk, fxExposure, extra) {
    return Object.assign({ id, type, title, description, expectedPnL, capital, creditRisk, fxExposure, currency: 'USD' }, extra);
  }

  function generateOpportunities(rng, company, market, month) {
    const demand = market.demandIndex / 100;
    const usd = market.usdChange;
    const fxFor = (ccy) => usd * (CURRENCY_FX[ccy] || 1);
    const opps = [];

    // Import — buy from specific-currency suppliers.
    const importValue = 1000000;
    opps.push(makeOpp('import-usd-' + month, 'import', 'Import from USD supplier',
      `Buy ${money(importValue)} of goods from your USD supplier and resell at a ${Math.round(IMPORT_MARGIN * 100)}% margin.`,
      round1(importValue * IMPORT_MARGIN), importValue, 0, importValue,
      { currency: 'USD', fxChange: fxFor('USD') }));
    const importValueCny = 800000;
    opps.push(makeOpp('import-cny-' + month, 'import', 'Import from CNY supplier',
      `Buy ${money(importValueCny)} of goods from your CNY supplier and resell at a ${Math.round(IMPORT_MARGIN * 100)}% margin.`,
      round1(importValueCny * IMPORT_MARGIN), importValueCny, 0, importValueCny,
      { currency: 'CNY', fxChange: fxFor('CNY') }));

    // Exports — sell to specific-currency buyers.
    const specs = [
      { ccy: 'USD', mult: 1.5 },
      { ccy: 'EUR', mult: 1.2 },
      { ccy: 'CNY', mult: 1.1 },
    ];
    specs.forEach((s) => {
      const value = round1(s.mult * 1000000 * (0.8 + demand * 0.3));
      const risk = clamp(0.06 + market.recessionRisk * 0.0011, 0.02, 0.3);
      const pnl = round1(value * (EXPORT_MARGIN * (1 - risk) - DEFAULT_LOSS_RATE * risk));
      opps.push(makeOpp(`export-${s.ccy.toLowerCase()}-${month}`, 'export', `Export to ${s.ccy} buyer`,
        `Sell ${money(value)} of goods to a ${s.ccy}-paying buyer.`,
        pnl, value, round1(risk), value, { currency: s.ccy, fxChange: fxFor(s.ccy) }));
    });

    return opps;
  }

  /* ---------- Agent A : Working Capital Management (Principle 2) ---------- */
  function agentAFlag(company, opp, posture) {
    const cap = opp.capital || 0;
    if (cap > company.cash) return 'REJECTED';
    if (cap > company.cash * posture.limit) return 'LIMITED';
    const risk = opp.creditRisk + (posture.creditEase || 0);
    if (risk > HIGH_DEFAULT_RISK) return 'LIMITED';
    return 'APPROVED';
  }
  function agentAScore(company, opp, posture) {
    const cap = opp.capital || 0;
    let score = cap > 0 ? clamp(Math.round(100 - (cap / Math.max(company.cash, 1)) * 100), 0, 100) : 100;
    const risk = opp.creditRisk + (posture.creditEase || 0);
    if (risk > 0.2) score = clamp(score - 12, 0, 100);
    return score;
  }

  function econProfit(opp, fxPenalty, wacc) {
    const cap = opp.capital || 0;
    return opp.expectedPnL - cap * wacc - fxPenalty;
  }

  /* Evaluate every opportunity under a given posture + weighted cost of capital. */
  function evaluateAll(company, market, opps, posture, wacc) {
    opps.forEach((o) => {
      const expo = o.fxExposure || 0;
      const fxPenalty = expo * Math.abs(o.fxChange || 0) * FX_RISK_FACTOR;
      o.eval = {
        flagA: agentAFlag(company, o, posture),
        scoreA: agentAScore(company, o, posture),
        fxPenalty,
        economicProfit: econProfit(o, fxPenalty, wacc),
      };
    });
  }

  /* Select the capital-efficient mix that maximizes economic profit within budget. */
  function selectPortfolio(company, opps, posture, budgetMult) {
    const budget = company.cash * (1 - posture.floor) * budgetMult;
    const included = new Set();
    const eligible = opps
      .filter((o) => o.eval.flagA !== 'REJECTED' && o.eval.economicProfit > 0)
      .slice()
      .sort((a, b) => b.eval.economicProfit - a.eval.economicProfit);
    let used = 0;
    eligible.forEach((o) => {
      if (used + (o.capital || 0) <= budget) { included.add(o.id); used += o.capital || 0; }
    });
    return { included, budget, funded: used };
  }

  /* ---------- Three-agent trade strategy model ---------- */
  const FOCUS_BOOST = 0.60;   // margin uplift for the focused export market
  const EXPORT_MARKET_OPTIONS = [
    { id: 'mk-us', label: 'USA', demandShift: 2, marketRisk: 3, focus: 'USD' },
    { id: 'mk-eu', label: 'Europe', demandShift: 2, marketRisk: 3, focus: 'EUR' },
    { id: 'mk-cn', label: 'China', demandShift: 2, marketRisk: 3, focus: 'CNY' },
  ];
  const IMPORT_SOURCING_OPTIONS = [
    { id: 'so-cn', label: 'China · low cost', cogsAdj: -0.04, supplyRisk: 9 },
    { id: 'so-vn', label: 'Vietnam · balanced', cogsAdj: 0, supplyRisk: 0 },
    { id: 'so-mx', label: 'Mexico · nearshore', cogsAdj: 0.04, supplyRisk: -7 },
  ];

  function pick(list, id) { return list.find((o) => o.id === id) || list[0]; }

  function resolveActions(selections) {
    const ex = (selections && selections.export) || {};
    const im = (selections && selections.import) || {};
    const markets = (Array.isArray(ex.market) && ex.market.length) ? ex.market : ['mk-eu'];
    const sources = (Array.isArray(im.sourcing) && im.sourcing.length) ? im.sourcing : ['so-vn'];

    let marketShift = 0, marketRisk = 0;
    const focusCcys = new Set();
    markets.forEach((id) => {
      const mk = pick(EXPORT_MARKET_OPTIONS, id);
      marketShift += mk.demandShift || 0;
      marketRisk += mk.marketRisk || 0;
      if (mk.focus) focusCcys.add(mk.focus);
    });

    let cogsAdj = 0, supplyRisk = 0;
    sources.forEach((id) => {
      const so = pick(IMPORT_SOURCING_OPTIONS, id);
      cogsAdj += so.cogsAdj || 0;
      supplyRisk += so.supplyRisk || 0;
    });

    return {
      priceAdj: 0,
      marketShift,
      marketRisk,
      focusCcys,
      exportRiskAdj: 0,
      cogsAdj,
      supplyRisk,
      carryAdj: 0,
      dpoBenefit: 0,
      liquidityRisk: 0,
      fxFinancingRisk: 0,
      rateAdj: 0,
    };
  }

  function recommendedMarkets(market) {
    const map = { USD: 'mk-us', EUR: 'mk-eu', CNY: 'mk-cn' };
    const scored = Object.keys(map)
      .map((ccy) => ({ id: map[ccy], fx: (market.usdChange || 0) * (CURRENCY_FX[ccy] || 1) }))
      .sort((a, b) => b.fx - a.fx);
    const rec = scored.filter((s) => s.fx > 0).map((s) => s.id);
    if (!rec.length) rec.push(scored[0].id);
    return rec.slice(0, 2);
  }

  function recommendedSources(market) {
    const supplyStress = market.shippingMultiplier > 1.3 || market.tariffRate > 0.1;
    return supplyStress ? ['so-mx'] : ['so-cn', 'so-vn'];
  }

  function defaultSelections(company, market, totalCapital) {
    const rs = recommendShares(company, market, totalCapital);
    const shares = pctTriplet(rs.cash, rs.debt, rs.factoring);
    return {
      export: { market: recommendedMarkets(market) },
      import: { sourcing: recommendedSources(market) },
      finance: { A: { cash: shares.cash, debt: shares.debt, factoring: shares.factoring } },
    };
  }

  function aggressiveSelections() {
    return {
      export: { market: ['mk-cn', 'mk-us'] },
      import: { sourcing: ['so-cn'] },
      finance: { A: { cash: 10, debt: 80, factoring: 10 } },
    };
  }

  function conservativeSelections() {
    return {
      export: { market: ['mk-eu'] },
      import: { sourcing: ['so-mx'] },
      finance: { A: { cash: 60, debt: 20, factoring: 20 } },
    };
  }

  function projectMonth(company, market, opps, selections) {
    const totalCapital = opps.reduce((s, o) => s + (o.capital || 0), 0);
    const shares = sharesFromPct(selections.finance.A);
    const plan = financingPlan(company, market, totalCapital, shares);
    const posture = WC_POSTURES.balanced;
    evaluateAll(company, market, opps, posture, plan.wacc);
    const included = selectPortfolio(company, opps, posture, plan.budgetMult).included;
    const funded = [...included].reduce((s, id) => s + (opps.find((o) => o.id === id)?.capital || 0), 0);
    const mods = resolveActions(selections);

    let decisionProfit = 0, fxImpact = 0;
    opps.forEach((o) => {
      if (!included.has(o.id)) return;
      const fx = (o.fxExposure || 0) * (o.fxChange || 0);
      if (o.type === 'import') {
        decisionProfit += o.capital * IMPORT_MARGIN;
        fxImpact -= fx;
      } else {
        const margin = o.capital * EXPORT_MARGIN * (1 + mods.priceAdj) * (mods.focusCcys.has(o.currency) ? 1 + FOCUS_BOOST : 1);
        const risk = clamp(o.creditRisk + (posture.creditEase || 0) + mods.exportRiskAdj, 0, 0.9) * (1 - plan.factoringShare);
        decisionProfit += margin - o.capital * DEFAULT_LOSS_RATE * risk;
        fxImpact += fx;
      }
    });

    const adjDemand = clamp(market.demandIndex + (posture.demandShift || 0) + mods.marketShift, 0, 100);
    const demandMultiplier = 0.8 + (adjDemand / 100) * 0.4;
    const revenue = company.monthlyRevenue * demandMultiplier;
    const cogs = revenue * (COGS_RATIO + market.costPressure + mods.cogsAdj);
    const salaries = company.employees * SALARY_PER_EMPLOYEE;
    const overhead = FIXED_OVERHEAD;
    const shipping = BASE_SHIPPING * market.shippingMultiplier;
    const debtForInterest = company.debt + funded * plan.debtShare;
    const interest = debtForInterest * (INTEREST_RATE[company.creditRating] + market.interestSurcharge + mods.rateAdj);
    const carrying = company.inventory * (INVENTORY_CARRY_RATE + mods.carryAdj);
    const tariff = cogs * market.tariffRate;
    const operatingProfit = revenue - cogs - salaries - overhead - shipping - interest - carrying - tariff;
    const profit = operatingProfit + fxImpact + decisionProfit + mods.dpoBenefit;

    const assets = company.cash + company.inventory;
    const leverage = company.debt / Math.max(assets, 1);
    let risk = 25 + clamp(leverage, 0, 1) * 45;
    risk += plan.riskAdd;
    risk += market.recessionRisk * 0.15;
    risk += mods.marketRisk + mods.supplyRisk + mods.liquidityRisk + mods.fxFinancingRisk;
    risk = clamp(Math.round(risk), 0, 100);

    return { profit: Math.round(profit), risk };
  }

  function buildScenarios(company, market, opps, current) {
    const totalCapital = opps.reduce((s, o) => s + (o.capital || 0), 0);
    const defs = [
      { id: 'current', label: 'Current', sel: current },
      { id: 'rec', label: 'Recommended', sel: defaultSelections(company, market, totalCapital) },
      { id: 'aggr', label: 'Aggressive', sel: aggressiveSelections() },
      { id: 'safe', label: 'Conservative', sel: conservativeSelections() },
    ];
    return defs.map((d) => {
      const p = projectMonth(company, market, opps, d.sel);
      return { id: d.id, label: d.label, profit: p.profit, risk: p.risk, selections: d.sel };
    });
  }

  function buildDecision(state, selections) {
    const company = state.company, market = state.market, opps = state.opportunities;
    const totalCapital = opps.reduce((s, o) => s + (o.capital || 0), 0);
    const sel = selections || defaultSelections(company, market, totalCapital);
    const rec = defaultSelections(company, market, totalCapital);

    const plan = financingPlan(company, market, totalCapital, sharesFromPct(sel.finance.A));
    const posture = WC_POSTURES.balanced;
    evaluateAll(company, market, opps, posture, plan.wacc);
    const trades = [...selectPortfolio(company, opps, posture, plan.budgetMult).included];

    // Keep the capital/trade pages in sync with the current financing mix.
    state.agentActions = generateAgentActions(company, market, opps, { A: sel.finance.A });

    const agents = {
      export: {
        name: 'Export Optimization', objective: 'Maximize export revenue × gross margin', metric: 'Incremental profit',
        inputs: ['Sales by market', 'Product margins', 'Market growth', 'Currency strength'],
        actions: [
          { key: 'market', label: 'Market reallocation', options: EXPORT_MARKET_OPTIONS, selectedIds: [...sel.export.market], recommendedIds: [...rec.export.market] },
        ],
      },
      import: {
        name: 'Import Optimization', objective: 'Minimize landed cost + supply risk', metric: 'Cost savings − supply risk',
        inputs: ['Supplier prices', 'Freight costs', 'Duties / tariffs', 'Country risk'],
        actions: [
          { key: 'sourcing', label: 'Shift sourcing', options: IMPORT_SOURCING_OPTIONS, selectedIds: [...sel.import.sourcing], recommendedIds: [...rec.import.sourcing] },
        ],
      },
      finance: {
        name: 'Financing & Working Capital', objective: 'Minimize financing cost + liquidity + FX risk', metric: 'Financing savings − risk penalty',
        inputs: ['Cash balance', 'Debt balance', 'Factoring rates', 'Interest by currency'],
        plan: {
          cashAmount: plan.cashAmount, debtAmount: plan.debtAmount, factoringAmount: plan.factoringAmount,
          cashRate: plan.cashRate, debtRate: plan.debtRate, factoringRate: plan.factoringRate, wacc: plan.wacc,
        },
        shares: { cash: sel.finance.A.cash, debt: sel.finance.A.debt, factoring: sel.finance.A.factoring },
        actions: [],
      },
    };

    return { agents, scenarios: buildScenarios(company, market, opps, sel), trades };
  }

  function generateAgentActions(company, market, opps, selections) {
    const sel = selections || {};
    const totalCapital = opps.reduce((s, o) => s + (o.capital || 0), 0);
    const recShares = recommendShares(company, market, totalCapital);
    const shares = sel.A != null ? sharesFromPct(sel.A) : recShares;
    const plan = financingPlan(company, market, totalCapital, shares);
    const posture = WC_POSTURES.balanced;
    evaluateAll(company, market, opps, posture, plan.wacc);
    opps.forEach((o) => { o.rec = { flagA: o.eval.flagA, scoreA: o.eval.scoreA, econ: o.eval.economicProfit }; });
    const { included } = selectPortfolio(company, opps, posture, plan.budgetMult);

    const tradeOptions = opps.map((o) => ({
      id: o.id,
      label: (o.type === 'import' ? 'Import' : 'Export') + ' · ' + o.currency,
      desc: `${money(o.capital)} ${o.currency} · FX ${(o.fxChange >= 0 ? '+' : '') + (o.fxChange * 100).toFixed(1)}%`,
      recommended: o.eval.economicProfit > 0,
    }));

    return {
      A: {
        key: 'A', agent: 'Capital', principle: 'Financing mix',
        summary: `Required ${money(totalCapital)} · recommends cash ${Math.round(recShares.cash * 100)}% / debt ${Math.round(recShares.debt * 100)}% / factoring ${Math.round(recShares.factoring * 100)}%.`,
        recommended: pctTriplet(recShares.cash, recShares.debt, recShares.factoring),
        min: 0, max: 100,
        plan: {
          debtShare: Math.round(plan.debtShare * 100),
          cashShare: Math.round(plan.cashShare * 100),
          factoringShare: Math.round(plan.factoringShare * 100),
          debtAmount: plan.debtAmount, cashAmount: plan.cashAmount, factoringAmount: plan.factoringAmount,
          debtRate: plan.debtRate, cashRate: plan.cashRate, factoringRate: plan.factoringRate, wacc: plan.wacc,
        },
      },
      B: {
        key: 'B', agent: 'Trade', principle: 'Select trades',
        summary: `${included.size}/${opps.length} trades fit the budget.`,
        options: tradeOptions,
        recommendedIds: tradeOptions.filter((o) => o.recommended).map((o) => o.id),
      },
    };
  }

  /* ---------- Risk & rating ---------- */
  function ratingFromRisk(risk) {
    if (risk < 20) return 'AA';
    if (risk < 35) return 'A';
    if (risk < 50) return 'BBB';
    if (risk < 65) return 'BB';
    if (risk < 80) return 'B';
    return 'CCC';
  }
  function risks(state) {
    const m = state.market, c = state.company;
    const assets = c.cash + c.inventory;
    const leverage = c.debt / Math.max(assets, 1);
    const fx = clamp(Math.round(Math.abs(m.usdChange) * 1000), 0, 100);
    const credit = clamp(Math.round(m.recessionRisk), 0, 100);
    const supply = clamp(Math.round((m.shippingMultiplier - 1) * 200 + m.tariffRate * 250), 0, 100);
    const financing = clamp(Math.round(leverage * 100), 0, 100);
    const score = Math.round((fx + credit + supply + financing) / 4);
    return { fx, credit, supply, financing, score };
  }

  /* ---------- Resolution ---------- */
  function resolveMonth(rng, company, market, opportunities, selectedIds, posture, plan, month, funded, mods) {
    mods = mods || resolveActions({});
    const factoringShare = plan.factoringShare;
    const debtShare = plan.debtShare;
    const outcomes = [];
    let fxImpact = 0, decisionProfit = 0, stockoutLoss = 0, wasteCost = 0;
    const next = { ...company, markets: [...company.markets], suppliers: [...company.suppliers] };
    const selected = new Set(selectedIds);
    const creditEase = posture.creditEase || 0;

    opportunities.forEach((o) => {
      if (!selected.has(o.id)) return;
      const fxChange = o.fxChange || 0;

      if (o.type === 'import') {
        const margin = o.capital * IMPORT_MARGIN;
        const fx = -o.fxExposure * fxChange;
        fxImpact += fx;
        decisionProfit += margin;
        outcomes.push({ title: 'Import resold', detail: `You bought ${money(o.capital)} of ${o.currency} goods and resold them for a ${money(margin)} margin. FX impact ${money(fx)} on a ${(fxChange * 100).toFixed(1)}% ${o.currency} move.`, good: true });
      } else if (o.type === 'export') {
        const margin = o.capital * EXPORT_MARGIN * (1 + mods.priceAdj) * (mods.focusCcys.has(o.currency) ? 1 + FOCUS_BOOST : 1);
        const risk = clamp(o.creditRisk + creditEase + mods.exportRiskAdj, 0, 0.9) * (1 - factoringShare);
        if (rng.chance(risk)) {
          const loss = o.capital * DEFAULT_LOSS_RATE;
          decisionProfit -= loss;
          outcomes.push({ title: 'Export buyer defaulted', detail: `Your ${o.currency} buyer defaulted on the ${money(o.capital)} export. You wrote off ${money(loss)}.`, good: false });
        } else {
          const fx = o.fxExposure * fxChange;
          fxImpact += fx;
          decisionProfit += margin;
          outcomes.push({ title: 'Export shipped and settled', detail: `You shipped ${money(o.capital)} to the ${o.currency} buyer and earned ${money(margin)}. FX impact ${money(fx)} (${(fxChange * 100).toFixed(1)}% ${o.currency} move).`, good: true });
        }
      }
    });

    // Working-capital rebalancing: move inventory toward the posture's target.
    const invTarget = next.monthlyRevenue * posture.invMult;
    let invDelta = invTarget - next.inventory;
    if (next.inventory + invDelta < 0) invDelta = -next.inventory;
    next.inventory += invDelta;
    next.cash -= invDelta;

    // Financing: the debt portion is short-term working capital, repaid as deals settle.
    const debtForInterest = next.debt + funded * debtShare;

    const demandShift = (posture.demandShift || 0) + mods.marketShift;
    const adjDemand = clamp(market.demandIndex + demandShift, 0, 100);
    const demandMultiplier = 0.8 + (adjDemand / 100) * 0.4;
    const revenue = next.monthlyRevenue * demandMultiplier;
    const cogs = revenue * (COGS_RATIO + market.costPressure + mods.cogsAdj);
    const salaries = next.employees * SALARY_PER_EMPLOYEE;
    const overhead = FIXED_OVERHEAD;
    const shipping = BASE_SHIPPING * market.shippingMultiplier;
    const interest = debtForInterest * (INTEREST_RATE[next.creditRating] + market.interestSurcharge + mods.rateAdj);
    const carrying = next.inventory * (INVENTORY_CARRY_RATE + mods.carryAdj);
    const tariff = cogs * market.tariffRate;

    if (adjDemand > 80 && next.inventory < 1500000) {
      stockoutLoss = revenue * 0.1;
      outcomes.push({ title: 'Stockout — lost sales', detail: `Demand was strong but your inventory was too low. You lost ${money(stockoutLoss)} in missed sales.`, good: false });
    }
    if (adjDemand < 45 && next.inventory > 5000000) {
      wasteCost = next.inventory * 0.005;
      outcomes.push({ title: 'Excess inventory costs', detail: `Demand was weak while you held excess inventory, adding ${money(wasteCost)} in extra storage and spoilage costs.`, good: false });
    }

    const operatingProfit = revenue - cogs - salaries - overhead - shipping - interest - carrying - tariff;
    const profit = operatingProfit + fxImpact + decisionProfit - stockoutLoss - wasteCost + mods.dpoBenefit;
    const cashDelta = operatingProfit + fxImpact + decisionProfit - stockoutLoss - wasteCost + mods.dpoBenefit;
    next.cash += cashDelta;
    next.cumulativeProfit += profit;
    next.monthsSurvived += 1;

    const assets = next.cash + next.inventory;
    const leverage = next.debt / Math.max(assets, 1);
    let risk = 25 + clamp(leverage, 0, 1) * 45;
    const unhedgedFx = opportunities.some((o) => selected.has(o.id) && (o.fxExposure || 0) > 0 && Math.abs(o.fxChange || 0) > 0.04);
    if (unhedgedFx) risk += 15;
    risk += plan.riskAdd;
    risk += market.recessionRisk * 0.15;
    risk += mods.marketRisk + mods.supplyRisk + mods.liquidityRisk + mods.fxFinancingRisk;
    risk = clamp(Math.round(risk), 0, 100);
    next.riskScore = risk;
    next.creditRating = ratingFromRisk(risk);

    return {
      company: next,
      result: {
        month, revenue, cogs, salaries, overhead, shipping, interest, carrying, tariff, fxImpact,
        profit, cashBefore: company.cash, cashAfter: next.cash, debtBefore: company.debt, debtAfter: next.debt,
        creditRating: next.creditRating, riskScore: next.riskScore, outcomes,
      },
    };
  }

  /* ---------- Scoring ---------- */
  const RATING_SCORE = { AAA: 100, AA: 90, A: 80, BBB: 70, BB: 55, B: 40, CCC: 25, D: 0 };
  function computeScore(history, company, bankrupt) {
    const cashGrowth = clamp(((company.cash - STARTING.cash) / STARTING.cash) * 50 + 50, 0, 100);
    const profitTarget = STARTING.cash * 0.5;
    const profitGrowth = clamp((company.cumulativeProfit / profitTarget) * 100, 0, 100);
    const avgRisk = history.length ? history.reduce((s, h) => s + h.riskScore, 0) / history.length : company.riskScore;
    const riskManagement = clamp(100 - avgRisk, 0, 100);
    const creditScore = RATING_SCORE[company.creditRating] ?? 50;
    const survival = bankrupt ? clamp((company.monthsSurvived / TOTAL_MONTHS) * 100, 0, 100) : 100;
    const score = Math.round(
      cashGrowth * SCORING_WEIGHTS.cashGrowth + profitGrowth * SCORING_WEIGHTS.profitGrowth +
      riskManagement * SCORING_WEIGHTS.riskManagement + creditScore * SCORING_WEIGHTS.creditRating +
      survival * SCORING_WEIGHTS.survival
    );
    const ranking = score >= 85 ? 'Expert CFO' : score >= 70 ? 'Good CFO' : score >= 55 ? 'Average CFO' : 'Poor CFO';
    const finalCompanyValue = Math.round((company.cash + company.inventory + (company.expansion || 0) - company.debt) * company.ownership);
    return {
      score, ranking, cashGrowth: Math.round(cashGrowth), profitGrowth: Math.round(profitGrowth),
      riskManagement: Math.round(riskManagement), creditScore: Math.round(creditScore), survival: Math.round(survival),
      finalCompanyValue, totalProfit: Math.round(company.cumulativeProfit), totalCash: Math.round(company.cash),
      riskScore: company.riskScore, creditRating: company.creditRating, monthsSurvived: company.monthsSurvived,
    };
  }

  /* ---------- Game creation ---------- */
  function freshCompany() {
    return {
      cash: STARTING.cash, debt: STARTING.debt, inventory: STARTING.inventory,
      monthlyRevenue: STARTING.monthlyRevenue, employees: STARTING.employees,
      markets: [...STARTING.markets], suppliers: [...STARTING.suppliers], ownership: STARTING.ownership,
      creditRating: STARTING.creditRating, riskScore: STARTING.riskScore,
      cumulativeProfit: 0, monthsSurvived: 0, expansion: 0,
    };
  }
  function beginMonth(state) {
    const rng = createRng(monthSeed(state.seed, state.month));
    state.market = generateMarket(rng, state.month === 1 ? null : state.market);
    state.event = pickEvent(rng, state.event && state.event.id);
    // The event is applied AFTER the player decides (see resolveChoices).
    state.news = generateNews(rng, state.market, state.month);
    state.opportunities = generateOpportunities(rng, state.company, state.market, state.month);
    state.agentActions = generateAgentActions(state.company, state.market, state.opportunities);
  }
  function createGame(seed) {
    const state = {
      agentMode: true, phase: 'playing', month: 1, seed, company: freshCompany(),
      market: { usdChange: 0, shippingMultiplier: 1, tariffRate: 0, demandIndex: 70, recessionRisk: 20, interestSurcharge: 0, costPressure: 0 },
      event: null, news: [], opportunities: [], agentActions: null, history: [], lastResult: null, bankrupt: false, finalScore: null,
    };
    beginMonth(state);
    return state;
  }
  function resolveChoices(state, selections) {
    if (state.phase !== 'playing') return;
    const opps = state.opportunities;
    const totalCapital = opps.reduce((s, o) => s + (o.capital || 0), 0);
    const fin = (selections && selections.finance) || {};
    const shares = fin.A != null ? sharesFromPct(fin.A) : recommendShares(state.company, state.market, totalCapital);
    const plan = financingPlan(state.company, state.market, totalCapital, shares);
    const posture = WC_POSTURES.balanced;
    evaluateAll(state.company, state.market, opps, posture, plan.wacc);
    // Auto-select the capital-efficient portfolio within the financing budget.
    const included = selectPortfolio(state.company, opps, posture, plan.budgetMult).included;
    const funded = [...included].reduce((s, id) => s + (opps.find((o) => o.id === id)?.capital || 0), 0);
    const mods = resolveActions(selections);
    // Expected profit/risk — projected on the pre-event market (what the player sees when deciding).
    const expected = projectMonth(state.company, state.market, opps, selections);
    // The event happens AFTER the decision, shifting the market for the actual outcome.
    if (state.event) applyEvent(state.market, state.event);
    const rng = createRng(monthSeed(state.seed, state.month + 1000));
    const { company, result } = resolveMonth(rng, state.company, state.market, opps, [...included], posture, plan, state.month, funded, mods);
    result.event = state.event ? { name: state.event.name, desc: state.event.desc, cat: state.event.cat, impact: state.event.impact } : null;
    result.expectedProfit = expected.profit;
    result.expectedRisk = expected.risk;
    result.portfolio = {
      trades: [...included].map((id) => {
        const o = opps.find((x) => x.id === id);
        return { type: o.type, currency: o.currency, capital: o.capital };
      }),
      funded,
      shares: { cash: Math.round(plan.cashShare * 100), debt: Math.round(plan.debtShare * 100), factoring: Math.round(plan.factoringShare * 100) },
      financing: {
        cashAmount: funded * plan.cashShare,
        debtAmount: funded * plan.debtShare,
        factoringAmount: funded * plan.factoringShare,
      },
    };
    result.rates = {
      cashRate: plan.cashRate,
      debtRate: plan.debtRate,
      factoringRate: plan.factoringRate,
      wacc: plan.wacc,
    };
    state.company = company;
    state.history = [...state.history, result];
    state.lastResult = result;
    if (company.cash < BANKRUPTCY_CASH_FLOOR) {
      state.bankrupt = true; state.phase = 'results';
      state.finalScore = computeScore(state.history, company, true);
      return;
    }
    if (state.month >= TOTAL_MONTHS) {
      state.phase = 'results';
      state.finalScore = computeScore(state.history, company, false);
      return;
    }
    state.month += 1;
    beginMonth(state);
  }

  global.CFO = {
    TOTAL_MONTHS, STARTING, createGame, resolveChoices, risks, ratingFromRisk,
    money, signedMoney, round1, pct: (n) => (n * 100).toFixed(1) + '%',
    HEDGE_FEE_RATE, FX_RISK_FACTOR, INTEREST_RATE,
    FUNDING_MODES, FACTORING_FEE_RATE, SHORT_RATE, CURRENCY_FX,
    EXPORT_MARKET_OPTIONS, IMPORT_SOURCING_OPTIONS,
    buildDecision: (state, selections) => buildDecision(state, selections),
    recommend: (state, selections) => {
      state.agentActions = generateAgentActions(state.company, state.market, state.opportunities, selections);
      return state.agentActions;
    },
  };
})(window);
