/**
 * Change detection: turns greenness (NDVI) readings into "potential anomaly" signals.
 *
 * Transparent rules — no machine learning, no diagnosis:
 *
 *   baseline     = mean of the 3 readings before the last 3 readings
 *   ownChange    = (last reading − baseline) / baseline                 → compares the field to its own past
 *   neighborChg  = median ownChange of the OTHER fields with the same crop (all other fields if
 *                  fewer than 3 share the crop) → what "normal" looks like right now. Same-crop matters:
 *                  a crop drying down before harvest falls together and must not be flagged.
 *   relative     = ownChange − neighborChg                              → compares the field to its neighbors
 *   drops        = number of consecutive declines larger than 0.015 at the end
 *                  (smaller wobble is normal noise in real NDVI data)
 *
 *   severity high   : relative ≤ −15% with ≥ 2 consecutive drops,
 *                     or relative ≤ −10% with ≥ 3 consecutive drops
 *   severity medium : relative ≤ −8%  (a single low reading is capped here — it could be a cloud)
 *   severity low    : relative ≤ −4% with ≥ 2 consecutive drops
 *   otherwise       : no signal
 *
 * Real-data safeguards (clouds, gaps):
 *   - Fields with fewer than 4 readings are not evaluated.
 *   - Fields whose last reading is more than 10 days older than the newest reading of any
 *     field are not evaluated (a missing week must not look like a change).
 *   - A field whose readings span a gap of more than 21 days inside the evaluation window
 *     gets confidence "low".
 *   - Several readings on the same date are averaged by the parser (field-data.ts).
 *
 * A signal only means "something changed here, go and look". Causes are listed as
 * hypotheses that must be verified on site.
 */
import type { FieldInput, RainfallRow } from "./field-data";
import type { Confidence, Severity } from "./types";

export interface Detection {
  fieldId: string;
  severity: Severity;
  confidence: Confidence;
  baseline: number;
  last: number;
  ownChangePct: number;
  neighborChangePct: number;
  relativePct: number;
  consecutiveDrops: number;
  readingsUsed: number;
  lastDate: string;
  allReal: boolean;
  /** true if at least one reading is real Sentinel-2 data */
  anyReal: boolean;
  /** how many of the last 3 readings are simulated (e.g. a planted demo drop) */
  simulatedInLast3: number;
  rain14dMm?: number;
  /** Extra caveats about the data quality of this signal. */
  caveats: string[];
}

export interface DetectionSkip {
  fieldId: string;
  reason: string;
}

export const MIN_READINGS = 4;
export const MAX_STALE_DAYS = 10;
export const MAX_GAP_DAYS = 21;
/** Minimum week-to-week decrease that counts as a "drop". */
export const DROP_STEP = 0.015;
const DAY = 86_400_000;

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);

interface OwnChange {
  baseline: number;
  last: number;
  change: number;
  drops: number;
  maxGapDays: number;
}

function ownChange(field: FieldInput): OwnChange | null {
  const r = field.readings;
  if (r.length < MIN_READINGS) return null;
  const last = r[r.length - 1].greenness;
  const windowStart = Math.max(0, r.length - 6);
  const before = r.slice(windowStart, r.length - 3).map((x) => x.greenness);
  const baseline = mean(before.length ? before : [r[0].greenness]);
  if (baseline <= 0.05) return null; // bare soil / no crop — a ratio is meaningless
  let drops = 0;
  for (let i = r.length - 1; i > 0 && r[i].greenness < r[i - 1].greenness - DROP_STEP; i--) drops++;
  let maxGapDays = 0;
  for (let i = windowStart + 1; i < r.length; i++) maxGapDays = Math.max(maxGapDays, days(r[i - 1].date, r[i].date));
  return { baseline, last, change: (last - baseline) / baseline, drops, maxGapDays };
}

export function rainLastDays(weather: RainfallRow[], n: number, until?: string): number | undefined {
  if (weather.length === 0) return undefined;
  const end = until ?? weather[weather.length - 1].date;
  const endT = new Date(end).getTime();
  const rows = weather.filter((w) => {
    const t = new Date(w.date).getTime();
    return t <= endT && t > endT - n * DAY;
  });
  if (rows.length === 0) return undefined;
  return +rows.reduce((s, w) => s + w.rainfallMm, 0).toFixed(1);
}

/** Which fields cannot be evaluated, and why (shown as data warnings). */
export function detectionSkips(fields: FieldInput[]): DetectionSkip[] {
  const newest = fields.reduce((m, f) => {
    const d = f.readings[f.readings.length - 1]?.date;
    return d && d > m ? d : m;
  }, "");
  const skips: DetectionSkip[] = [];
  fields.forEach((f) => {
    if (f.readings.length < MIN_READINGS) {
      skips.push({ fieldId: f.id, reason: `only ${f.readings.length} reading(s), at least ${MIN_READINGS} needed` });
      return;
    }
    const lastDate = f.readings[f.readings.length - 1].date;
    if (newest && days(lastDate, newest) > MAX_STALE_DAYS) {
      skips.push({ fieldId: f.id, reason: `latest reading (${lastDate}) is ${days(lastDate, newest)} days older than the newest data` });
      return;
    }
    if (!ownChange(f)) skips.push({ fieldId: f.id, reason: "greenness too low to compare (bare soil or no crop)" });
  });
  return skips;
}

export function detectChanges(fields: FieldInput[], weather: RainfallRow[]): Detection[] {
  const skipped = new Set(detectionSkips(fields).map((s) => s.fieldId));
  const changes = new Map<string, OwnChange>();
  fields.forEach((f) => {
    if (skipped.has(f.id)) return;
    const c = ownChange(f);
    if (c) changes.set(f.id, c);
  });

  const detections: Detection[] = [];
  fields.forEach((f) => {
    const c = changes.get(f.id);
    if (!c) return;
    const cropOf = (id: string) => fields.find((x) => x.id === id)?.crop ?? "unknown";
    const all = [...changes.entries()].filter(([id]) => id !== f.id);
    const sameCrop = all.filter(([id]) => cropOf(id) === (f.crop ?? "unknown"));
    const others = (sameCrop.length >= 3 ? sameCrop : all).map(([, v]) => v.change);
    const neighbor = median(others);
    const relative = c.change - neighbor;

    let severity: Severity | null = null;
    if ((relative <= -0.15 && c.drops >= 2) || (relative <= -0.1 && c.drops >= 3)) severity = "high";
    else if (relative <= -0.08) severity = "medium";
    else if (relative <= -0.04 && c.drops >= 2) severity = "low";
    if (!severity) return;

    const caveats: string[] = [];
    if (c.drops <= 1) caveats.push("Only the latest reading is lower — it could be a cloud or haze artefact.");
    if (c.maxGapDays > MAX_GAP_DAYS) caveats.push(`There is a ${c.maxGapDays}-day gap in the recent readings.`);
    if (others.length < 2) caveats.push("Too few other fields to compare with reliably.");

    let confidence: Confidence = c.drops >= 3 && relative <= -0.1 ? "medium" : "low";
    if (caveats.length) confidence = "low";

    const lastDate = f.readings[f.readings.length - 1].date;
    detections.push({
      fieldId: f.id,
      severity,
      confidence,
      baseline: +c.baseline.toFixed(2),
      last: +c.last.toFixed(2),
      ownChangePct: Math.round(c.change * 100),
      neighborChangePct: Math.round(neighbor * 100),
      relativePct: Math.round(relative * 100),
      consecutiveDrops: c.drops,
      readingsUsed: f.readings.length,
      lastDate,
      allReal: f.readings.every((r) => r.source === "real"),
      anyReal: f.readings.some((r) => r.source === "real"),
      simulatedInLast3: f.readings.slice(-3).filter((r) => r.source !== "real").length,
      rain14dMm: rainLastDays(weather, 14, lastDate),
      caveats,
    });
  });
  const order = { high: 0, medium: 1, low: 2 } as const;
  return detections.sort((a, b) => order[a.severity] - order[b.severity] || a.relativePct - b.relativePct);
}
