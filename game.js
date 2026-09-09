/* Trade CFO Simulator — game engine (pure JS, no DOM). */
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
  const FIXED_OVERHEAD = 100000;
  const BASE_SHIPPING = 60000;
  const INVENTORY_CARRY_RATE = 0.01;
  const CREDIT_MARGIN = 0.15;
  const INTEREST_RATE = { AAA: 0.003, AA: 0.0035, A: 0.004, BBB: 0.005, BB: 0.008, B: 0.012, CCC: 0.018, D: 0.03 };
  const SCORING_WEIGHTS = { cashGrowth: 0.3, profitGrowth: 0.3, riskManagement: 0.2, creditRating: 0.1, survival: 0.1 };
  const FX_EXPOSURE = 1000000;
  const CREDIT_ORDER = 2000000;
  const INVENTORY_STEP = 1000000;
  const BANKRUPTCY_CASH_FLOOR = -1000000;

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
    { id: 'recession', cat: 'Economic', name: 'Recession', desc: 'The economy contracts; demand drops and recession risk spikes.', impact: 'negative', effects: { demand: -20, recession: 25 } },
    { id: 'inflation-shock', cat: 'Economic', name: 'Inflation shock', desc: 'Input prices surge, raising your cost of goods sold.', impact: 'negative', effects: { costPressure: 0.05, demand: -5 } },
    { id: 'rate-hike', cat: 'Economic', name: 'Interest-rate hike', desc: 'The central bank raises rates, increasing your borrowing costs.', impact: 'negative', effects: { interestSurcharge: 0.004, demand: -5 } },
    { id: 'banking-crisis', cat: 'Economic', name: 'Banking crisis', desc: 'Credit markets seize up; default risk and currency stress rise.', impact: 'negative', effects: { recession: 20, usdChange: 0.03 } },
    { id: 'trade-war', cat: 'Geopolitical', name: 'Trade war', desc: 'Tit-for-tat tariffs hit your markets and soften demand.', impact: 'negative', effects: { tariff: 0.08, demand: -10 } },
    { id: 'sanctions', cat: 'Geopolitical', name: 'Sanctions', desc: 'New sanctions disrupt trade routes and raise tariffs.', impact: 'negative', effects: { tariff: 0.05, shipping: 0.15 } },
    { id: 'tariff-increase', cat: 'Geopolitical', name: 'Tariff increases', desc: 'Import tariffs are raised across the board.', impact: 'negative', effects: { tariff: 0.06 } },
    { id: 'trade-agreement', cat: 'Geopolitical', name: 'New trade agreement', desc: 'A new pact lowers tariffs and lifts demand.', impact: 'positive', effects: { tariff: -0.05, demand: 8 } },
    { id: 'cyberattack', cat: 'Operational', name: 'Cyberattack', desc: 'A cyberattack disrupts operations, adding costs and slowing sales.', impact: 'negative', effects: { costPressure: 0.03, demand: -5 } },
    { id: 'supplier-bankruptcy', cat: 'Operational', name: 'Supplier bankruptcy', desc: 'A key supplier goes under, tightening supply and raising freight costs.', impact: 'negative', effects: { shipping: 0.2, demand: -5 } },
    { id: 'port-closure', cat: 'Operational', name: 'Port closure', desc: 'A major port shuts down, sending shipping costs soaring.', impact: 'negative', effects: { shipping: 0.3, demand: -8 } },
    { id: 'labor-strike', cat: 'Operational', name: 'Labor strike', desc: 'Dock workers strike, slowing shipments and raising costs.', impact: 'negative', effects: { shipping: 0.15, costPressure: 0.02 } },
  ];

  /* ---------- Market ---------- */
  function generateMarket(rng, prev) {
    if (!prev) {
      return {
        usdChange: rng.float(-0.03, 0.03),
        shippingMultiplier: clamp(1 + rng.float(-0.15, 0.15), 0.7, 1.3),
        tariffRate: rng.chance(0.2) ? rng.float(0.05, 0.12) : 0,
        demandIndex: rng.int(60, 80),
        recessionRisk: rng.int(10, 30),
        interestSurcharge: 0,
        costPressure: 0,
      };
    }
    const usdChange = clamp(prev.usdChange * 0.35 + rng.float(-0.06, 0.06), -0.12, 0.12);
    const shippingMultiplier = clamp(1 + (prev.shippingMultiplier - 1) * 0.5 + rng.float(-0.18, 0.18), 0.6, 1.6);
    let tariffRate = prev.tariffRate;
    if (rng.chance(0.18)) tariffRate = clamp(tariffRate + rng.float(0.03, 0.08), 0, 0.35);
    else tariffRate = clamp(tariffRate - rng.float(0, 0.02), 0, 0.35);
    const demandIndex = clamp(prev.demandIndex + rng.float(-14, 14), 30, 96);
    const recessionRisk = clamp(prev.recessionRisk + rng.float(-12, 12), 0, 100);
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

  /* ---------- Advisors ---------- */
  function generateAdvisorBoard(market) {
    const insights = [];
    const usdPct = market.usdChange * 100;
    insights.push({ advisor: 'Treasury', message: Math.abs(market.usdChange) > 0.04
      ? `USD moved ${usdPct >= 0 ? '+' : ''}${usdPct.toFixed(1)}% this month — your FX exposure is elevated.`
      : `USD is steady (${usdPct >= 0 ? '+' : ''}${usdPct.toFixed(1)}%) — FX risk is low this month.` });
    const recession = Math.round(market.recessionRisk);
    insights.push({ advisor: 'Risk Manager', message: market.recessionRisk > 60
      ? `Credit climate is deteriorating (recession risk ${recession}/100).`
      : `Credit climate is stable (recession risk ${recession}/100).` });
    const shipHigh = market.shippingMultiplier > 1.2, tariffHigh = market.tariffRate > 0.1;
    if (shipHigh || tariffHigh) {
      insights.push({ advisor: 'Market Analyst', message: `Supply chain is tight (shipping ${market.shippingMultiplier.toFixed(1)}×${tariffHigh ? ', tariffs ' + Math.round(market.tariffRate * 100) + '%' : ''}).` });
    } else if (market.demandIndex > 75) {
      insights.push({ advisor: 'Market Analyst', message: 'Supply chain is smooth and demand is strong.' });
    } else {
      insights.push({ advisor: 'Market Analyst', message: 'Supply chain is stable; demand is moderate.' });
    }
    return insights;
  }

  /* ---------- Decisions ---------- */
  function opt(id, label, desc) { return { id, label, desc }; }
  function rec(optionId, advisor, actionLabel, reason, confidence) { return { optionId, advisor, actionLabel, reason, confidence }; }

  function generateDecisions(rng, company, market, month) {
    return [currencyDecision(market, month), creditDecision(rng, market, month), inventoryDecision(rng, company, market, month)];
  }
  function currencyDecision(market, month) {
    const volatility = Math.abs(market.usdChange);
    let optionId, actionLabel, reason;
    if (volatility > 0.04) { optionId = 'hedge100'; actionLabel = 'Hedge 100% of USD exposure'; reason = 'Currency volatility is elevated — full protection is prudent.'; }
    else if (volatility > 0.02) { optionId = 'hedge50'; actionLabel = 'Hedge 50% of USD exposure'; reason = 'Currency volatility is increasing — partial hedging balances cost and risk.'; }
    else { optionId = 'none'; actionLabel = 'Leave exposure unhedged'; reason = 'Volatility is low — hedging costs may exceed the expected benefit.'; }
    return {
      id: 'currency-' + month, type: 'currency', title: 'Currency Risk — upcoming USD purchase',
      description: 'You expect to purchase goods worth $1.0 million from a USD supplier next quarter.',
      options: [
        opt('none', 'No hedge', 'Leave the full $1.0M exposure open to currency swings.'),
        opt('hedge50', 'Hedge 50%', 'Lock in half the exposure; pay a small hedging fee.'),
        opt('hedge100', 'Hedge 100%', 'Fully lock the rate; pay a fee but eliminate FX risk.'),
      ],
      insights: [
        { advisor: 'Treasury', message: 'USD exposure on your import pipeline is running high this month.' },
        { advisor: 'Market Analyst', message: volatility > 0.03 ? 'FX markets look volatile; sharp moves are likely.' : 'FX markets look relatively calm.' },
      ],
      recommendation: rec(optionId, 'Treasury', actionLabel, reason, Math.min(90, Math.round(55 + volatility * 800))),
    };
  }
  function creditDecision(rng, market, month) {
    const baseRisk = 0.1 + market.recessionRisk * 0.002;
    const customerRisk = Math.min(0.45, baseRisk + rng.float(-0.05, 0.15));
    const riskLabel = customerRisk > 0.3 ? 'high' : customerRisk > 0.18 ? 'medium' : 'low';
    let optionId, actionLabel, reason;
    if (riskLabel === 'high') { optionId = 'lc'; actionLabel = 'Accept with Letter of Credit'; reason = 'Elevated default risk — a Letter of Credit protects the receivable.'; }
    else if (riskLabel === 'medium') { optionId = 'prepay'; actionLabel = 'Require 50% prepayment'; reason = 'Moderate risk — a prepayment reduces exposure while keeping the sale.'; }
    else { optionId = 'accept'; actionLabel = 'Accept on open credit'; reason = 'Low default risk — open credit is the most competitive offer.'; }
    return {
      id: 'credit-' + month, type: 'credit', title: 'Customer Credit — new order',
      description: 'A new customer wants to buy $2.0 million of products.',
      options: [
        opt('accept', 'Accept (open credit)', 'Extend normal payment terms; strongest offer but exposed to default.'),
        opt('lc', 'Accept with Letter of Credit', 'Bank guarantees payment; pay a small fee.'),
        opt('prepay', 'Require 50% prepayment', 'Customer pays half up front; may walk away from the deal.'),
        opt('reject', 'Reject', 'Decline the order and take no credit risk.'),
      ],
      insights: [
        { advisor: 'Risk Manager', message: riskLabel === 'high' ? 'This customer has elevated default risk.' : riskLabel === 'medium' ? 'This customer has moderate credit risk.' : 'This customer looks creditworthy.' },
        { advisor: 'Market Analyst', message: market.demandIndex > 70 ? 'Demand is firm — a big order would help revenue.' : 'Demand is soft — weigh the size of this order carefully.' },
      ],
      recommendation: rec(optionId, 'Risk Manager', actionLabel, reason, Math.min(90, Math.round(60 + (customerRisk - 0.15) * 120))),
      hidden: { customerRisk },
    };
  }
  function inventoryDecision(rng, company, market, month) {
    const shippingLow = market.shippingMultiplier < 0.85, demandHigh = market.demandIndex > 75;
    let optionId, actionLabel, reason;
    if (shippingLow && demandHigh) { optionId = 'increase'; actionLabel = 'Increase inventory'; reason = 'Cheap shipping and strong demand favor building inventory.'; }
    else if (!shippingLow && !demandHigh) { optionId = 'reduce'; actionLabel = 'Reduce inventory'; reason = 'High shipping and weak demand make holding inventory costly.'; }
    else { optionId = 'keep'; actionLabel = 'Keep inventory stable'; reason = 'Mixed signals — keep inventory stable.'; }
    return {
      id: 'inventory-' + month, type: 'inventory', title: 'Inventory — stock level',
      description: `You hold $${(company.inventory / 1000000).toFixed(1)}M of inventory. Shipping costs are ${shippingLow ? 'low' : 'high'}.`,
      options: [
        opt('increase', 'Increase inventory', 'Buy $1.0M more stock.'),
        opt('keep', 'Keep inventory stable', 'Leave stock levels unchanged.'),
        opt('reduce', 'Reduce inventory', 'Sell down $1.0M of stock.'),
      ],
      insights: [
        { advisor: 'Treasury', message: shippingLow ? 'Shipping costs are low — a good time to stock up.' : 'Shipping costs are elevated — buying now is expensive.' },
        { advisor: 'Market Analyst', message: demandHigh ? 'Demand looks strong — low stock risks lost sales.' : 'Demand is muted — excess inventory adds carrying cost.' },
      ],
      recommendation: rec(optionId, 'Market Analyst', actionLabel, reason, Math.round(58 + rng.float(0, 20))),
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
  function findChoice(choices, id) {
    const c = choices.find((x) => x.decisionId === id);
    return c ? c.optionId : null;
  }

  function resolveMonth(rng, company, market, decisions, choices, month) {
    const outcomes = [];
    let fxImpact = 0, decisionProfit = 0, inventoryCashFlow = 0, stockoutLoss = 0, wasteCost = 0;
    const cashBefore = company.cash, debtBefore = company.debt;
    const next = { ...company, markets: [...company.markets], suppliers: [...company.suppliers] };

    const currency = decisions.find((d) => d.type === 'currency');
    if (currency) {
      const choice = findChoice(choices, currency.id);
      const exposure = FX_EXPOSURE, usd = market.usdChange;
      let hedgeRatio = 0;
      if (choice === 'hedge50') hedgeRatio = 0.5;
      if (choice === 'hedge100') hedgeRatio = 1;
      const fee = exposure * hedgeRatio * 0.005;
      fxImpact = -exposure * usd * (1 - hedgeRatio) - fee;
      const pct = Math.abs(usd) * 100;
      if (hedgeRatio === 0) {
        if (usd > 0) outcomes.push({ title: 'FX loss on unhedged exposure', detail: `You did not hedge your USD exposure. The USD appreciated by ${pct.toFixed(1)}%. The company lost ${money(exposure * usd)}. A partial hedge would have reduced the loss.`, good: false });
        else if (usd < 0) outcomes.push({ title: 'FX gain on unhedged exposure', detail: `You left exposure unhedged and the USD depreciated by ${pct.toFixed(1)}%. You gained ${money(exposure * Math.abs(usd))}, but unhedged positions are risky when volatility is high.`, good: true });
        else outcomes.push({ title: 'Flat FX', detail: 'The USD was flat, so your unhedged exposure caused no gain or loss this month.', good: true });
      } else {
        outcomes.push({ title: `Hedged ${hedgeRatio * 100}% of exposure`, detail: `You hedged ${hedgeRatio * 100}% of your USD exposure at a cost of ${money(fee)}. The USD moved ${usd > 0 ? 'up' : 'down'} ${pct.toFixed(1)}%. Your net FX impact was ${money(fxImpact)}.`, good: true });
      }
    }

    const credit = decisions.find((d) => d.type === 'credit');
    if (credit) {
      const choice = findChoice(choices, credit.id);
      const amount = CREDIT_ORDER, risk = credit.hidden.customerRisk;
      const margin = amount * CREDIT_MARGIN;
      if (choice === 'accept') {
        if (rng.chance(risk)) {
          const loss = amount * 0.85;
          decisionProfit -= loss;
          outcomes.push({ title: 'Customer defaulted', detail: `You extended open credit and the customer defaulted. You wrote off ${money(loss)} in receivables. A Letter of Credit or prepayment would have protected you.`, good: false });
        } else {
          decisionProfit += margin;
          outcomes.push({ title: 'Order paid in full', detail: `The customer paid. You earned a ${money(margin)} margin on the order. Open credit maximizes sales but carries default risk.`, good: true });
        }
      } else if (choice === 'lc') {
        const fee = amount * 0.01, net = margin - fee;
        decisionProfit += net;
        outcomes.push({ title: 'Order secured via Letter of Credit', detail: `The Letter of Credit guaranteed payment. You earned ${money(net)} after the ${money(fee)} bank fee.`, good: true });
      } else if (choice === 'prepay') {
        if (rng.chance(0.25)) outcomes.push({ title: 'Customer cancelled the order', detail: 'The customer refused your 50% prepayment requirement and walked away. You avoided default risk but lost the sale.', good: false });
        else { decisionProfit += margin; outcomes.push({ title: 'Customer accepted prepayment', detail: `The customer paid 50% up front and completed the order. You earned ${money(margin)} with reduced credit exposure.`, good: true }); }
      } else {
        outcomes.push({ title: 'Order rejected', detail: 'You declined the order and took no credit risk, but also earned nothing this month.', good: false });
      }
    }

    const inventory = decisions.find((d) => d.type === 'inventory');
    if (inventory) {
      const choice = findChoice(choices, inventory.id), step = INVENTORY_STEP;
      if (choice === 'increase') {
        inventoryCashFlow = -step; next.inventory += step;
        outcomes.push({ title: 'Increased inventory', detail: `You bought ${money(step)} more inventory. Carrying costs will rise, but you are positioned for higher demand.`, good: true });
      } else if (choice === 'reduce') {
        const sold = Math.min(step, next.inventory);
        inventoryCashFlow = sold; next.inventory -= sold;
        outcomes.push({ title: 'Reduced inventory', detail: `You sold down ${money(sold)} of inventory, freeing cash and lowering carrying costs.`, good: true });
      } else {
        outcomes.push({ title: 'Inventory kept stable', detail: 'You kept inventory unchanged this month.', good: true });
      }
    }

    const demandMultiplier = 0.8 + (market.demandIndex / 100) * 0.4;
    const revenue = next.monthlyRevenue * demandMultiplier;
    const cogs = revenue * (COGS_RATIO + market.costPressure);
    const salaries = next.employees * SALARY_PER_EMPLOYEE;
    const overhead = FIXED_OVERHEAD;
    const shipping = BASE_SHIPPING * market.shippingMultiplier;
    const interest = next.debt * (INTEREST_RATE[next.creditRating] + market.interestSurcharge);
    const carrying = next.inventory * INVENTORY_CARRY_RATE;
    const tariff = cogs * market.tariffRate;

    if (market.demandIndex > 80 && next.inventory < 1500000) {
      stockoutLoss = revenue * 0.1;
      outcomes.push({ title: 'Stockout — lost sales', detail: `Demand was strong but your inventory was too low. You lost ${money(stockoutLoss)} in missed sales.`, good: false });
    }
    if (market.demandIndex < 45 && next.inventory > 5000000) {
      wasteCost = next.inventory * 0.005;
      outcomes.push({ title: 'Excess inventory costs', detail: `Demand was weak while you held excess inventory, adding ${money(wasteCost)} in extra storage and spoilage costs.`, good: false });
    }

    const operatingProfit = revenue - cogs - salaries - overhead - shipping - interest - carrying - tariff;
    const profit = operatingProfit + fxImpact + decisionProfit - stockoutLoss - wasteCost;
    const cashDelta = operatingProfit + fxImpact + decisionProfit - stockoutLoss - wasteCost + inventoryCashFlow;
    next.cash += cashDelta;
    next.cumulativeProfit += profit;
    next.monthsSurvived += 1;

    const assets = next.cash + next.inventory;
    const leverage = next.debt / Math.max(assets, 1);
    let risk = 25 + clamp(leverage, 0, 1) * 45;
    const currencyChoice = findChoice(choices, currency ? currency.id : '');
    if (currencyChoice === 'none' && Math.abs(market.usdChange) > 0.04) risk += 15;
    const creditChoice = findChoice(choices, credit ? credit.id : '');
    if (creditChoice === 'accept' && credit.hidden.customerRisk > 0.2) risk += 10;
    risk += market.recessionRisk * 0.15;
    risk = clamp(Math.round(risk), 0, 100);
    next.riskScore = risk;
    next.creditRating = ratingFromRisk(risk);

    const result = {
      month, revenue, cogs, salaries, overhead, shipping, interest, carrying, tariff, fxImpact,
      profit, cashBefore, cashAfter: next.cash, debtBefore, debtAfter: next.debt,
      creditRating: next.creditRating, riskScore: next.riskScore, outcomes,
    };
    return { company: next, result };
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
    const finalCompanyValue = Math.round((company.cash + company.inventory - company.debt) * company.ownership);
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
      cumulativeProfit: 0, monthsSurvived: 0,
    };
  }
  function beginMonth(state) {
    const rng = createRng(monthSeed(state.seed, state.month));
    state.market = generateMarket(rng, state.month === 1 ? null : state.market);
    state.event = pickEvent(rng, state.event && state.event.id);
    applyEvent(state.market, state.event);
    state.news = generateNews(rng, state.market, state.month);
    state.decisions = generateDecisions(rng, state.company, state.market, state.month);
  }
  function createGame(seed) {
    const state = {
      phase: 'playing', month: 1, seed, company: freshCompany(),
      market: { usdChange: 0, shippingMultiplier: 1, tariffRate: 0, demandIndex: 70, recessionRisk: 20, interestSurcharge: 0, costPressure: 0 },
      event: null, news: [], decisions: [], history: [], lastResult: null, bankrupt: false, finalScore: null,
    };
    beginMonth(state);
    return state;
  }
  function resolveChoices(state, choices) {
    if (state.phase !== 'playing') return;
    const rng = createRng(monthSeed(state.seed, state.month + 1000));
    const { company, result } = resolveMonth(rng, state.company, state.market, state.decisions, choices, state.month);
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
    TOTAL_MONTHS, STARTING, createGame, resolveChoices, generateDecisions, generateAdvisorBoard, risks, ratingFromRisk,
    money, signedMoney, round1, pct: (n) => (n * 100).toFixed(1) + '%',
  };
})(window);
