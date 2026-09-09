# Trade CFO

**A browser-based CFO simulation game** for an international trading company. You step into the Chief Financial Officer's chair and make monthly decisions on currency risk, customer credit, inventory, and financing — then watch how each choice plays out on the company's financials.

Play at `http://localhost:5173/` after running the dev server.

---

## 🎮 Overview

You run a trading company over **60 months**. Every month you:

1. Review the company dashboard (cash, revenue, profit, debt, inventory, credit rating, risk score).
2. Read the market news (USD moves, shipping costs, tariffs, demand, recession warnings).
3. Make **3–5 decisions** with the help of three virtual advisors and an action-recommendation engine.
4. See the outcomes explained in plain language.
5. Watch the scoreboard update and move to the next month.

Your final score ranks you as a **Poor, Average, Good, or Expert CFO**.

---

## 🧠 What it teaches

- Financial decision making
- Trade finance (letters of credit, prepayments)
- Foreign exchange risk (hedging)
- Cash flow & liquidity management
- Credit risk
- Financing choices (debt vs. equity)

---

## 🏗️ Architecture

```
src/
├── engine/               # Pure TypeScript simulation (no React)
│   ├── types.ts          # All interfaces
│   ├── rng.ts            # Seeded RNG (mulberry32) for reproducible games
│   ├── constants.ts      # Starting company, cost structure, scoring weights
│   ├── world.ts          # Market simulation + monthly news engine
│   ├── decisions.ts      # Decision/scenario generator (FX, credit, inventory, financing)
│   ├── advisors.ts       # Virtual advisors (Treasury, Risk Manager, Market Analyst)
│   ├── outcomes.ts       # Outcome engine + monthly P&L
│   ├── scoring.ts        # 0–100 economic score & ranking
│   └── gameEngine.ts     # Month orchestrator
├── store/
│   └── gameStore.ts      # Zustand state + localStorage persistence
├── api/
│   └── client.ts         # Leaderboard client (optional FastAPI backend)
└── components/           # React UI
    ├── TitleScreen.tsx
    ├── GameShell.tsx     # Tabbed layout (Dashboard / Decisions / Report / History)
    ├── Dashboard.tsx     # Company status + market conditions + advisors + news
    ├── DecisionsScreen.tsx
    ├── OutcomeReport.tsx
    ├── HistoryScreen.tsx # Recharts performance charts
    └── ResultsScreen.tsx # Final score, ranking, leaderboard

backend/
├── main.py               # FastAPI app (leaderboard/score persistence)
└── requirements.txt
```

---

## 🚀 Quick Start

### Frontend (required)

```bash
npm install
npm run dev
```

Open **http://localhost:5173/**.

### Backend (optional — for the leaderboard)

The game runs entirely client-side. A small FastAPI + SQLite backend optionally
persists final scores to a shared leaderboard.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The frontend talks to `http://localhost:8000` and falls back gracefully to local-only
storage if the backend is not running.

---

## 🎯 Scoring

| Metric          | Weight | What it measures                                   |
|-----------------|--------|----------------------------------------------------|
| Cash Growth     | 30%    | Cash relative to the starting $5M                  |
| Profit Growth   | 30%    | Cumulative profit against a target                 |
| Risk Management | 20%    | Inverse of average risk score                      |
| Credit Rating   | 10%    | Final credit rating (AAA → D)                      |
| Survival        | 10%    | Full score if you survive all 60 months            |

---

## 🛠️ Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 19 + TypeScript + Vite        |
| Styling  | Tailwind CSS 4                      |
| State    | Zustand (+ localStorage persistence)|
| Charts   | Recharts                            |
| Backend  | Python + FastAPI + SQLite           |

No login, no multiplayer, no real-time simulation — an MVP focused on decision quality,
learning value, and replayability.

---

## 📄 License

MIT
