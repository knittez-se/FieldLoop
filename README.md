# FarmSignal

**From satellite alert to fixed field.**

Built for the Polaris Global Hackathon (October 2026).

Working on this? Start with [MVP.md](MVP.md) for the scope, the data file we share, and who builds what.

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

The app ships with a fictional cooperative (Nzoia Valley Maize Cooperative, Trans-Nzoia, Kenya) and 8 maize fields. `data/` holds the shared simulated files (regenerate with `python3 scripts/make_sample_data.py`). If those files are missing, the app falls back to the built-in sample and the top field id changes.

1. **Overview** — the dashboard says *Inspect first: Kapsara East Block (F3)*, score 95. Its simulated greenness fell about 46% against its own recent weeks while the other fields stayed steady, and the farmer reported leaf rolling. One other field (Kwanza Lower, F6) is a milder, medium-priority signal. Press **Start visit**.
2. **Field Map** — F3 is labeled and drawn in red. The map shows field outlines only, not a satellite image. Click it → *Start visit* or *Field details*.
3. **Field page** — six-part anomaly assessment (observed / why it matters / hypotheses / confidence / verify on site / next action), simulated index trend, weather context, and a **case history** timeline. Ask the Field Agent *"Why does this field need attention?"*.
4. **Visit** (`/inspections/INS-1312/visit`, phone layout) — *Start visit* → tick checks → add a note (or dictate) → add a photo → *Suggest an outcome* (demo rules, or the model when a key is set) → edit it → *Complete visit*. The suggestion only restates the note. It does not look at the photo. Choosing *Needs follow-up* keeps the field on the queue as a new visit.
5. **Back to Overview** — a **Queue updated** banner names the field that left and the field that is now first. High-priority alerts drop from 1 to 0. The case history on the field page shows the completed visit.
6. **Field Agent** → *Summarize latest findings* separates what was confirmed on site from what is still a hypothesis.
7. Optional: **Report observation** from the sidebar for another field → a new inspection task is created automatically.

*Reset demo* is in the sidebar and under Overview, and on Settings. Use it before each run.

Screens from this branch:

![Overview](docs/screenshots/overview-desktop.png)

![Phone visit](docs/screenshots/visit-phone.png)

![Case history](docs/screenshots/field-desktop.png)

*Settings → Reset demo data* restores the scenario before each run.

## Field data (shared with the data script)

The app reads three files from `data/` (contract in [MVP.md](MVP.md)):

| File | Columns / content |
| --- | --- |
| `data/field_scores.csv` | `field_id,date,greenness,source` (`source` = `real` or `simulated`) |
| `data/fields.geojson` | one Polygon per field with property `field_id` (optional: `name`, `farm`, `growth_stage`) |
| `data/weather.csv` | `date,rainfall_mm` |

- `GET /api/field-data` reads the files on every page load. If they changed, the demo state is rebuilt from them (a blue notice says so). *Settings → Reload data files* re-checks manually. A reload replaces in-browser edits with a fresh scenario.
- The files in `data/` are simulated (`source = simulated`), generated by `scripts/make_sample_data.py`. F3 is the planted large drop; F6 is a milder drop.
- Without `data/field_scores.csv` the app uses a built-in simulated sample (`src/lib/builtin-field-data.ts`).
- Any field IDs work (`F1`…`F8` or others). Fields without an outline are drawn as placeholder squares; problems are listed under *Settings → Field data*.
- **Change detection** (`src/lib/detection.ts`) compares each field's last reading with its own earlier weeks and with the median change of the other fields. Fields that fall clearly behind become anomalies with an open inspection task. Readings with `source = real` are labeled Sentinel-2, everything else "Simulated".
- The fictional workflow history (a farmer report on the top flagged field, one inspection in progress, two completed reports) is attached automatically to whatever fields the data contains.

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Satellite data (Sentinel-2) | Read from `data/field_scores.csv` (data script). Rows with `source = simulated` and the built-in fallback are labeled "Simulated" in the app. TODO: update once the script produces real numbers. |
| Weather data | Rainfall from `data/weather.csv` (built-in sample if missing). Optional live Open-Meteo lookup in Settings. |
| Change detection and ranking | **Real logic, rule-based** (`src/lib/detection.ts`, `src/lib/priority.ts`). Not a validated risk model. |
| Reading the adviser's report | **AI suggestion** (`/api/process-report`): suggests the outcome, summarizes the adviser's own notes and lists supported or ruled-out causes. LLM with an API key, transparent keyword rules without. The adviser always confirms. |
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

Logic tests (change detection, data parsers, priority score, report analysis): `npm run test:logic`.

## Project structure

```
src/
  app/                    pages (App Router)
    page.tsx              Overview dashboard
    map/                  Field Map
    fields/[id]/          Field details + anomaly assessment
    inspections/          Prioritized queue + inspection workflow
    inspections/[id]/visit  Phone-first adviser visit screen
    reports/              Field reports, new observation form
    settings/             Current user, integrations, reset demo
    api/agent/            Field Agent (LLM or demo mode)
    api/weather/          Open-Meteo proxy
    api/field-data/       Reads the data/ files
  components/             UI components (map, agent, inputs, cards)
  lib/
    types.ts              Domain model (Farm, Field, Anomaly, InspectionTask, ...)
    field-data.ts         Data contract types + CSV/GeoJSON parsers
    builtin-field-data.ts Built-in simulated sample (used when data/ is empty)
    detection.ts          Rule-based change detection (own history + neighbors)
    demo-data.ts          Builds the app state from field data + fictional workflow history
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

Satellite crop monitoring and farm advice already exist: EOSDA Crop Monitoring (change alerts, a field leaderboard, scouting reports), OneSoil (free NDVI maps that flag problem spots), Farmonaut (WhatsApp-based satellite reports for smallholders), Cropin and Farmforce (field-team and outgrower management), Plantix (photo diagnosis) and Digital Green's FarmerChat (voice and WhatsApp advice). We are not trying to build a better map or a better chatbot. FarmSignal focuses on the workflow after the alert for a cooperative with few advisers: which field to visit first and why, what to check, an AI that reads the adviser's report, and tracking each case to resolution. See [docs/COMPETITOR_RESEARCH.md](docs/COMPETITOR_RESEARCH.md). We have only reviewed these products' public websites, so some of their features may go further than we describe.

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
