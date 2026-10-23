/**
 * Change detection: turns greenness (NDVI) readings into "potential anomaly" signals.
 *
 * Transparent rules — no machine learning, no diagnosis:
 *
 *   baseline     = mean of the 3 readings before the last 3 readings
 *   ownChange    = (last reading − baseline) / baseline                 → compares the field to its own past
 *   neighborChg  = median ownChange of all OTHER fields                 → what "normal" looks like this week
 *   relative     = ownChange − neighborChg                              → compares the field to its neighbors
 *   drops        = number of consecutive week-to-week declines at the end
 *
 *   severity high   : relative ≤ −15%,  or relative ≤ −10% with ≥ 3 consecutive drops
 *   severity medium : relative ≤ −8%
 *   severity low    : relative ≤ −4% with ≥ 2 consecutive drops
 *   otherwise       : no signal
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
  rain14dMm?: number;
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function ownChange(field: FieldInput) {
  const r = field.readings;
  if (r.length < 4) return null;
  const last = r[r.length - 1].greenness;
  const before = r.slice(Math.max(0, r.length - 6), r.length - 3).map((x) => x.greenness);
  const baseline = mean(before.length ? before : [r[0].greenness]);
  if (baseline <= 0.05) return null; // bare soil / no crop — ratio is meaningless
  let drops = 0;
  for (let i = r.length - 1; i > 0 && r[i].greenness < r[i - 1].greenness - 0.005; i--) drops++;
  return { baseline, last, change: (last - baseline) / baseline, drops };
}

export function rainLastDays(weather: RainfallRow[], days: number, until?: string): number | undefined {
  if (weather.length === 0) return undefined;
  const end = until ?? weather[weather.length - 1].date;
  const endT = new Date(end).getTime();
  const rows = weather.filter((w) => {
    const t = new Date(w.date).getTime();
    return t <= endT && t > endT - days * 86_400_000;
  });
  if (rows.length === 0) return undefined;
  return +rows.reduce((s, w) => s + w.rainfallMm, 0).toFixed(1);
}

export function detectChanges(fields: FieldInput[], weather: RainfallRow[]): Detection[] {
  const changes = new Map<string, NonNullable<ReturnType<typeof ownChange>>>();
  fields.forEach((f) => {
    const c = ownChange(f);
    if (c) changes.set(f.id, c);
  });

  const detections: Detection[] = [];
  fields.forEach((f) => {
    const c = changes.get(f.id);
    if (!c) return;
    const others = [...changes.entries()].filter(([id]) => id !== f.id).map(([, v]) => v.change);
    const neighbor = median(others);
    const relative = c.change - neighbor;

    let severity: Severity | null = null;
    if (relative <= -0.15 || (relative <= -0.1 && c.drops >= 3)) severity = "high";
    else if (relative <= -0.08) severity = "medium";
    else if (relative <= -0.04 && c.drops >= 2) severity = "low";
    if (!severity) return;

    const confidence: Confidence = c.drops >= 3 && relative <= -0.1 ? "medium" : "low";
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
      rain14dMm: rainLastDays(weather, 14, lastDate),
    });
  });
  const order = { high: 0, medium: 1, low: 2 } as const;
  return detections.sort((a, b) => order[a.severity] - order[b.severity] || a.relativePct - b.relativePct);
}
