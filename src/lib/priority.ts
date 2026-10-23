/**
 * Rule-based inspection priority score (MVP).
 *
 * This is a TRANSPARENT HEURISTIC to sort the inspection queue — it is NOT a
 * validated risk model and must not be presented as a prediction of crop loss.
 *
 * Score = sum of the factors below, capped at 100:
 *
 *   1. Severity of the worst unresolved anomaly linked to the task
 *        high  → +40   medium → +25   low → +10
 *   2. Magnitude of recent change in the vegetation index (|changePct|)
 *        ≥ 15% → +20   ≥ 8% → +10   otherwise → 0
 *   3. Time since the field was last inspected
 *        never or > 21 days → +20   > 10 days → +10   otherwise → 0
 *   4. Fresh ground report (farmer/adviser observation in the last 7 days) → +15
 *   5. Low signal confidence on all linked anomalies → −5
 *
 * Priority level:  score ≥ 60 → high,  ≥ 35 → medium,  otherwise → low.
 *
 * Completed tasks keep their last score but are excluded from the open queue.
 */
import type { Anomaly, AppState, Field, InspectionTask, Priority } from "./types";

export interface ScoreFactor {
  label: string;
  points: number;
}

export interface PriorityResult {
  score: number;
  level: Priority;
  factors: ScoreFactor[];
}

const SEVERITY_POINTS = { high: 40, medium: 25, low: 10 } as const;
const DAY = 24 * 60 * 60 * 1000;

export function daysBetween(fromIso: string | undefined, now: Date): number | undefined {
  if (!fromIso) return undefined;
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY);
}

export function levelForScore(score: number): Priority {
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function scoreInspection(
  task: InspectionTask,
  state: Pick<AppState, "anomalies" | "observations" | "fields">,
  now: Date = new Date(),
): PriorityResult {
  const factors: ScoreFactor[] = [];
  const anomalies: Anomaly[] = state.anomalies.filter((a) => task.anomalyIds.includes(a.id));
  const unresolved = anomalies.filter((a) => a.status === "open" || a.status === "under_review");
  const relevant = unresolved.length > 0 ? unresolved : anomalies;

  // 1. Severity
  const worst = relevant.reduce<Anomaly | undefined>(
    (acc, a) => (!acc || SEVERITY_POINTS[a.severity] > SEVERITY_POINTS[acc.severity] ? a : acc),
    undefined,
  );
  if (worst) {
    factors.push({ label: `${capitalize(worst.severity)}-severity signal`, points: SEVERITY_POINTS[worst.severity] });
  }

  // 2. Recent change
  const maxChange = Math.max(0, ...relevant.map((a) => Math.abs(a.changePct ?? 0)));
  if (maxChange >= 15) factors.push({ label: `Large recent change (${maxChange}%)`, points: 20 });
  else if (maxChange >= 8) factors.push({ label: `Moderate recent change (${maxChange}%)`, points: 10 });

  // 3. Time since last inspection
  const field: Field | undefined = state.fields.find((f) => f.id === task.fieldId);
  const days = daysBetween(field?.lastInspectionAt, now);
  if (days === undefined || days > 21) {
    factors.push({ label: days === undefined ? "Never inspected" : `Last inspected ${days} days ago`, points: 20 });
  } else if (days > 10) {
    factors.push({ label: `Last inspected ${days} days ago`, points: 10 });
  }

  // 4. Fresh ground report
  const freshReport = state.observations.some(
    (o) =>
      o.fieldId === task.fieldId &&
      (task.observationIds.includes(o.id) || o.inspectionId === task.id) &&
      (daysBetween(o.createdAt, now) ?? 99) <= 7,
  );
  if (freshReport) factors.push({ label: "Fresh ground report (≤ 7 days)", points: 15 });

  // 5. Low confidence
  if (relevant.length > 0 && relevant.every((a) => a.confidence === "low")) {
    factors.push({ label: "Low signal confidence", points: -5 });
  }

  const raw = factors.reduce((s, f) => s + f.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  return { score, level: levelForScore(score), factors };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
