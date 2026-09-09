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
3. Make **3 decisions** on currency, credit, and inventory, guided by three AI advisors.
4. See the outcome explained in plain language.
5. Move to the next month.

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

## 🧠 Decisions (3 types)

- **Currency risk** — hedge your USD exposure (none / 50% / 100%)
- **Customer credit** — accept, Letter of Credit, prepayment, or reject
- **Inventory** — increase, keep, or reduce stock

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
