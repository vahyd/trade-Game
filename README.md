# Trade CFO

A browser-based **CFO simulation game** for an international trading company. You step into the Chief Financial Officer's chair and make monthly decisions on sourcing, export markets, and financing — while random economic, geopolitical, and operational shocks hit the market.

Play by opening `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

---

## ✨ Features

- **12-month CFO simulation** with monthly decisions and a final score/rank (Poor / Average / Good / Expert CFO)
- **Two-step month flow** — *Run simulation* shows expected vs. actual results for the month; *Next month* advances
- **Expected vs. actual profit box** — step-by-step breakdown (Import / Export / Financing) with an Event-impact row; totals always match the *"This month — event vs expected"* recap card
- **Financing mix slider** — cash vs. factoring trade-off with live monthly factoring cost shown on the slider
- **Event engine** — 14 economic, geopolitical, and operational shocks that land after you commit
- **Tabs** — Decisions, Market (financing rates + risk snapshot), Capital (financing sources), Trade (specific trades + portfolio structure)
- **Dark / light theme**, monthly profit chart, cumulative NPV line, rate history
- **Auto-save** to localStorage — refresh keeps your game in progress
- **No build step** — plain HTML/CSS/JS

---

## 🎮 Gameplay loop

Every month:

1. Review your financials and key risks.
2. Pick your **import sources** and **export markets**.
3. Set the **financing mix** — cash vs. factoring (debt is fixed at 20%).
4. Run the simulation and read the **expected vs. actual** comparison.
5. Advance to the next month and repeat.

---

## 🏢 Starting company

| Metric       | Value     |
|--------------|-----------|
| Cash         | $5.0M     |
| Debt         | $10.0M    |
| Inventory    | $3.0M     |
| Revenue      | $1.0M/mo  |
| Employees    | 20        |
| Markets      | Europe    |
| Suppliers    | China     |
| Credit rating| BBB       |
| Risk score   | 55/100    |

---

## 🧠 Monthly decisions

- **Import sourcing** — suppliers (China / Vietnam / Mexico) trade off landed cost vs. supply risk.
- **Export markets** — buyer markets (USA / Europe / China) trade off margin vs. competitive risk.
- **Financing mix** — slider sets how much cash is kept as buffer vs. used as **factoring**. Debt is a constant 20% of funding.

The engine selects the capital-efficient portfolio of deals within the working-capital budget and maximizes **Expected Economic Profit = PnL − Capital Charge − Hedge Cost − Residual Risk Penalty**.

---

## 💸 Financing — how the mix works

The mix has a real monthly cost, charged against profit:

| Source    | Monthly rate                       |
|-----------|------------------------------------|
| Cash      | 0.4% (liquidity cost, `SHORT_RATE`) |
| Debt      | By credit rating: AAA 0.25% → BBB 0.4% → CCC 1.4% → D 2.5%, plus any market interest surcharge |
| Factoring | `max(3%, debtRate + 2.4%)` — the most expensive source |

With the slider at `c`% cash / `f`% factoring (debt fixed at 20%):

```
cashShare      = c / (c + f) × 0.80
factoringShare = f / (c + f) × 0.80
debtShare      = 0.20

wacc        = 0.20·debtRate + cashShare·0.004 + factoringShare·factoringRate
budgetMult  = cashShare·1 + 0.20·3 + factoringShare·3.5   ← factoring funds more deals
riskAdd     = 0.20·3 + factoringShare·(−18)               ← factoring lowers risk
maxDebt     = company cash × 0.5
```

- More **factoring** → larger deal budget but a **higher financing burden** (the slider shows the monthly factoring cost live).
- More **cash buffer** → cheaper funding, and the buffer absorbs negative event returns; if a loss exceeds the buffer, factoring doubles as a penalty (`factoringAmount × factoringRate`).
- Monthly charges in the P&L:

```
cashCost      = funded × cashShare × 0.004
factoringCost = funded × factoringShare × factoringRate
interest      = (debt + min(funded × 0.20, maxDebt)) × (ratingRate + surcharge)
selectionFee  = (sources + markets) × revenue × 3%
financingCost = −(interest + selectionFee + cashCost + factoringCost)
```

---

## 📈 Deals & expected profit — how the numbers are built

**Opportunities** (regenerated each month, scaled by `TRADE_SCALE = 0.62`):

| Deal | Capital | Expected PnL |
|------|---------|--------------|
| Import (USD supplier) | $1.0M × 0.62 | capital × 12% |
| Import (CNY supplier) | $0.8M × 0.62 | capital × 12% |
| Export (USD / EUR / CNY) | 1.5 / 1.2 / 1.1 × 0.62M × (0.8 + demand×0.3) | value × (9%×(1−risk) − 85%×risk) |

- Export default risk: `risk = clamp(3% + recessionRisk×0.0008, 2%, 20%)`; a default writes off **85%** of the receivable.
- FX per currency: `fxChange = usdChange × {USD 1.0, EUR 0.9, CNY 0.4}`.

**Portfolio selection** — every deal is scored:

```
fxPenalty       = fxExposure × |fxChange|
economicProfit  = expectedPnL − capital × wacc − fxPenalty
budget          = cash × 0.85 × budgetMult
```

Deals are included in descending `economicProfit` until the budget is exhausted.

**Expected profit projection** (pre-event, shown in the profit box):

```
funded              = includedCapital × (0.25 + 0.75 × (markets + sources) / 6)
revenue             = monthlyRevenue × (0.88 + demand/100 × 0.4)
importTradeProfit   = Σ includedImportCapital × 12% × (1 + supplyRisk × 0.02)
exportTradeProfit   = Σ capital × 9% × focusBoost? × (1 + marginAdj + marketRisk × 0.01)
                      − capital × 85% × creditRisk × (1 − factoringShare)
focusBoost          = 1.4 for your focused export market (one focus currency)
sourcingEffect      = −revenue × (cogsAdj + supplyRisk × 0.005)
importContribution  = importTradeProfit + sourcingEffect
exportContribution  = exportTradeProfit
profit              = importContribution + exportContribution + financingCost
```

**Actual result** (post-event, same methodology) adds:

- Buyer defaults happen randomly with probability `risk × (1 − factoringShare)`.
- Cost pressure from events hits `sourcingEffect`.
- The financing penalty applies when the cash buffer can't cover a negative return.
- Event adjustment: negative events cap profit at `expected − max($1K, 25%·|expected|)`; positive events lift profit to `expected + max($1K, 10%·|expected|)`. The difference is shown as the **Event impact** row, so the breakdown always reconciles to the actual profit.

---

## ⚡ Event engine (14 events)

| Category | Events |
|----------|--------|
| Economic | Recession, inflation shock, interest-rate hike, banking crisis, market rally (positive), demand boom (positive) |
| Geopolitical | Trade war, sanctions, tariff increases, new trade agreement (positive) |
| Operational | Cyberattack, supplier bankruptcy, port closure, labor strike |

Events land **after** you commit your decisions, modifying the market for the actual outcome (demand, recession risk, tariffs, shipping, USD, interest surcharge, cost pressure):

- **Negative** events push the actual return **below the expected projection** — the month can still end positive, just less than expected.
- **Positive** events push the actual return **above the expected projection**.

Events never repeat two months in a row.

---

## 🌍 Market simulation

| Indicator | Range | Evolution |
|-----------|-------|-----------|
| USD change | ±12% | Mean-reverts: `prev×0.2 + noise(±5%)` |
| Shipping | 0.5× – 1.9× | Mean-reverts toward 1, ±28% noise |
| Tariff | 0 – 20% | Random walk ±(2–14%) |
| Demand index | 15 – 100 | Pulls toward 62, ±18 noise |
| Recession risk | 0 – 100 | Pulls toward 28, ±14 noise |

---

## 🛡️ Risk & credit rating

```
fx         = |usdChange| × 1000
credit     = recessionRisk
supply     = (shipping − 1) × 200 + tariff × 250
financing  = debt / (cash + inventory) × 100
riskScore  = 25 + clamp(leverage)×45 + riskAdd + recessionRisk×0.15
             (+15 if unhedged FX move > 4%)
```

| Risk score | Rating |
|-----------|--------|
| < 20 | AA |
| < 35 | A |
| < 50 | BBB |
| < 65 | BB |
| < 80 | B |
| ≥ 80 | CCC |

Bankruptcy triggers when cash falls below **−$1.0M**.

---

## 🎯 Scoring

| Metric | Weight | Formula |
|--------|--------|---------|
| Cash Growth | 20% | `((cash − $5M) / $5M) × 50 + 50` |
| Profit Growth | 30% | `cumulativeProfit / $2.5M × 100` |
| Risk Management | 20% | `100 − averageRiskScore` |
| Credit Rating | 15% | AAA 100 → D 0 |
| Survival | 15% | 100, or months survived / 12 if bankrupt |

Final rank: **≥85 Expert CFO · ≥70 Good CFO · ≥55 Average CFO · else Poor CFO**.

---

## 🛠️ Tech

Plain HTML/CSS/JS, no build step or dependencies. `game.js` is the pure simulation engine; `app.js` is the UI; `styles.css` + `game.css` provide the shell and game styling. Progress auto-saves to localStorage (`trade-cfo-agents-v5`).

MIT
