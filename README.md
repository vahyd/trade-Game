# Trade CFO

A browser-based **CFO simulation game** for an international trading company. You step into the Chief Financial Officer's chair and make monthly decisions on currency risk, customer credit, and inventory — while random economic, geopolitical, and operational shocks hit the market.

Play by opening `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

---

## 🎮 Overview

You run a trading company over **12 months**. Every month you:

1. Review your financials and key risks.
2. Read the market news and the monthly **event** (recession, trade war, port closure…).
3. Review a **portfolio of opportunities** (order, import, export, expansion) that three agents score each month.
4. Set each agent's action — working capital, hedging, and financing — then advance.
5. See the outcome explained in plain language.

Your final score ranks you as a **Poor, Average, Good, or Expert CFO**.

---

## 🏢 Starting company

| Metric       | Value     |
|--------------|-----------|
| Cash         | $5.0M     |
| Debt         | $2.0M     |
| Inventory    | $3.0M     |
| Revenue      | $1.0M/mo  |
| Employees    | 20        |
| Markets      | Europe    |
| Suppliers    | China     |
| Credit rating| BBB       |

---

## 🧠 Three agents

Every month a ranked portfolio of opportunities is generated and evaluated by:

- **Agent A · Working Capital Management** — sets inventory target and customer credit terms (lean / balanced / aggressive), trading off growth vs. carrying cost and default risk.
- **Agent B · Currency & Hedging** — FX exposure report, hedge recommendation, hedge cost + residual FX risk (cost & risk adjuster).
- **Agent C · Financing** — chooses how to fund the approved deals (cash / debt / factoring), each with a different cost of capital and risk profile.

The engine selects the capital-efficient mix that maximizes **Expected Economic Profit = PnL − Capital Charge (funding cost) − Hedge Cost − Residual Risk Penalty**, within the working-capital and funding constraints.

Opportunity types: **Customer order**, **Import & resell**, **Export contract**, **Expansion capex**. The player sets each agent's action and advances the month.

---

## ⚡ Event engine (12 events)

- **Economic** — recession, inflation shock, interest-rate hike, banking crisis
- **Geopolitical** — trade war, sanctions, tariff increases, new trade agreement
- **Operational** — cyberattack, supplier bankruptcy, port closure, labor strike

---

## 🎯 Scoring

| Metric          | Weight |
|-----------------|--------|
| Cash Growth     | 30%    |
| Profit Growth   | 30%    |
| Risk Management | 20%    |
| Credit Rating   | 10%    |
| Survival        | 10%    |

---

## 🛠️ Tech

Plain HTML/CSS/JS, no build step or dependencies. `game.js` is the pure simulation engine; `app.js` is the UI; `styles.css` + `game.css` provide the shell and game styling. Progress auto-saves to localStorage.

MIT
