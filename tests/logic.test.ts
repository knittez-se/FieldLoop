/**
 * Logic tests (Area A). Run with:  npm run test:logic
 * Uses Node's built-in test runner via tsx — no browser, no Next.js needed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectChanges, detectionSkips } from "../src/lib/detection";
import { parseFieldScores, parseFieldsGeojson, parseWeather, type FieldInput } from "../src/lib/field-data";
import { scoreInspection, levelForScore } from "../src/lib/priority";
import { analyzeReportDemo, type ReportInput } from "../src/lib/agent/report";
import { createSeedState } from "../src/lib/demo-data";
import { BUILTIN_FIELD_DATA } from "../src/lib/builtin-field-data";
import { activeInspections, dashboardStats, lastQueueChange } from "../src/lib/selectors";

const weeks = (n: number, end = "2026-10-19") =>
  Array.from({ length: n }, (_, i) => new Date(new Date(end).getTime() - (n - 1 - i) * 7 * 86_400_000).toISOString().slice(0, 10));

function field(id: string, values: number[], opts: { end?: string; source?: "real" | "simulated" } = {}): FieldInput {
  return {
    id,
    boundary: [],
    readings: weeks(values.length, opts.end).map((date, i) => ({ date, greenness: values[i], source: opts.source ?? "simulated" })),
  };
}

const steady = (base: number) => [0.5, 0.56, 0.61, 0.65, base, base + 0.01, base, base + 0.01, base, base + 0.01];

// --- detection -------------------------------------------------------------

test("flags a field that drops for 3 weeks while neighbours stay steady", () => {
  const fields = [
    field("F1", steady(0.7)),
    field("F2", steady(0.68)),
    field("F3", [0.5, 0.56, 0.61, 0.65, 0.7, 0.71, 0.71, 0.65, 0.6, 0.55]),
    field("F4", steady(0.72)),
  ];
  const d = detectChanges(fields, []);
  assert.equal(d.length, 1);
  assert.equal(d[0].fieldId, "F3");
  assert.equal(d[0].severity, "high");
  assert.equal(d[0].consecutiveDrops, 3);
});

test("a region-wide decline is not flagged (all fields fall together)", () => {
  const falling = (o: number) => [0.5, 0.56, 0.61, 0.65, 0.7 + o, 0.71 + o, 0.7 + o, 0.66 + o, 0.62 + o, 0.58 + o];
  assert.equal(detectChanges([field("A", falling(0)), field("B", falling(0.01)), field("C", falling(-0.01))], []).length, 0);
});

test("a single low last reading (possible cloud) is capped at medium with low confidence", () => {
  const fields = [field("A", steady(0.7)), field("B", steady(0.7)), field("C", [...steady(0.7).slice(0, 9), 0.5])];
  const d = detectChanges(fields, []);
  assert.equal(d[0].fieldId, "C");
  assert.equal(d[0].severity, "medium");
  assert.equal(d[0].confidence, "low");
  assert.ok(d[0].caveats.some((c) => /cloud/i.test(c)));
});

test("fields with too few or stale readings are skipped, not flagged", () => {
  const fields = [
    field("A", steady(0.7)),
    field("B", steady(0.7)),
    field("SHORT", [0.6, 0.5, 0.4]),
    field("STALE", [0.5, 0.56, 0.61, 0.65, 0.7, 0.71, 0.7, 0.6, 0.5, 0.4], { end: "2026-09-28" }),
  ];
  const skips = detectionSkips(fields).map((s) => s.fieldId).sort();
  assert.deepEqual(skips, ["SHORT", "STALE"]);
  assert.equal(detectChanges(fields, []).length, 0);
});

test("normal week-to-week wobble (±0.01) is not counted as a drop", () => {
  const d = detectChanges([field("A", steady(0.7)), field("B", steady(0.7)), field("C", [...steady(0.7).slice(0, 8), 0.66, 0.63])], []);
  assert.equal(d[0].fieldId, "C");
  assert.equal(d[0].consecutiveDrops, 2);
});

test("built-in sample flags exactly the two planted problem fields", () => {
  const d = detectChanges(BUILTIN_FIELD_DATA.fields, BUILTIN_FIELD_DATA.weather);
  assert.deepEqual(d.map((x) => [x.fieldId, x.severity]), [["FS-104", "high"], ["FS-112", "medium"]]);
});

// --- parsers ---------------------------------------------------------------

test("CSV parser reads the contract, averages duplicates and reports bad rows", () => {
  const warnings: string[] = [];
  const csv = "field_id,date,greenness,source\nF1,2026-10-12,0.70,real\nF1,2026-10-12,0.60,real\nF1,2026-10-19,0.65,simulated\nF2,not-a-date,0.5,real\n";
  const m = parseFieldScores(csv, warnings);
  assert.deepEqual(m.get("F1"), [
    { date: "2026-10-12", greenness: 0.65, source: "real" },
    { date: "2026-10-19", greenness: 0.65, source: "simulated" },
  ]);
  assert.ok(warnings.some((w) => /skipped 1/.test(w)));
  assert.ok(warnings.some((w) => /averaged 1/.test(w)));
});

test("GeoJSON parser converts [lng, lat] to [lat, lng] and keeps optional names", () => {
  const warnings: string[] = [];
  const gj = JSON.stringify({
    type: "FeatureCollection",
    features: [
      { properties: { field_id: "F1", name: "North plot" }, geometry: { type: "Polygon", coordinates: [[[35, 1], [35.001, 1], [35.001, 1.001], [35, 1]]] } },
      { properties: {}, geometry: null },
    ],
  });
  const m = parseFieldsGeojson(gj, warnings);
  assert.equal(m.get("F1")?.name, "North plot");
  assert.deepEqual(m.get("F1")?.boundary[0], [1, 35]);
  assert.ok(warnings.some((w) => /no field_id/.test(w)));
});

test("weather parser needs date and rainfall_mm", () => {
  const warnings: string[] = [];
  assert.equal(parseWeather("date,rainfall_mm\n2026-10-01,3.5\n", warnings)[0].rainfallMm, 3.5);
  assert.equal(parseWeather("day,rain\n1,2\n", warnings).length, 0);
  assert.ok(warnings.length === 1);
});

// --- priority + seed state ---------------------------------------------------

test("priority levels follow the documented thresholds", () => {
  assert.equal(levelForScore(60), "high");
  assert.equal(levelForScore(59), "medium");
  assert.equal(levelForScore(35), "medium");
  assert.equal(levelForScore(34), "low");
});

test("seed state puts the high-severity field with a farmer report at #1", () => {
  const s = createSeedState(BUILTIN_FIELD_DATA, new Date("2026-10-23T12:00:00Z"));
  const q = activeInspections(s, new Date("2026-10-23T12:00:00Z"));
  assert.equal(q[0].task.fieldId, "FS-104");
  assert.equal(q[0].priority.level, "high");
  const p = scoreInspection(q[0].task, s, new Date("2026-10-23T12:00:00Z"));
  assert.ok(p.factors.some((f) => /Fresh ground report/.test(f.label)));
  const stats = dashboardStats(s, new Date("2026-10-23T12:00:00Z"));
  assert.equal(stats.totalFields, 8);
  assert.equal(stats.highPriorityAlerts, 1);
  assert.equal(lastQueueChange(s), null);
});

// --- report analysis (demo rules) ----------------------------------------------

const baseInput = (notes: string[], extra: Partial<ReportInput> = {}): ReportInput => ({
  inspectionId: "INS-1",
  field: { id: "F3", name: "Test", growthStage: "V12" },
  checks: [
    { label: "Check soil moisture at 10–20 cm depth.", done: true },
    { label: "Take photos of affected and reference plants.", done: false },
  ],
  notes,
  photosCount: 0,
  groundReports: [],
  ...extra,
});

test("report: leaf rolling + dry soil + no insects → issue confirmed, water stress supported, pests ruled out", () => {
  const a = analyzeReportDemo(baseInput(["Leaf rolling on 15 of 20 plants in the NE corner. Soil dry at 15 cm. No insects in whorls."]));
  assert.equal(a.suggestedOutcome, "issue_confirmed");
  assert.ok(a.supported.some((s) => s.hypothesis === "water_stress"));
  assert.ok(a.ruledOut.some((s) => s.hypothesis === "pests"));
  assert.equal(a.findingsSummary, "Leaf rolling on 15 of 20 plants in the NE corner. Soil dry at 15 cm. No insects in whorls.");
  assert.equal(a.followUp.inDays, 5);
  assert.ok(a.openQuestions.some((q) => /photo/i.test(q)));
});

test("report: weeds only → no issue found", () => {
  const a = analyzeReportDemo(baseInput(["The patch is mostly couch grass weeds. Maize plants look healthy."]));
  assert.equal(a.suggestedOutcome, "no_issue_found");
});

test("report: symptoms but unclear cause → needs follow-up", () => {
  const a = analyzeReportDemo(baseInput(["Some yellowing on lower leaves, not sure why. Could be nitrogen?"]));
  assert.equal(a.suggestedOutcome, "needs_follow_up");
  assert.ok(a.supported.some((s) => s.hypothesis === "nutrients"));
});

test("report: empty notes → needs follow-up and no invented findings", () => {
  const a = analyzeReportDemo(baseInput([]));
  assert.equal(a.suggestedOutcome, "needs_follow_up");
  assert.equal(a.findingsSummary, "");
});

test("report: larvae found → issue confirmed with 7-day re-scout", () => {
  const a = analyzeReportDemo(baseInput(["Found larvae and fresh feeding damage on 6 of 50 plants."]));
  assert.equal(a.suggestedOutcome, "issue_confirmed");
  assert.ok(a.supported.some((s) => s.hypothesis === "pests"));
  assert.equal(a.followUp.inDays, 7);
});
