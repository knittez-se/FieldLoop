# FarmSignal

**From satellite alert to fixed field.**

Built for the Polaris Global Hackathon (October 2026).

FarmSignal is an AI field operations assistant for small farming cooperatives. It uses satellite and weather signals to find fields that have changed, ranks them by urgency, and turns each alert into a concrete visit for a field advisor. The advisor reports back by voice note or photo, and FarmSignal tracks the case until it is resolved.

## The problem

Satellites can already tell a farmer that a field looks stressed. What they cannot do is walk to the field.

A cooperative may look after hundreds of small plots with only a few advisors. The hard part is not seeing a red patch on a map. It is deciding which field to visit first, knowing what to look for once there, and making sure every alert ends with someone actually checking the plants. Today that follow-up often lives in spreadsheets, phone calls and memory.

## What FarmSignal does

1. **Spots changes.** Compares each field's crop health signal against its own history and combines it with recent weather.
2. **Ranks the fields.** A transparent rule-based score produces a prioritized inspection queue: which field to visit first, why it was flagged, and how uncertain the signal is.
3. **Plans the visit.** For each flagged field it suggests what the advisor should check on site, for example signs of water stress versus pests.
4. **Closes the loop.** The advisor records notes (typed or dictated), photos and confirmed findings. FarmSignal updates the field's status, re-ranks the queue and keeps a record of what was checked and what happened.
5. **Field Agent.** An assistant embedded in each field and inspection summarizes why a field needs attention, builds checklists and questions, and turns observations into structured reports — always separating observed facts, confirmed findings and unverified hypotheses.

FarmSignal never claims a diagnosis from a satellite image alone. A low vegetation reading means "something changed here, go and look", not "this is the cause".

## Demo flow (3 minutes)

The app ships with a fictional cooperative (Nzoia Valley Maize Cooperative, Trans-Nzoia, Kenya) and 8 maize fields.

1. **Overview** — the dashboard says *Inspect first: Kapsara East Block (FS-104)*, score 95. A simulated vegetation index dropped 18% in the north-east section and the farmer reported leaf rolling.
2. **Field Map** — FS-104 is red with an anomaly marker. Click it → field panel → *Field details*.
3. **Field page** — six-part anomaly assessment (observed / why it matters / hypotheses / confidence / verify on site / next action), simulated index trend, weather context. Ask the Field Agent *"Why does this field need attention?"*.
4. **Inspection** — open INS-1312 → *Start inspection* → tick checks → add a note (or dictate) → add a photo → choose *Issue confirmed*, write findings and a recommendation → *Complete inspection*.
5. **Back to Overview** — high-priority alerts drop from 1 to 0, the queue re-ranks, the activity feed and field history show the completed inspection.
6. **Field Agent** → *Summarize latest findings* separates what was confirmed on site from what is still a hypothesis.
7. Optional: **Report observation** from the sidebar for another field → a new inspection task is created automatically.

*Settings → Reset demo data* restores the scenario before each run.

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Satellite data (Sentinel-2) | **Simulated.** Vegetation index series are demo data and labeled "Simulated" everywhere in the app. Integration point prepared in `src/lib/services/satellite.ts`. |
| Weather data | **Live if reachable** via Open-Meteo (free, no key), otherwise clearly labeled sample weather. The demo scenario's dry spell uses the sample data. |
| Ranking | **Real logic, rule-based** (documented in `src/lib/priority.ts`). Not a validated risk model. |
| Explanations by the AI agent | **Demo mode** (deterministic, built only from the field records) without an API key; **LLM** (Claude via the Anthropic API) when `ANTHROPIC_API_KEY` is set. |
| Voice or photo field report | **Real.** Voice uses the browser's speech recognition (Chrome/Edge/Safari); photos are downscaled and stored locally. Photos are not analyzed by AI. |
| Cooperative, advisors and field boundaries | Simulated for the demo |
| Problem signals in the demo fields | Simulated for the demo, clearly labeled in the app |

## Tech stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS v4, Lucide icons
- Leaflet + OpenStreetMap tiles for the field map (SVG fallback if tiles or Leaflet are unavailable)
- Next.js route handlers for the Field Agent (`/api/agent`) and weather (`/api/weather`)
- Open-Meteo weather API (free, no key)
- Optional: Anthropic API for the Field Agent (server-side only)
- Persistence: browser `localStorage` (prototype)

## Run it locally

Requires Node.js 20+.

```bash
git clone https://github.com/knittez-se/Polaris-Hackathon---FarmSignal.git
cd Polaris-Hackathon---FarmSignal
git checkout dev
npm install
npm run dev
```

Open http://localhost:3000.

Optional — real LLM for the Field Agent:

```bash
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY=...
# restart npm run dev
```

Never commit `.env.local` or real keys.

Production build check: `npm run build && npm start`.

## Project structure

```
src/
  app/                    pages (App Router)
    page.tsx              Overview dashboard
    map/                  Field Map
    fields/[id]/          Field details + anomaly assessment
    inspections/          Prioritized queue + inspection workflow
    reports/              Field reports, new observation form
    settings/             Current user, integrations, reset demo
    api/agent/            Field Agent (LLM or demo mode)
    api/weather/          Open-Meteo proxy
  components/             UI components (map, agent, inputs, cards)
  lib/
    types.ts              Domain model (Farm, Field, Anomaly, InspectionTask, ...)
    demo-data.ts          Fictional seed data — replace with real loaders later
    store.ts              Data-access layer + actions (localStorage)
    priority.ts           Documented rule-based priority score
    selectors.ts          Derived views / dashboard stats
    agent/                Agent context builder, demo agent, LLM client
    services/             External integrations (weather, satellite placeholder)
```

To move to a real backend, keep the action signatures in `store.ts` and replace `load`/`persist` with API calls.

## Limitations

- Sentinel-2 pixels cover about 10 by 10 meters. Very small or mixed-crop plots are hard to judge from space, so FarmSignal compares whole fields and changes over time rather than pinpointing individual sick patches.
- Clouds, especially in rainy seasons, can hide fields for days or weeks.
- Data is stored in each browser's localStorage: it is not shared between devices or team members, is limited to ~5 MB (photos are downscaled), and is lost when site data is cleared.
- There is no login; the "current user" is chosen in Settings.
- Voice dictation depends on browser support (not available in Firefox).
- This is a 72-hour prototype. It has not been tested with real farmers or advisors, and its recommendations are not agronomic advice.

## How this relates to existing tools

Tools such as CropSense, OpenFarm and Open Farm Analytics already offer satellite crop monitoring and alerts. We are not trying to build a better map. FarmSignal focuses on the workflow after the alert: assigning the check, collecting the report, and tracking it to resolution. We have only reviewed these products' public websites, so some of their features may go further than we describe.

## Roadmap

Ideas beyond the hackathon, not built yet:

- Real Sentinel-2 vegetation indices per field (Copernicus Data Space)
- Shared database and accounts for teams
- Offline use for advisors with weak internet
- Support for more crops and regions
- Advisor-friendly voice input in local languages
- Tracking whether an intervention actually improved the field
- Testing with a real cooperative to validate the workflow

## Team

- Dominik Knitter
- Ivan Ivanovic

## Acknowledgements

Satellite data (planned) from the Copernicus Sentinel-2 mission (ESA). Weather data: [Open-Meteo](https://open-meteo.com) (CC BY 4.0). Map data © OpenStreetMap contributors.
