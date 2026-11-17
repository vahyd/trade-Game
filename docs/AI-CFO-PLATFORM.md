# AI CFO Platform — Architecture & Development Plan

Phase 1 deliverable for evolving the Trade CFO game into a commercial **AI CFO platform for international trading companies**. The game remains a standalone product; the platform reuses its financial engine.

## 1. Repository assessment

| File | Role | Reuse in platform |
|------|------|-------------------|
| `game.js` | Financial simulation engine (pure JS, no DOM) | Core — refactor into shared modules |
| `app.js` | Game UI | Game only |
| `platform.js` | First platform modules (Cash Flow, Advisor, Scenarios) | Extend with real data modes |
| `styles.css`, `game.css`, `dark.css` | Shell + game styling | Keep for game; new dashboard shell later |
| `index.html` | Game shell | Keep |
| `README.md` | Docs incl. full formula reference | Source of truth for validation |

**Engine capabilities mapped to platform modules:** market/event simulation, opportunity P&L, financing mix (cash/debt/factoring), FX exposure, credit risk, portfolio selection, risk scoring, 12-month resolution, scenario-ready pure functions (`CFO.project`, `CFO.risks`).

**Technical debt:** single-file engine; game state mixes simulation data with UI snapshot fields (`pendingExpected`, `pendingOptionReturns`); no module boundaries; no tests in repo; formulas documented in README only.

## 2. Target architecture

```
┌─ Frontend (game + future corporate dashboard)
├─ Shared Financial Intelligence Engine (pure JS modules)
│   trade-engine · cashflow-engine · working-capital-engine · financing-engine
│   profitability-engine · fx-risk-engine · credit-risk-engine
│   scenario-engine · optimization-engine · reporting-engine
├─ API layer (auth, company isolation, calculations, AI orchestration)
├─ Database (companies, transactions, invoices, loans, forecasts, audit log)
└─ AI layer (LLM + engine tools; advisory only)
```

**Two engine modes:**
- **Simulation mode** — synthetic company data + generated events (today's game).
- **Real-company mode** — uploaded/entered transactions drive the same calculations; no simulated events.

**Principles:** no silent formula changes, deterministic tests comparing refactored engine output to the current game output, clear labeling of actuals vs forecasts vs scenarios, company-level data isolation, advisory-only AI.

## 3. Migration plan

1. **Phase 1 (done in part)** — document formulas (README), extract first reusable modules (`platform.js`: cash-flow forecast, scenario runner, advisor), keep game intact. Add deterministic engine tests.
2. **Phase 2** — split `game.js` into the shared modules with identical outputs (golden tests against current game). Add `mode: 'sim' | 'real'` to the engine core.
3. **Phase 3** — backend: auth, company data model, CSV/Excel upload, transaction validation, API for the four MVP modules.
4. **Phase 4** — risk & forecasting: FX monitoring, credit indicators, scenario service (reuse event engine), rolling forecasts.
5. **Phase 5** — AI CFO advisor: LLM + engine tool calls, recommendations with audit trail.
6. **Phase 6** — enterprise dashboard, multi-tenancy, permissions, security hardening, pilot.

## 4. Prioritized backlog (MVP first)

1. Cash-flow forecasting (13-week) — prototyped in `platform.js`
2. Working-capital management (AP/AR/inventory, CCC) — prototyped
3. Import/export profitability analysis — partially in game engine
4. Financing optimization — partially in game engine
5. Scenario analysis — prototyped
6. AI CFO advisor — prototyped (rules-based; LLM later)
7. Risk management engine, FP&A statements, reports, settings
8. Real-company mode: uploads, ERP/accounting connectors
9. Multi-tenant SaaS hardening

## 5. Validation requirements (before real-company use)

The game's financial models are simplified and use simulated events. Before applying them to real companies, validate against real transaction data: profit calculations, financing costs, cash-flow projections, FX exposure, trade profitability, working-capital requirements, credit risk, scenario impacts. Deterministic test cases must reproduce the existing game outputs bit-for-bit after refactoring.

## 6. Current status

- Game fully functional (Decisions / Market / Capital / Trade tabs).
- New platform tabs shipped: **Cash Flow**, **AI CFO**, **Scenarios** — all computed by the shared engine, advisory-only, estimates labeled.
- Next: split `game.js` into shared modules + golden tests (Phase 2).
