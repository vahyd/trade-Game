# TradeShock

**International Trade Strategy Game** — a browser-based economic simulation where you lead a nation through global markets, commodity shocks, and currency crises.

Play at: `http://localhost:5173/` after running the dev server.

---

## 🎮 Overview

You control one of 8 real-world economies. Every quarter, a commodity shock hits the market. Your advisors analyze export opportunities and import needs. You decide what to trade, with whom, and in which currency. The AI-controlled countries compete, react to your moves, and pursue their own economic agendas.

**Goal**: Achieve the highest **Economic Score (0–100)** by game end.

---

## 🏆 How to Win

Your Economic Score is calculated from 7 weighted factors:

| Factor | Weight | What it means |
|--------|--------|---------------|
| Economic Growth | 25% | Grow GDP through trade surpluses and production |
| Trade Sustainability | 20% | Keep deficits under control — balance exports & imports |
| FX Reserve Stability | 15% | Maintain healthy foreign currency reserves |
| Supply Chain Resilience | 15% | Diversify suppliers — avoid dependency on one partner |
| Inflation Control | 10% | Keep prices stable — weak currency = expensive imports |
| Domestic Satisfaction | 10% | Ensure population has food, energy, essential goods |
| Fiscal Stability | 5% | Manage debt relative to GDP |

---

## 🌍 Countries

| Country | Currency | Exports | Imports | AI Personality |
|---------|----------|---------|---------|----------------|
| Saudi Arabia | SAR (3.75) | Oil, Gas | Machinery, Food | Export Maximizer |
| Japan | JPY (1.10) | Electronics, Machinery | Oil, Gas, Copper | Industrializer |
| Brazil | BRL (5.50) | Wheat, Food | Machinery, Oil | Security First |
| Chile | CLP (2.80) | Copper, Steel | Food, Machinery | Diversifier |
| Germany | EUR (0.92) | Machinery, Steel | Oil, Copper, Food | Trader |
| New Zealand | NZD (1.60) | Food | Oil, Gas | Reserve Defender |
| Qatar | QAR (3.64) | Gas, Steel | Machinery, Food | Protectionist |
| Vietnam | VND (6.50) | Food, Copper | Machinery, Oil | Trader |

---

## 📦 Commodities

| Commodity | Base Price | Volatility | Category |
|-----------|-----------|------------|----------|
| Oil | 70 GTU | High | Energy |
| Natural Gas | 40 GTU | High | Energy |
| Wheat | 25 GTU | Medium | Food |
| Food | 30 GTU | Low | Food |
| Steel | 50 GTU | Medium | Metal |
| Copper | 60 GTU | Medium | Metal |
| Electronics | 100 GTU | Medium | Tech |
| Machinery | 80 GTU | Low | Industrial |

---

## ⚡ Shocks (25 events)

Every quarter a commodity price shock fires. Types include:

- **Commodity Price** — Oil crash/surge, food spikes, steel glut
- **Supply Chain** — Strait closures, pipeline disruptions
- **Production** — Droughts, bumper harvests, discoveries
- **Exchange Rate** — Currency crises, rallies
- **Political** — Export bans, sanctions, trade agreements
- **Demand** — Recessions, tech booms, energy transitions

Severity: Minor → Moderate → Major → Crisis (cascading effects)

---

## 🧠 AI Advisors

Three autonomous engines analyze your position each quarter:

- **ExportAgent** — Evaluates surplus, profit margins, finds buyers
- **ImportAgent** — Evaluates deficits, inventory coverage, ranks suppliers
- **TraderAdvisor** — Merges both with FX outlook, produces ranked suggestions

AI countries react to your trades — they undercut your prices, compete for supply, and adjust based on their personality.

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/vahyd/trade-Game.git
cd trade-Game

# Install
npm install

# Run
npm run dev
```

Open **http://localhost:5173/** — select difficulty, pick a country, and play.

---

## 🏗️ Architecture

```
src/
├── engine/              # Pure TypeScript simulation (no React)
│   ├── types.ts         # All interfaces
│   ├── rng.ts           # Seeded RNG (mulberry32)
│   ├── data.ts          # Countries, commodities, shocks
│   ├── GameEngine.ts    # Round orchestrator (8 phases)
│   ├── MarketEngine.ts  # Commodity prices + exchange rates
│   ├── ShockEngine.ts   # 25 shock events + conditional FX crisis
│   ├── AIEngine.ts      # AI decision-making + reactive counter-trading
│   ├── TradeEngine.ts   # Order matching & market clearing
│   ├── ExportAgent.ts   # Export opportunity analysis
│   ├── ImportAgent.ts   # Import need analysis
│   ├── TraderAdvisor.ts # Merged strategic suggestions
│   ├── ContractEngine.ts
│   ├── ScoringEngine.ts # 0-100 economic score
│   └── EventEngine.ts   # News feed generation
├── store/
│   └── gameStore.ts     # Zustand state management
└── components/          # React UI
    ├── TitleScreen.tsx   # Rules + game config
    ├── CountrySelect.tsx
    ├── GameLayout.tsx    # Main 3-tab layout
    ├── TopBar.tsx        # Score tooltip, crisis indicator
    ├── TradeScreen.tsx   # Advisor suggestions + order form + S/D basket
    ├── WorldMarket.tsx   # Price charts + country-level supply/demand
    ├── RankingsPanel.tsx # Live leaderboard
    ├── NewsFeed.tsx      # Scrolling trade news
    └── ResultsScreen.tsx # Final scores + objectives
```

---

## 🎯 Game Mechanics

### Round Structure
1. **Shock** — Commodity shock fires every quarter
2. **Market Adjustment** — Prices, supply/demand, exchange rates update
3. **Advisor Briefing** — Export + Import analysis runs
4. **AI Decisions** — AI countries place baseline orders
5. **Human Decisions** — You accept suggestions or place manual orders
6. **Reactive AI** — AI counters your orders (undercuts, competes)
7. **Market Clearing** — Orders matched, trades executed
8. **Results** — GDP, inflation, FX reserves, scores update

### Exchange Rate Engine
```
CurrencyPressure = 0.30 × TradeBalance + 0.25 × Reserves
                 − 0.20 × Inflation − 0.15 × Debt + 0.10 × Growth
```

### Conditional FX Crisis
Triggers when your economy shows warning signs:
- FX reserves < 2 months import cover → +40 risk
- Trade deficit > 15% GDP → +35 risk
- Inflation > 15% → +30 risk
- Debt/GDP > 80% → +20 risk

Risk ≥ 40 → Crisis may fire, depreciating your currency 10–30%.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Charts | Recharts |
| Network Viz | D3.js |
| Storage | localStorage |
| No backend | Fully client-side |

---

## 🎲 Game Config

- **Difficulty**: Easy / Normal / Hard / Expert
- **Duration**: Quick (8 rounds) / Standard (12) / Extended (20)
- **Seed**: Deterministic replays — same seed = same world
- **Save/Load**: Automatic save to localStorage

---

## 📄 License

MIT
