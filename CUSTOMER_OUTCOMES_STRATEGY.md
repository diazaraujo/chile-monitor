# Customer Outcomes Strategy

**Working draft — August 2026.** A guiding document for reorienting World Monitor from selling software to selling outcomes. Grounded in a full audit of the shipped feature surface (panels, layers, alerting, digests, watchlists, Scenario Engine, Route Explorer, MCP, entitlements).

---

## 1. The premise

The nugget that prompted this: an AI accounting startup did 35 sales calls selling *software* to CFOs and closed $0. They repackaged the same technology as *"an outsourced accounting firm that's faster and cheaper because of AI"* and started converting. The lesson isn't "become a services company." It's:

> Customers don't buy tools. They buy their problem solved — fast, simply, and ideally without having to operate anything. Features are how *we* think. Outcomes are how *they* buy.

Applied to World Monitor, the thesis of this document is:

**World Monitor has built a world-class signal factory and a capable delivery system, but sells software units — panels, layers, dashboards, calls/day. The pivot is to reorganize the product around one sold outcome: "Know when something happening in the world affects *your* operations, what it means for *you*, and what to check next — delivered where you already work, without opening a dashboard."**

The dashboard doesn't go away. It becomes the evidence room and the demo. The delivered, personalized judgment becomes the product.

## 2. The honest audit: what we have vs. what we sell

### 2.1 The signal factory (world-class, and invisible to buyers)

We generate more judgment per event than almost any product in this space:

- **CII v8** — 31-country instability scoring with per-country editorial weights, floors, and 10 supplemental boost classes (`server/worldmonitor/intelligence/v1/get-risk-scores.ts`, `shared/cii-weights.ts`)
- **21 typed cross-source signals** — thermal spikes, GPS jamming, shipping disruption, sanctions surges, silent market divergence… (`server/worldmonitor/intelligence/v1/list-cross-source-signals.ts`)
- **Focal points** — per-entity fusion of news + 10 geo signal types into watch/elevated/critical urgency with generated narrative (`shared/analysis-focal-points.ts`)
- **Hotspot escalation + geographic convergence** — scored, cooldown-gated, with 24h history (`shared/analysis-hotspot-escalation.ts`, `shared/analysis-geo-convergence.ts`)
- **Durable intel memory** — 180-day server-side history with semantic search and *precedent matching* (`get_similar_events`)
- **Forecasts with a public scorecard**, threat classification (keyword → browser ML → LLM), keyword spike detection, news↔market correlation taxonomy (14 signal types including Silent Divergence)
- **Scenario Engine** — 6 disruption templates with real impact math over the trade graph
- **Route Explorer** — lane → chokepoints → alternatives → land corridors → country impact

### 2.2 The delivery system (capable, undersold)

- Two Pro-gated delivery engines: real-time relay (`scripts/notification-relay.cjs`) and digest/brief cron (`scripts/seed-digest-notifications.mjs`)
- Six channel types: Telegram, Slack, Discord, email, signed webhooks, web push — with quiet hours, dedup, cooldown decisions, per-channel health
- The Brief: per-user AI-composed magazine with share URLs and channel carousels
- Digest prompts **already inject personal context** — tickers, airports, airlines, enabled panels, framework (`scripts/lib/user-context.cjs`), and followed countries bias brief ordering (`scripts/lib/brief-compose.mjs`)

### 2.3 The gaps the audit exposed

1. **Personalization is fragmented.** Four separate watchlist primitives — followed countries (Convex), market tickers (localStorage), aviation airports/airlines, keyword monitors — plus pinned webcams. No unified object that says "this is what this customer is exposed to."
2. **Alert scoping stops at countries + tickers.** `alertRules` (`convex/schema.ts:202`) can scope by ISO country and ticker. You cannot watch a trade lane, a chokepoint, a commodity (HS2), a supplier, or a facility — the exact units our best signals are computed in.
3. **Signals terminate in panels.** The 21 cross-source signals, focal points, and escalation scores render in dashboard panels; almost none of them can *reach* a customer as a scoped, personalized alert.
4. **Scenario Engine is generic.** Six fixed templates against six seeded reporter countries. It cannot answer "what happens to *my* lanes."
5. **Onboarding starts after payment and configures cadence, not exposure.** The Pro Activation Interstitial (brief → alerts → power) is well-built delivery onboarding, but nothing asks the one question an outcome business must ask first: *"What do you need to protect?"* There is no free-tier onboarding at all.
6. **Pricing sells quotas.** Plan dimensions are `maxDashboards`, `mcpCallsPerDay`, `apiRequestsPerDay` (`convex/config/productCatalog.ts`) — units of software consumption, not units of problem solved.
7. **A company-monitoring subsystem already exists, dark.** 13 Convex tables behind `COMPANY_MONITORING_ROLLOUT_FLAGS`, plus shipped corporate intelligence (SEC-grounded filer resolution, material 8-K events). This is an outcome product waiting for outcome packaging.

## 3. The framework: the Outcome Ladder

Every capability sits on a rung. Buyers pay progressively more the higher the rung sits — because each rung absorbs work they'd otherwise do themselves.

| Rung | Question answered | Who does the work | World Monitor today |
|---|---|---|---|
| 6. Done-for-you | "Handle it and tell me what you did" | Vendor | — (Enterprise gestures at it) |
| 5. Action | "What should I do?" | Vendor proposes | Route alternatives, cascade sim — buried in Pro tools |
| 4. Relevance | "Does this affect *me*?" | Vendor computes | Partial: country/ticker scoping, brief bias |
| 3. Judgment | "What does this mean?" | Vendor | **Dense**: CII, escalation, convergence, forecasts, briefs |
| 2. Signal | "What's anomalous?" | Vendor | **Dense**: 21 signal types, spikes, focal points |
| 1. Data | "What's happening?" | Buyer reads | **Dense**: ~115 panels, 60 map layers, feeds |

**The strategic read:** we are extraordinarily dense on rungs 1–3, thin on rung 4, and nearly absent on 5–6 — yet revenue expands with altitude. Every roadmap item should climb the ladder, not widen the base. The base is already wider than any competitor's; width is our funnel, not our product.

## 4. The buyer map: who buys which outcome

| Persona | The outcome they'd pay for | What we already have | What's missing |
|---|---|---|---|
| Supply-chain / logistics ops | "Know before my lanes break, and what rerouting costs" | Route Explorer, Scenario Engine, chokepoints, AIS, trade routes | Saveable lanes; lane-scoped alerts; scheduled stress tests |
| Commodity / energy trader | "Physical-world signal before it prices in" | Energy Atlas stack, chokepoint strip, tanker AIS, inventories, Silent Divergence signal | Commodity/chokepoint-scoped delivery; divergence alerts to Slack/Telegram |
| Finance / PM | "Geopolitics translated to my book" | market-implications, watchlist story alerts, macro stack, prediction markets | Portfolio-level impact briefs; divergence + convergence alerts per holding |
| Corporate security / risk | "My people, sites and suppliers are watched" | CII, advisories, focal points, displacement, disease, company intel (dark) | Facility/asset watchpoints (lat/lon + radius); supplier watchlists; exportable incident briefs |
| Policy / research analyst | "Defensible evidence and precedent, fast" | Country briefs with citations, intel history, similar-events, evidence bundles | Outcome packaging; scheduled deliverables |
| Builders / agents | "My agent answers geo questions correctly" | 68 MCP tools, 6 workflow prompts, SDKs, WebMCP | Exposure-aware MCP resources; recipe-shaped docs; outcome pricing |

Every persona's outcome decomposes into the same sentence: **watch my things → tell me what matters → tell me what it means for me → tell me what to check next.** That's one product spine, six skins — exactly the economics the variant system already proved for topic skins.

## 5. The six pillars

### Pillar 1 — The Exposure Graph (unify the watchlists)

**One first-class object per customer: what they're exposed to.** Countries (exists, Convex), tickers (exists, localStorage), airports/airlines (exists), keyword monitors (exists) — plus the missing unit types our signals are already computed in: **trade lanes** (Route Explorer's from/to/HS2/cargo tuple), **chokepoints**, **commodities (HS2)**, **companies/suppliers** (the dark company-monitoring tables + SEC filer resolution), and **facilities** (lat/lon + radius watchpoints).

Build:
- Promote all watchlist primitives into one Convex-backed `exposureProfile` (the four current stores become views of it; localStorage stays as cache).
- "**Save this lane**" in Route Explorer — the state is already URL-encoded (`src/components/RouteExplorer/url-state.ts`); saving it is the smallest possible step from tool to subscription.
- Extend `alertRules` scoping beyond `countries[]`/`tickers[]` to lanes, chokepoints, HS2 chapters, companies, and watchpoints.
- Free tier: keep it generous but shallow — e.g. 3 follows + 1 lane + weekly digest. Gate *depth of personalization*, not data.

Why this is Pillar 1: every other pillar consumes this object. It's also the moat move — an AGPL codebase can be forked; a customer's configured exposure graph plus 180 days of intel history against it cannot.

### Pillar 2 — The Impact Engine (every alert answers "so what, for me?")

Today an alert says *what happened*. The outcome product appends *what it means for you*, computed by intersecting the event with the exposure graph:

> **Hormuz disruption score 62 (+18 in 6h).** Two of your three saved lanes transit Hormuz. Nearest precedent (2024-04): +40% tanker rates within 2 weeks. Alternative via Cape: +12 days, +1.4× cost. → Review Q4 freight hedges.

Everything in that sentence exists as a shipped capability: chokepoint scoring, lane geometry, `get_similar_events` precedent matching, Route Explorer alternatives math, Scenario Engine cost multipliers. The engine is a join, not new research: **event × exposure graph × precedent × alternatives**.

Build:
- New event family `exposure_impact_alert` beside `watchlist_story_alert`; per-rung sensitivity uses the existing sensitivity floors.
- The Brief leads with a "**Your exposure**" section (followed-bias today lifts stories *within* severity lanes — the impact section leads outright).
- Persona-specific first wins: Silent Divergence per held ticker (finance), lane disruption delta (supply chain), CII threshold crossing per followed country with component attribution (risk).

### Pillar 3 — Zero-UI delivery (the channel is the product)

Reframe delivery from "Pro feature" to primary surface. The bonus-points clause of the nugget — *customers prefer not to use the tool* — is literally achievable: after setup, a Pro customer should get full value from Slack alone, opening the dashboard only to drill down.

Build:
- **Exposure-first onboarding for everyone.** The Pro Activation Interstitial's mechanics (fire-once claims, delivery-honest exits — `src/services/pro-activation-state.ts`) become the model for a day-0 flow that starts with "What do you need to watch?" — before checkout, not after. Free users configure a real (small) exposure profile and get a real (weekly) digest: the taste of the outcome is the upgrade path.
- **Reply-to-analyst in channel.** WM Analyst (`api/chat-analyst.ts`) already streams over SSE with domain lenses; wiring Telegram/Slack replies to it turns every delivered alert into a conversation: "why?" answered where the alert landed.
- The dashboard's job description changes: acquisition, evidence, drill-down, configuration — measured accordingly (see §8).

### Pillar 4 — Personal stress tests (Scenario Engine × exposure graph)

The Scenario Engine's six templates are generic demos. Pointed at a customer's saved lanes they become the most enterprise-legible deliverable we can produce:

- **"Run Hormuz closure against my lanes"** — template impact math scoped to the exposure graph rather than the six seeded reporter countries.
- **The Quarterly Resilience Report** — a scheduled, exportable artifact (the export machinery exists: evidence bundles, CSV/JSON/PDF gates in `src/services/gates/export-resolver.ts`) that a logistics manager forwards to their boss. An artifact that circulates inside the customer's org is the outcome *and* the sales collateral.
- **Forecast-triggered pre-computation** — when a forecast probability crosses a threshold ("Taiwan disruption ≥ 20%"), auto-run the matching scenario against affected customers' graphs and deliver the result. This chains three shipped systems (forecasts → scenario worker → notification relay) into a genuinely novel capability: *pre-computed personal contingency*.

### Pillar 5 — Packaging: sell the job, not the quota

- **Rewrite plan copy in outcome units.** Pro: "Your exposure, watched — daily brief + real-time critical alerts on up to N watched items." Pro Business: "…plus deliverables you can hand to clients" (export is the licensing line, and it's an outcome line too). Quotas move to a limits appendix.
- **Persona landing pages** that preconfigure exposure onboarding ("Know before your supply chain does"). The variant system is proof we can ship targeted surfaces cheaply; point it at personas, not just topics. Topic variants remain the SEO funnel.
- **The Intelligence Desk — the accounting-startup move.** A productized service tier between Pro Business ($49.99) and Enterprise (custom): roughly **$500–1,500/mo** for "we configure and monitor your exposure; you get a weekly analyst-reviewed brief on your letterhead plus same-day flash alerts." Founder-delivered and deliberately manual for the first 5–10 customers. It bridges a canyon in the ladder ($50 → custom), and — the real point — those customers *are the spec*: what they ask for weekly is what Pillars 1–4 automate next. The nugget's founders learned more from delivering the service than from 35 demos.
- **Launch company monitoring as an outcome, not a panel.** When the 13 dark tables ship, the pitch is "know when your suppliers, customers, or competitors have a material event" — delivered to Slack, not rendered in a grid.
- **Enterprise pitch inverts**: not "white-label dashboards" but "your org's exposure graph, everyone's brief" — workspaces = shared exposure graphs with per-seat delivery.

### Pillar 6 — Agents as customers

The fastest-growing user who "hates software" is an agent. We're unusually well-positioned: 68 MCP tools, OAuth 2.1, WebMCP, A2A, six workflow prompts that are already outcome-shaped (`country-briefing`, `route-risk-check`, `energy-shock-watch`…).

Build:
- **Exposure-aware MCP resources**: `worldmonitor://me/exposure` and `worldmonitor://me/impacts` — a customer's agent asks "what affects us today?" in one call and gets the Pillar-2 join, not 68 tools to orchestrate. This makes the MCP subscription an *outcome* subscription.
- Recipe-shaped API docs per persona job ("embed a country-risk score in your product in an afternoon"), not endpoint references.
- Watch for outcome pricing on the API: per-answer products (a scored route-risk check) may eventually price better than requests/day.

## 6. What we deliberately do NOT change

- **The dashboard and open-source posture stay.** Stars → traffic → funnel → credibility. The reverse trap — gutting what works with builders to chase enterprise services — is as real as the feature trap.
- **Free tier stays generous on data.** We gate personalization depth and delivery, not situational awareness. The free product is the demo of the paid outcome.
- **We don't become a bespoke services firm.** The Intelligence Desk is a productized wedge with a fixed deliverable, priced as a product, run to learn what to automate. Headcount-scaling custom work is explicitly out of scope.
- **Engineering discipline stays.** The CONCEPTS.md culture (fail-closed filters, delivery-honest UX, mutation-proofed guards) is precisely what an outcome business needs more of — a wrong personalized alert costs more trust than a wrong panel.

## 7. Sequenced roadmap

**Phase 0 — Reposition & learn (weeks 0–2, no product changes)**
- Rewrite pro page + plan copy in outcome units; first two persona landing pages (supply chain, trader).
- Open Intelligence Desk to 5 hand-picked customers, founder-delivered, using existing tools + manual assembly.
- Instrument the funnel question: time-to-first-configured-watch item, digest opens, alert CTR.

**Phase 1 — The Exposure Graph (weeks 2–8)**
- Unify the four watchlists into a Convex exposure profile; "Save this lane" in Route Explorer; watchpoints (lat/lon + radius).
- Extend `alertRules` scoping to lanes / chokepoints / HS2 / companies / watchpoints.
- Exposure-first onboarding step for free and Pro (interstitial mechanics reused).

**Phase 2 — The Impact Engine (weeks 6–14, overlaps)**
- `exposure_impact_alert` events; impact line (exposure × precedent × alternative) on digest items; "Your exposure" lead section in the Brief.
- First three impact recipes: lane disruption delta, per-ticker silent divergence, CII threshold with component attribution.
- Reply-to-analyst on Telegram/Slack.

**Phase 3 — Stress tests, service, agents (weeks 12–20)**
- Scenario-on-my-lanes; Quarterly Resilience Report (scheduled, exportable); forecast-triggered pre-computation.
- Company monitoring launch, outcome-packaged.
- `worldmonitor://me/*` MCP resources; recipe docs.
- Decide from Desk learnings: automate the Desk into a tier, raise its price, or both.

## 8. Measuring the shift

| Old proxy (software) | New north star (outcome) |
|---|---|
| DAU, session length, panels enabled | **Weekly delivered-impact opens/reads** (digest + alert engagement per active exposure item) |
| Signups | % of signups with a configured exposure profile within 24h |
| MCP calls/day consumed | Agents subscribed to `me/impacts` |
| Churn (observed late) | Exposure-graph size + delivery engagement (leading indicators) |
| Feature launches shipped | Impact recipes shipped (event × exposure joins that reach a channel) |

The uncomfortable, correct implication: **dashboard time going *down* for paying customers can be success** — if delivered-impact engagement is going up.

## 9. Risks & open questions

1. **Wrong personalized alerts are expensive.** A generic wrong headline is noise; a wrong "your lane is affected" is a broken promise. The Impact Engine must inherit the fail-closed culture (attribution fails → don't deliver; Extraction Evidence Gate thinking applies).
2. **Coverage honesty.** Scenario impact math currently covers seeded reporter countries; lane-level claims must degrade honestly ("computed" vs "not covered") rather than fabricate confidence — the intel-history `upstreamUnavailable` pattern generalizes.
3. **Founder time.** The Intelligence Desk trades founder hours for learning + revenue. Cap it (5–10 accounts) and timebox the decision at Phase 3.
4. **Pricing migration.** Existing subscribers bought quota-framed plans; outcome reframing must be copy-first (no entitlement regressions), with the drift-guard test culture extended to the new claims.
5. **Does exposure-first onboarding hurt top-of-funnel?** The dashboard's instant-gratification open is an asset; onboarding must be skippable and re-entrant, never a wall.

---

*Companion inventory: the audit underlying §2 is reproducible from the registries listed in this document (panels: `src/config/panels.ts`; layers: `src/config/map-layer-definitions.ts`; alert rules: `convex/schema.ts`; catalog: `convex/config/productCatalog.ts`).*
