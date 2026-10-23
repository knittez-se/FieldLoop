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
import { activeInspections, changeGroups, dashboardStats, greennessChange, greennessTimeline, impactSummary, lastQueueChange, todayBriefing, weeklyCapacity } from "../src/lib/selectors";

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

test("showcase data tells its four stories", () => {
  const d = detectChanges(BUILTIN_FIELD_DATA.fields, BUILTIN_FIELD_DATA.weather);
  const crop = (id: string) => BUILTIN_FIELD_DATA.fields.find((f) => f.id === id)?.crop;
  assert.deepEqual(d[0].fieldId, "KAP-08"); // spreading problem, origin
  assert.equal(d[0].severity, "high");
  for (const id of ["KAP-07", "KAP-09", "SAB-01", "SAB-02", "SAB-06", "SAB-07"]) assert.ok(d.some((x) => x.fieldId === id), id);
  assert.ok(!d.some((x) => crop(x.fieldId) === "sorghum"), "harvest dry-down must not be flagged");
  assert.ok(!d.some((x) => x.fieldId === "KIM-04"), "recovered field must not be flagged");
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
  assert.equal(q[0].task.fieldId, "KAP-08");
  assert.equal(q[0].priority.level, "high");
  const p = scoreInspection(q[0].task, s, new Date("2026-10-23T12:00:00Z"));
  assert.ok(p.factors.some((f) => /Fresh ground report/.test(f.label)));
  const stats = dashboardStats(s, new Date("2026-10-23T12:00:00Z"));
  assert.equal(stats.totalFields, 40);
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

// --- the committed data/ files (data contract with the data script) -----------

test("data/ files follow the contract and flag only the planted problem field", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(path.join(dir, "field_scores.csv"))) return; // nothing committed yet
  const warnings: string[] = [];
  const scores = parseFieldScores(fs.readFileSync(path.join(dir, "field_scores.csv"), "utf8"), warnings);
  const shapes = parseFieldsGeojson(fs.readFileSync(path.join(dir, "fields.geojson"), "utf8"), warnings);
  const weather = parseWeather(fs.readFileSync(path.join(dir, "weather.csv"), "utf8"), warnings);
  assert.deepEqual(warnings, []);
  const fields = [...scores.keys()].map((id) => ({ id, boundary: shapes.get(id)?.boundary ?? [], readings: scores.get(id)! }));
  assert.ok(fields.every((f) => f.boundary.length >= 3), "every field has an outline");
  assert.ok(weather.length > 0);
  const flagged = detectChanges(fields, weather);
  assert.ok(flagged.length >= 1, "at least one field is flagged");
  assert.equal(flagged[0].severity, "high");
  // the flagged field must contain the planted (simulated) readings, so the app labels it
  assert.equal(flagged[0].allReal, false);
});

// --- round 2: onboarding, briefing, capacity, time-lapse ----------------------

test("onboarding profile limits the demo to the picked fields", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const profile = { role: "adviser" as const, regionId: "ke-trans-nzoia", crops: ["maize"], fieldIds: ["KAP-07", "KAP-08", "KAP-09", "KAP-01", "KAP-02"], advisers: 1, visitsPerAdviserDay: 2 };
  const s = createSeedState(BUILTIN_FIELD_DATA, now, { profile });
  assert.equal(s.fields.length, 5);
  assert.equal(s.profile?.advisers, 1);
  assert.equal(activeInspections(s, now)[0].task.fieldId, "KAP-08");
  const cap = weeklyCapacity(s, now);
  assert.equal(cap.adviserDays, Math.ceil(cap.visitsNeeded / 2));
  // unknown ids (e.g. after switching data) fall back to all fields
  const s2 = createSeedState(BUILTIN_FIELD_DATA, now, { profile: { ...profile, fieldIds: ["F1"] } });
  assert.equal(s2.fields.length, 40);
});

test("briefing, impact and timeline are derived from the data", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const s = createSeedState(BUILTIN_FIELD_DATA, now);
  const b = todayBriefing(s, now);
  assert.match(b.headline, /^\d+ of 40 fields need a visit\. Start with /);
  assert.ok(b.inspectionId);
  const imp = impactSummary(s, now);
  assert.equal(imp.fieldsMonitored, 40);
  assert.equal(imp.visitsAvoidedPct, Math.round((1 - imp.needVisit / 40) * 100));
  const t = greennessTimeline(s);
  assert.equal(t.weeks.length, 10);
  const kap08 = t.byField["KAP-08"].map((x) => x.value as number);
  assert.ok(kap08[9] < kap08[5] - 0.1, "the spreading problem is visible in the time-lapse");
});

test("greenness change compares the newest reading with the one 3 readings earlier", () => {
  const s = createSeedState(BUILTIN_FIELD_DATA, new Date("2026-10-23T12:00:00Z"));
  const f = s.fields[0];
  f.vegetationIndex.series = [0.5, 0.5, 0.6, 0.5, 0.4, 0.3].map((value, i) => ({ date: `2026-09-0${i + 1}`, value, source: "real" as const }));
  const c = greennessChange(s).find((x) => x.field.id === f.id)!;
  assert.equal(c.pct, -50); // 0.3 vs 0.6
  assert.equal(c.simulated, false);
  const groups = changeGroups(s);
  assert.equal(groups.reduce((n, g) => n + g.count, 0), s.fields.length, "every field lands in exactly one group");
  assert.ok(groups[0].count >= 1, "the -50% field is falling fast");
});

test("briefing does not repeat the farmer report when it is the only reason", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const s = createSeedState(BUILTIN_FIELD_DATA, now);
  for (const a of s.anomalies) a.source = "farmer_report"; // every task now comes from a farmer report alone
  const top = activeInspections(s, now)[0];
  s.observations.push({ ...s.observations[0], inspectionId: top.task.id, authorRole: "farmer" });
  assert.doesNotMatch(todayBriefing(s, now).detail, /also reported/);
});
