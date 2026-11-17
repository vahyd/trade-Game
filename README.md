# Trade CFO

A browser-based **CFO simulation game** for an international trading company. You step into the Chief Financial Officer's chair and make monthly decisions on sourcing, export markets, and financing — while random economic, geopolitical, and operational shocks hit the market.

Play by opening `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

---

## 🎮 Overview

You run a trading company over **12 months**. Every month you:

1. Review your financials and key risks.
2. Pick your **import sources** and **export markets**.
3. Set the **financing mix** — cash vs. factoring (debt is fixed at 20%).
4. Run the simulation, then compare **expected vs. actual** profit step by step and see the monthly **event** land.
5. Advance to the next month and repeat.

Your final score ranks you as a **Poor, Average, Good, or Expert CFO**.

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

Every month you set three levers:

- **Import sourcing** — choose suppliers (China / Vietnam / Mexico) trading off landed cost vs. supply risk.
- **Export markets** — choose buyer markets (USA / Europe / China) trading off margin vs. competitive risk.
- **Financing mix** — the slider sets how much of available cash is kept as buffer vs. used as **factoring**. Debt is a constant 20% of funding.

The engine selects the capital-efficient portfolio of deals within the working-capital budget and computes **Expected Economic Profit = PnL − Capital Charge − Hedge Cost − Residual Risk Penalty**.

### 💸 Cost of financing

The financing mix has a real monthly cost, charged against profit:

| Source    | Cost           |
|-----------|----------------|
| Cash      | 0.4%/mo (liquidity cost) |
| Debt      | By credit rating (BBB: 0.4%/mo) |
| Factoring | 3%/mo — the most expensive source |

Allocating more share to **factoring** funds more deals (higher budget) but raises the financing burden accordingly — the slider shows the monthly factoring cost live.

### 📊 Expected vs. actual

The **Expected profit** box breaks the projection into Import / Export / Financing. After you run the month it shows **Expected vs. Actual** columns plus an **Event impact** row, and the totals always match the **"This month — event vs expected"** recap card below.

---

## ⚡ Event engine (12 events)

- **Economic** — recession, inflation shock, interest-rate hike, banking crisis
- **Geopolitical** — trade war, sanctions, tariff increases, new trade agreement
- **Operational** — cyberattack, supplier bankruptcy, port closure, labor strike

Events land **after** you commit your decisions:

- **Negative** events push the actual return **below the expected projection** — the month can still end positive, just less than expected.
- **Positive** events push the actual return **above the expected projection**.

---

## 🎯 Scoring

| Metric          | Weight |
|-----------------|--------|
| Cash Growth     | 20%    |
| Profit Growth   | 30%    |
| Risk Management | 20%    |
| Credit Rating   | 15%    |
| Survival        | 15%    |

---

## 🛠️ Tech

Plain HTML/CSS/JS, no build step or dependencies. `game.js` is the pure simulation engine; `app.js` is the UI; `styles.css` + `game.css` provide the shell and game styling. Progress auto-saves to localStorage.

MIT
