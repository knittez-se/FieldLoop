# Handout: the app (Ivan's part), split into two work areas

Read `README.md` and `MVP.md` first. The app is a Next.js + TypeScript project. Dominik's data script is **not** part of this work: it only delivers the three files in `data/` (`field_scores.csv`, `fields.geojson`, `weather.csv`). We never process satellite images in the app.

The app work is split into two areas so two agents can work in parallel without editing the same files.

| Area | Owner | Owns these files |
| --- | --- | --- |
| **A — Logic, data & AI** | Agent A | `src/lib/**` (except `src/lib/ui-*.ts`), `src/app/api/**` |
| **B — Screens & demo flow** | Agent B | `src/app/**/page.tsx`, `src/app/layout.tsx`, `src/app/not-found.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/ui-*.ts` |

Shared files (`README.md`, `package.json`): small edits only, pull right before editing.

Deadline: Sunday 25 October 2026, 23:59 (submit around 20:00). Checkpoint: Saturday night, the full five-step loop from MVP.md works.

## How the two areas meet

Area B only uses what Area A exports. The current interface:

- **State:** `useAppState()` from `src/lib/store.ts` returns the whole `AppState` (`src/lib/types.ts`), or `null` before the browser has loaded it (show a loading state).
- **Actions** (`store.ts`): `startInspection`, `assignInspection`, `toggleCheck`, `addInspectionNote`, `addInspectionPhoto`, `removeInspectionPhoto`, `completeInspection`, `submitObservation`, `updateSettings`, `resetDemoData`, `syncFieldData`.
- **Derived views** (`selectors.ts`): `rankInspections`, `activeInspections`, `dashboardStats`, `fieldStatus`, `mapStatus`, `fieldAnomalies`, `recommendedNextSteps`, `weatherSummary`.
- **Agent:** `POST /api/agent { mode, context }` → `AgentResponse` (`src/lib/agent/types.ts`). Build the context with `buildAgentContext(state, fieldId, inspectionId?)`.

Rules:

- B needs new data or a new action → B asks A (or writes a request in the PR/commit message). B may add **pure display helpers** in `src/lib/ui-*.ts` without asking.
- A changes an exported signature → A updates every caller in the same commit, or keeps the old one working.
- Area A works on `dev`. Area B works on its own branch created from `dev` (for example `ui`). Commit small and push often. When both are done, the branches are merged, tested together and only then pushed to `main`. Nobody pushes to `main` directly.
- B can pull A's progress any time with `git merge origin/dev` on its own branch.
- Honesty rules from MVP.md apply everywhere: anything simulated is labeled, the app never claims a diagnosis from greenness data alone, the AI never claims to have looked at a photo.

## Before anything else (whoever starts first)

1. `npm install && npm run dev`, open http://localhost:3000 and click through the demo flow in the README.
2. `npm run build` must pass. The code was type-checked and tested in a browser, but never built with real Next.js, because npm was blocked in the environment that wrote it. Fix whatever breaks and commit it as "Fix first real build".

---

## Area A — Logic, data & AI

Goal: the numbers, rankings and AI texts are correct, explainable and work with Dominik's real files.

### A1. Real LLM for the Field Agent

- Put an `ANTHROPIC_API_KEY` in `.env.local` (never commit it) and check that `/api/agent` really answers in LLM mode (Settings shows "LLM configured").
- Check the answers for all six modes against the rules in `src/lib/agent/llm.ts` (no invented numbers, no diagnosis, says photos were not analyzed). Tighten the prompt where needed.
- If the call fails, the route must fall back to demo mode (already built, verify it).

### A2. "The AI reads the report" (MVP step 5)

Today the adviser picks the outcome by hand. Add an AI step that reads the adviser's notes and findings:

- New route `POST /api/process-report` (+ a function in `src/lib/agent/` that B can call) that takes the inspection's notes, checked items, findings text and the linked anomaly.
- Returns: suggested outcome (`issue_confirmed` / `no_issue_found` / `needs_follow_up`), a short structured summary of what was confirmed, open questions, and a suggested follow-up date or action.
- Demo mode without API key: a simple, clearly labeled rule-based version (keywords such as "no pests", "dry soil", "larvae").
- The adviser always confirms or edits the suggestion before it is saved. Tell B the function name and response type.

### A3. Make re-ranking visible in the data

- When an inspection is completed or a report creates a new task, record how the queue changed (for example "Kapsara East Block resolved, Saboti Upper Field is now #1").
- Expose it as a selector (for example `lastQueueChange(state)`) so B can show it on the Overview.

### A4. Dominik's real data

- When `data/*` files appear on `main`, merge `main` into `dev` and check Settings → Field data: no warnings, correct real/simulated counts.
- Check the change detection (`src/lib/detection.ts`) on his real numbers. Tune thresholds only if the planted or real problem fields are not found, and document every change in the comment at the top of the file.
- Handle missing weeks (clouds): fields with gaps must not be flagged just because a week is missing.

### A5. Robustness and tests

- A small test script (`npm run test:logic`, plain Node or Vitest) for `detection.ts`, `priority.ts` and the CSV/GeoJSON parsers in `field-data.ts`, using small inline sample data.
- Remove the unused placeholder `src/lib/services/satellite.ts` and its mentions (satellite processing is Dominik's script, not the app).

### A — definition of done

- Agent answers come from a real LLM when a key is set, and fall back to the demo cleanly without one.
- Completing an inspection with a typed note produces an AI-suggested outcome the adviser can accept.
- Queue changes are available as data.
- The app works with Dominik's real files without manual fixes.

---

## Area B — Screens & demo flow

Goal: the 3-minute demo from MVP.md is fast, clear and looks good on a laptop and a phone.

### B1. First real run

- Run the app with real Next.js and real Lucide icons; fix layout or icon problems.
- Check every page at phone width (about 390px): no sideways scrolling, buttons large enough to tap.

### B2. Advisor visit screen (phone first)

- A focused screen for the field visit, reachable from an inspection (for example `/inspections/[id]/visit`): what to check, big buttons for start, note (with dictation), photo and done.
- Uses only existing actions. When A2 is ready, show the AI-suggested outcome and let the adviser accept or edit it.

### B3. Case history

- A clear per-field timeline (MVP step 4): alert → inspection created → visit started → notes/photos → report → new status.
- Built from `state.activity`, `state.inspections`, `state.reports` and `state.observations`. Add display helpers in `src/lib/ui-history.ts` if needed.

### B4. Show the re-ranking

- After an inspection is completed, the Overview should make the change obvious (before → after rank, a short highlight on the field that moved up).
- Use A3's selector when it exists. Until then, compare `rankInspections` before and after in the UI.

### B5. Map polish

- Field name labels on the map, the selected field highlighted, priority colors that match the list.
- The map only displays the outlines from `data/fields.geojson`. No satellite imagery.

### B6. Demo readiness

- Make "Reset demo data" easy to find before each run.
- Update the README "Demo flow" to the final click path, take screenshots for the README and the submission, and help record the backup video.

### B — definition of done

- The five MVP steps can be shown in under 3 minutes without searching for buttons.
- Phone view works for the adviser part.
- README screenshots and demo steps match the app.
