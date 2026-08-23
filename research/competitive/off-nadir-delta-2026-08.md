# Competitive Analysis: Off-Nadir Delta vs World Monitor

**Date:** 2026-08-23
**World Monitor baseline:** `origin/main` @ `b534c32` (2026-08-22), app v2.10.0, MCP server v1.17.0
**Subject:** [offnadir-delta.com](https://offnadir-delta.com/) — "Off-Nadir Delta — Real-Time Event & Geospatial Intelligence: Where to Look Today"

> **Research caveat:** offnadir-delta.com could not be fetched directly from the research environment (egress-blocked), so all competitor facts come from search-index snippets of their pages, MCP/npm/PyPI registries, GitHub, and social archives. Their exact tier prices and monthly token allocations were **not indexable** and are marked unknown. Everything about World Monitor comes from this repo at HEAD.

---

## 1. Executive summary

Off-Nadir Delta (OND) is a **solo-founder** product by Kazushi Motomura (Tokyo-based remote-sensing specialist, 10+ years, day job at Space Shift Inc.). It launched **~Jan 3, 2026** on Japanese Twitter as a hobby WebGIS for satellite imagery, and within ~7 months repositioned into **"Geographic Risk Intelligence"** — a news-signals + satellite-verification platform with an MCP server, REST API, Python SDK, and token-metered pricing. Since July 2026 it has effectively re-launched *into our category*: geolocated event feeds (GDELT-derived), a daily prioritized watchfloor, an AI analyst, and a world brief.

**The one-sentence verdict:** World Monitor is far broader and deeper on every axis we compete on today (68 vs 24 MCP tools, 221 API RPCs vs ~a dozen endpoints, 36 signal domains vs ~1, open source, desktop app, 6 variants, enterprise tier) — but OND has four things worth taking seriously:

1. **A closed intelligence loop we don't have:** event → recommended satellite sensor → collection window → imagery check → AOI anomaly monitoring. "Verified from space" is their wedge and our gap (satellite imagery/SAR is Enterprise-only for us).
2. **A friendlier developer funnel:** free API keys + MCP access **on every plan including Free**, gated only by a token balance — vs our Pro-only live tools and a thin 5-calls/day free-account taste.
3. **Usage-based pricing primitives** we lack: token metering, one-time top-ups valid 365 days, team token pools with no per-seat licensing, and "standing orders" billed **per change, not per check**.
4. **A machine-first distribution playbook executed with discipline:** programmatic SEO that is already being cited by LLM deep-research agents, plus MCP-registry/npm distribution (~4,000 downloads/month, 38 releases in 5 weeks) — with essentially **zero human word of mouth**. Their growth is entirely search engines and AI agents.

They are not an immediate commercial threat (no visible traction, no team, no enterprise motion, hobby-project framing at launch). They are a **directional signal**: a remote-sensing expert independently converged on our category and chose *agents and answer engines* as the entire go-to-market. The convergence play is symmetric — they are adding news intelligence to satellite; we should add satellite verification to news intelligence before "verified from space" becomes table stakes.

---

## 2. Company snapshot

| | Off-Nadir Delta | World Monitor |
|---|---|---|
| Team | Solo (Kazushi Motomura, Off-Nadir Lab), side project | Independent, active daily development (#7086 merged at HEAD) |
| Launched | ~Jan 3, 2026 (Japanese X/Twitter, "hobby & study project") | 2024; v2.10.0 at HEAD |
| Source | Closed (SDK + MCP client are Apache-2.0; GitHub org has 0 stars/forks) | **AGPL-3.0 open source**, self-hostable (`SELF_HOSTING.md`, GHCR image), MIT thin clients |
| Core competence | Remote sensing / satellite imagery (SAR specialist) | News/OSINT aggregation, cross-domain signal analysis, agent infrastructure |
| Data backbone | GDELT (events) + Copernicus/NASA/Planetary Computer (imagery) | 578+ upstream hosts across 36 domains |
| Traction signals | npm MCP package ~4k downloads/mo; LLM citations of their blog; nothing else public | WIRED coverage, Discord community, GitHub stars, Smithery/mcp.so/official registry listings |

---

## 3. Landing page & positioning

### Their story

- **Tagline:** "Real-Time Event & Geospatial Intelligence: **Where to Look Today**." Hero: "turns scattered signals — news, open data, satellite imagery — into prioritized intelligence: where to look, why it matters, and what satellites can show."
- The product is framed as **five verbs**, not a feature list: **Watchfloor** ("everywhere, today" — daily prioritized picture), **Map** ("one place, right now" — verify an event from space), **Monitor** ("one place, over time" — fix an area, auto anomaly detection), **Agent** (AI analyst that recommends what to image next), **Reports** (daily assessment with Key Judgments and calibrated confidence).
- **Trust posture is a differentiator:** "Delta results are decision-support, not confirmed intelligence — every signal links back to its original sources"; a public Methodology & AI-Limitations page; a **claim ledger** recording every analyst assertion with an evidence class (CONFIRMED / REPORTED / PARTY_CLAIM / ASSESSMENT) and independent-source counts.
- **Zero-friction top of funnel:** Watchfloor and the Signals feed are browsable with **no account**; free plan needs no credit card; 3-day trials of paid tiers.
- Personas: OSINT, geopolitical-risk, and satellite-intelligence analysts; secondarily emergency management, media, ESG/deforestation verification, NGOs.
- Repositioned mid-2026: search indexes still show the old titles ("Satellite-Based Area Monitoring Platform") next to the new ones ("Geographic Risk Intelligence") — a deliberate pivot toward our space.

### Our story

- `worldmonitor.app` is the **app itself**, not a marketing page (title: "Real-Time Global Intelligence Dashboard"). The real landing page is `/pro` (React app in `pro-test/`): headline **"Noise → Signal"**, value prop "The intelligence geopolitical AI layer — ask it, subscribe to it, build on it," 28 locales, WIRED badge, pricing table, enterprise showcase.
- Our positioning is **capability-led** (ask / subscribe / build; 12 tracked domains) where theirs is **decision-led** ("where to look today, and why").

### Assessment

Their headline answers the analyst's actual morning question; ours describes an architecture. "Noise → Signal" is good, but "ask it, subscribe to it, build on it" sells *modes of access*, not *the decision the user gets to make faster*. We already compute everything needed for a "where to look today" promise (world brief, 29 escalation-ranked hotspots, focal points, signal convergence, CII v8) — we under-sell prioritization as *the* product. Their five-verb architecture (today / right now / over time / explain / assess) is also a cleaner mental model than our 132-panel breadth, which can read as "yet another dashboard" to a first-time visitor.

---

## 4. Feature comparison

| Area | Off-Nadir Delta | World Monitor @ HEAD | Edge |
|---|---|---|---|
| Event feed | Delta Signals: GDELT-derived, AI-enriched (category, severity, GEOINT relevance, escalation trend, corrected geolocation, source links) | News clustering + spike detection across 100+ sources, X/Telegram feeds, 36 signal domains, UCDP/conflict layers, durable 180-day vector intel memory | **WM** (breadth, multi-source), OND has per-event *collection recommendation* we lack |
| Prioritization | Watchfloor: severity-ranked daily picture + grid-binned hotspot cells | World brief, 29 curated hotspots w/ 1–5 escalation, focal points, signal convergence, CII v8, temporal anomalies | **WM** analytically; **OND** presents it as the entire product |
| Satellite imagery | Core: Sentinel-1 SAR (incl. RTC), Sentinel-2, NISAR, VIIRS, FIRMS, OPERA, GIBS; imagery search API; GeoTIFF/COG upload; free viewers | FIRMS fires, thermal domain, satellites layer, GPS jamming; **imagery/SAR is Enterprise-only** | **OND** — this is their moat |
| AOI monitoring | Draw polygon → auto NDVI/SAR/fire time series, MAD z-score anomaly detection, "count ships alongside a berth / burned area / water extent" per new acquisition | Watchlists, alert rules, geofenced layers — no per-AOI satellite time series | **OND** |
| Collection planning | Pass prediction for 7 satellite families (Sentinel-1/2, Landsat + WorldView, ICEYE, Capella, SkySat) with access windows, off-nadir angle, sunlit flag | None | **OND** (unique, cheap-to-copy dataset) |
| AI analyst | Delta Agent: sourced, geolocated briefs; usage-billed (~5–40 tokens) | WM Analyst chat w/ citations, Scenario Engine, `analyze_situation`, `generate_forecasts` + **Brier-scored forecast scorecard** | **WM** (scorecard is a verifiable-accuracy asset OND lacks) |
| Honesty scaffolding | Claim ledger w/ evidence classes; AI-limitations page; "decision-support, not confirmed intelligence" | Source attribution, freshness metadata, forecast scorecard | **OND** on presentation; we have the substance but don't surface evidence classes |
| Alerting | Standing orders: saved question + bbox, re-answered on schedule, notify **only on change**, billed per change | Alert-rules engine + personal AI digest (30 ranked items, daily/2×/weekly) to Slack/Discord/Telegram/email/webhook, quiet hours, AES-256 channels | **WM** on delivery maturity; **OND** on the metered alert-on-change primitive |
| Map/UX | Browser WebGIS, layer compare, GeoJSON export | 3D globe + WebGL flat map, ~54 layers, 196 panels, 6 vertical variants, live channels, webcams, embeds | **WM** |
| Desktop / CLI / SDKs | Python SDK only | Tauri desktop (macOS/Win/Linux), CLI (`npx worldmonitor`), Python + Ruby + Go SDKs | **WM** |
| Self-hosting / open source | No | Yes (AGPL, docker-compose, Ollama local AI) | **WM** |
| Team/enterprise | Shared token pool, single bill | Pro Business, API tiers, Enterprise (SSO/RBAC, SIEM, white-label, air-gapped, Android TV) | **WM** |

---

## 5. API & MCP comparison

| Dimension | Off-Nadir Delta | World Monitor |
|---|---|---|
| REST API | `/api/v1`: signals, brief (free), analyst, status, usage (free), stats, hotspots, imagery search, passes, standing orders, claim ledger. OpenAPI 3.1, cursor pagination, rate-limit headers, Idempotency-Key | **221 proto RPCs / 227 handlers** across 36 domains at `api.worldmonitor.app`, OpenAPI 3.1 (12 inject passes), idempotency, hard 429s w/ `Retry-After` |
| API access | **Every plan incl. Free** gets API keys (`ond_…`); only gate is token balance; non-commercial on Free | API tiers: Starter $99.99 (1,000 req/day), Business $299.99 (300 req/min, 10k/day). Dashboard `wm_…` keys: MCP 50/day |
| MCP server | **24 tools** ("discover, plan, analyze, watch, account"), Streamable HTTP, OAuth 2.1 + DCR + PKCE, stateless; resources + prompts; in official MCP registry (2026-08-14); npm client package | **68 tools**, Streamable HTTP + OAuth 2.1, **6 workflow prompts**, resources + URI templates, **10 interactive MCP Apps (UI widgets)**, agent-readiness discovery (anonymous `tools/list`), `describe_tool` 120-byte compression, universal JMESPath projection + `summary` flag, three-layer error model w/ self-correction envelopes, CI-enforced MCP↔API parity, 26 published Agent Skills, WebMCP, A2A |
| MCP access gating | Free on all plans; brief/status/usage free; queries token-billed | `get_sources` anonymous; cache tools for free accounts at **5 calls/day, 3 windows/day**; all live tools **Pro-only**; Pro 50/day, Business 250/day |
| Distinctive primitives | **Standing orders** (alert-on-change, billed per change); **claim ledger** (evidence classes); collection planning; freshness object on briefs | JMESPath projection; MCP Apps; prompts; forecast scorecard; intel history vector search; parity CI; md-twins/llms.txt for agents |
| SDKs | Python (Apache-2.0, sync+async, Pydantic, auto-pagination, built-in MCP client) | Python, Ruby, Go, CLI — all zero-dependency MIT |

### Assessment

Technically our MCP is a generation ahead (Apps, prompts, projection, parity CI, skills). But their **access model** is better tuned for how agents actually adopt tools: an agent (or the human configuring one) can connect on day one on the Free plan, get real answers, and hit a token wall *after* experiencing value. Our funnel front-loads the wall — the 68-tool surface is visible but a free account gets 5 cache-tool calls/day and zero live tools. The tell: their npm MCP client does ~4k downloads/month five weeks after launch while their GitHub org has zero stars — pure agent-side pull, no community. Also note **24 focused tools** is arguably easier for an LLM to select from than 68; our `describe_tool` compression mitigates context cost but not selection load — the 6 prompts are our answer and deserve more prominence and count.

---

## 6. Pricing comparison

**Off-Nadir Delta — metered tokens (exact $ unknown, not indexable):**
- 1 token = 1 satellite tile (256×256); map session ≈ 20–50 tokens; Agent question ≈ 5–40 tokens, billed by actual work.
- Plans: Free / Starter / Pro (+ Team = shared token pool, one bill, **no per-seat licensing**, "no minimum").
- Free plan: permanent, no card, monthly token allocation, non-commercial only; browsing Watchfloor/Signals needs no account at all.
- Indexed capacity hints: Free ≈ up to ~40 analyst questions, ~40 assessments, ~66 signal API queries/mo; a higher tier ≈ up to ~2,000 questions, ~2,000 assessments, ~3,333 signal queries/mo.
- Subscription tokens reset monthly (no rollover); **one-time top-ups never reset and stay valid 365 days**; 3-day trials; proration up, end-of-cycle down.

**World Monitor — flat tiers (`convex/config/productCatalog.ts`, Dodo Payments):**
- Free $0 (no signup, 3 tabs, 5–15 min refresh) · **Pro $39.99/mo** ($359.99/yr) · **Pro Business $49.99** (commercial license, export, 250 MCP/day) · **API Starter $99.99** (1,000 req/day) · **API Business $299.99** (10k/day, redistribution, 5 Pro seats) · Enterprise custom.
- Hard limits, never silently charged; overage = 429; free-account MCP taste 5 calls/day.

### Assessment

Their model prices *work done* (tiles rendered, agent effort); ours prices *access tiers*. Consequences worth studying:

- **Spiky usage is monetized, not lost.** A journalist who needs heavy analysis one week a quarter buys a top-up (valid 365 days). Our equivalent user must commit to $39.99/mo or $99.99/mo, or bounce off a hard 429.
- **The $0 → $39.99 cliff.** OND has a continuous ramp (free tokens → small top-up → subscription). We have a wall, and our free MCP taste (5 cache calls/day) is likely too thin to let an agent workflow prove its value before the paywall.
- **Team simplicity.** One shared pool, no seats, beats our "API Business includes 5 Pro licenses on the same email domain" and "Pro→Pro Business requires cancel + re-checkout."
- Counterpoint in our favor: flat tiers are predictable and enterprise-friendly; token anxiety is real; and their token unit (satellite tiles) maps poorly to our cost structure. The lesson isn't "copy tokens," it's **add a metered ramp** (credit packs / usage-based agent tier) between Free and Pro, and keep flat tiers for teams/enterprise.

---

## 7. Marketing & word of mouth

**Finding: OND has essentially zero human word of mouth — and is growing anyway.**

- **Nothing found on:** Hacker News, Reddit (r/gis, r/OSINT, r/geopolitics…), Product Hunt, LinkedIn content, press, testimonials, case studies, user counts, third-party reviews. The OSINT community shows no awareness despite the OSINT positioning.
- **Launch:** one Japanese tweet (Jan 3, 2026, "hobby & study project"), one #indiedev YouTube demo, a one-day Hatena Bookmark blip. No sustained social presence.
- **Channel 1 — programmatic SEO (dominant):** ~144 blog articles in ~7 months ("Sentinel-2: The Complete Guide", "SAR: The Complete Guide"), a glossary, methodology/FAQ/guide pages, **free no-login tool pages** (`/sentinel-2-viewer`, `/active-fire-map` — "free, no login, no API key", `/nighttime-lights-map`, `/ship-monitoring`), **ranked comparison pages** ("Best OSINT Satellite Imagery Tools (2026) — Ranked & Compared"), and **programmatic country pages** (`/situation/russia`, `/situation/lebanon`). Verified payoff: multiple unrelated GitHub repos contain LLM deep-research outputs citing their blog as references — they've achieved **answer-engine visibility**, which compounds as more research is agent-mediated.
- **Channel 2 — MCP-ecosystem distribution (Jul–Aug 2026):** official MCP registry (2026-08-14), awesome-mcp-servers listing with Glama badge, aggregator scrapes, npm client at ~4k downloads/mo with **38 releases in 5 weeks**, PyPI SDK. The MCP registries are functioning as their launch platform.

**World Monitor's current motion, for contrast:** 53 SEO/comparison blog posts, 253 docs pages + full Chinese mirror, llms.txt/llms-full.txt/md-twins/agents.md, 26 published Agent Skills, official MCP registry + Smithery + mcp.so, press kit, community promotion guide, Discord, WIRED badge, README in ja/zh, 28 Pro-page locales, referral tracking. We already run most of this playbook — *plus* the human/community channels they lack (open source, Discord, press).

**Their genuinely new ideas for us:** free no-login single-purpose tool pages as SEO honeypots; programmatic `/situation/{country}` pages; "Best X (2026) — Ranked" pages; a public glossary; publishing cadence as a strategy (~5 posts/week); and treating LLM citation of your content as a measurable channel.

---

## 8. What we should learn (recommendations)

Ranked by expected impact vs effort:

### Positioning
1. **Sell the decision, not the architecture.** Add a "Where to look today" motif to `/pro` and the app's first-run: lead with the world brief + escalation-ranked hotspots as *the* product ("Here's what changed and what to watch — with the evidence"), with ask/subscribe/build as the three ways to consume it. Everything needed already ships (world brief, hotspot escalation, focal points, CII).
2. **Surface our honesty scaffolding.** We have Brier-scored forecasts — a verifiable-accuracy asset OND cannot match — but it lives in a blog post and one MCP tool. Put the scorecard on the landing page. Add OND-style **evidence classes** (confirmed / reported / claimed / assessed) to analyst and brief outputs; we have source attribution internally, this is mostly presentation.
3. **Name the loop.** Their five-verb frame (today / right now / over time / explain / assess) is a teachable structure. Ours could be: *Brief → Watch → Ask → Verify → Deliver.*

### Product / API / MCP
4. **Close the "verify from space" gap (their moat, our biggest hole below Enterprise).** Phase 1 is cheap: per-event *collection recommendation* (which open sensor could see this, next Sentinel-1/2 pass window) — pure orbital math + event geolocation we already have; expose as `get_collection_windows` and embed in event payloads. Phase 2: Sentinel-2/S1 chip preview via Planetary Computer/AWS COGs on event pages. Phase 3 (bigger): AOI time-series monitoring with anomaly detection.
5. **Ship a metered alert-on-change MCP primitive** (`create_watch` / standing-orders equivalent) on top of the existing alert-rules engine: saved query + region, re-evaluated on schedule, notifies and bills only on change. This is the single best API idea they have — it converts our digest strength into an agent-native, meterable product.
6. **Widen the agent funnel.** Today: free account = 5 cache calls/day, live tools Pro-only. Consider a monthly **credit allowance on free accounts that works on all read tools** (live included, at a low cap), plus purchasable credit packs (365-day validity) below the $39.99 cliff. Success metric: MCP connections that survive week 1.
7. **Curate the 68-tool surface for selection, not just context.** Keep the full registry, but consider a `profile`/toolset parameter (e.g. "core-12") and more workflow prompts (6 → 15+), since prompts are how agents should navigate 68 tools. Their 24-tool focus is a real ergonomic advantage for LLM tool selection.

### Pricing
8. **Add a usage ramp between $0 and $39.99** (credit packs / pay-as-you-go API-lite) and **fix the team story** (shared quota pool, self-serve Pro→Pro Business upgrade instead of cancel + re-checkout).

### Marketing
9. **Programmatic country pages:** `/situation/{country}` (or `/countries/{iso2}`) prerendered from `get_country_brief` + CII + hotspots, refreshed daily — 190+ indexable, agent-citable pages we can generate from existing RPCs. This is their best SEO play and we can do it with better data.
10. **Free no-login tool pages as SEO honeypots:** live fire map, chokepoint status board, earthquake map, flight-disruption board — we already have `embed.html` panels and public data; each page is a standing answer for a high-intent query (theirs: "free, no login, no API key").
11. **Glossary + ranked comparison pages** ("Best geopolitical risk APIs (2026) — ranked"): we have 53 posts; add the evergreen reference formats that LLMs cite.
12. **Track LLM citations as a channel.** Their blog shows up in agent-generated research docs across GitHub. Grep GitHub/Common Crawl periodically for worldmonitor.app citations; optimize the pages that agents quote (md-twins already give us an edge here).
13. **Don't copy their silence.** Their zero-community approach works only because nobody is contesting the machine channels yet. We should hold both: keep the human channels (open source, Discord, press) they can't replicate solo, while matching their machine-channel discipline (their npm cadence: 38 releases in 5 weeks).

---

## 9. Threat assessment

- **Today: low commercial threat.** Solo side project, no visible revenue/traction, no team features beyond a token pool, no enterprise motion, closed source, liability-disclaimed "small independently operated service."
- **Directionally: worth a quarterly check.** A domain expert pivoted into our category in six months and chose agents + answer engines as the entire GTM. If MCP-mediated consumption keeps growing, their "free API/MCP on every plan + token meter" funnel is the shape native to that world. Watch: their npm download curve, whether they land the remaining 12 unnamed MCP tools into analysis territory (convergence with us), whether they add delivery channels (digests) and team/enterprise features, and any pricing-page changes (exact tiers were not yet indexable).
- **Where we're defensible:** breadth + cross-domain analysis (36 domains, convergence/cascade/forecast tooling), open source + self-hosting, delivery infrastructure, enterprise capabilities, multi-language reach, and a forecast accuracy record. None of these are replicable by a solo closed-source project quickly.
- **Where they're defensible against us:** genuine remote-sensing depth (SAR processing, collection planning, anomaly detection on imagery time series). Phase 1–2 of recommendation #4 narrows the gap; matching their full imagery stack is a real investment and should be a deliberate roadmap decision, not a reflex.

---

## Appendix A — Fact sources

**Off-Nadir Delta:** offnadir-delta.com pages via search snippets (/, /about, /methodology, /pricing, /faq, /mcp, /docs/mcp, /docs/sdks, /guide, /terms, /use-cases, /blog, /glossary, free-tool and /situation/* pages); official MCP registry (`com.offnadir-delta/mcp`, 2026-08-14); npm (`offnadir-delta-mcp`, first publish 2026-07-15, v1.12.2 by 2026-08-19); PyPI (`offnadir-delta`); GitHub org Off-Nadir-Lab; launch tweet x.com/kazushi_fa/status/2007420283611951619 (2026-01-03); punkpeye/awesome-mcp-servers; Hatena archive (yuiseki/hatebu-ai).

**Known unknowns:** exact $ prices and token allocations per tier; free-tier token count; 12 of the 24 MCP tool names; numeric API rate limits; whether Team is a distinct priced tier; SDK repo URL.

**World Monitor:** repo at `b534c32` — `README.md`, `ARCHITECTURE.md`, `CONCEPTS.md`, `CHANGELOG.md`, `api/mcp/registry/*` (68 tools), `api/mcp/prompts/`, `api/mcp/ui/` (10 MCP Apps), `convex/config/productCatalog.ts` (pricing), `pro-test/src/locales/en.json` (landing copy), `docs/` (253 pages), `blog-site/` (53 posts), `SELF_HOSTING.md`, `sdk/`, `cli/`, `src-tauri/`.
