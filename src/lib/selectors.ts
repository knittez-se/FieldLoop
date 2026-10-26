/**
 * Business logic that derives views from AppState.
 * Every dashboard number is computed here from the underlying data — nothing is hardcoded.
 */
import { daysBetween, scoreInspection, type PriorityResult } from "./priority";
import type { Anomaly, AppState, Field, InspectionTask, Priority, QueueChange } from "./types";

export interface RankedInspection {
  task: InspectionTask;
  field: Field | undefined;
  priority: PriorityResult;
}

const STATUS_ORDER = { in_progress: 0, open: 1, completed: 2 } as const;

/** All inspections with their rule-based score, active ones first, then by score. */
export function rankInspections(state: AppState, now = new Date()): RankedInspection[] {
  return state.inspections
    .map((task) => ({
      task,
      field: state.fields.find((f) => f.id === task.fieldId),
      priority: scoreInspection(task, state, now),
    }))
    .sort((a, b) => {
      const aActive = a.task.status === "completed" ? 1 : 0;
      const bActive = b.task.status === "completed" ? 1 : 0;
      if (aActive !== bActive) return aActive - bActive;
      if (a.task.status === "completed") {
        return (b.task.completedAt ?? "").localeCompare(a.task.completedAt ?? "");
      }
      return b.priority.score - a.priority.score || STATUS_ORDER[a.task.status] - STATUS_ORDER[b.task.status];
    });
}

export function activeInspections(state: AppState, now = new Date()) {
  return rankInspections(state, now).filter((r) => r.task.status !== "completed");
}

/**
 * True when the loaded data has real Sentinel-2 readings from data/. Labels use this instead of
 * settings.dataMode, which can be "real" while the built-in showcase is still (or again) loaded.
 */
export function hasRealData(state: AppState) {
  return state.data.origin === "data_files" && state.fields.some((f) => f.vegetationIndex.series.some((r) => r.source === "real"));
}

export interface DashboardStats {
  totalFields: number;
  totalAreaHa: number;
  fieldsRequiringInspection: number;
  highPriorityAlerts: number;
  openTasks: number;
  inProgressTasks: number;
  reportsLast7Days: number;
}

export function dashboardStats(state: AppState, now = new Date()): DashboardStats {
  const active = activeInspections(state, now);
  return {
    totalFields: state.fields.length,
    totalAreaHa: +state.fields.reduce((s, f) => s + f.areaHa, 0).toFixed(1),
    fieldsRequiringInspection: new Set(active.map((r) => r.task.fieldId)).size,
    highPriorityAlerts: active.filter((r) => r.priority.level === "high").length,
    openTasks: active.filter((r) => r.task.status === "open").length,
    inProgressTasks: active.filter((r) => r.task.status === "in_progress").length,
    reportsLast7Days:
      state.reports.filter((r) => (daysBetween(r.createdAt, now) ?? 99) <= 7).length +
      state.observations.filter((o) => (daysBetween(o.createdAt, now) ?? 99) <= 7).length,
  };
}

export type FieldStatus = { level: Priority | "ok"; task?: InspectionTask; score?: number };

/** Current status of each field = highest-priority active inspection, or "ok". */
export function fieldStatus(state: AppState, fieldId: string, now = new Date()): FieldStatus {
  const top = activeInspections(state, now).find((r) => r.task.fieldId === fieldId);
  if (!top) return { level: "ok" };
  return { level: top.priority.level, task: top.task, score: top.priority.score };
}

/** Per-field status record for the map components. */
export function mapStatus(state: AppState, now = new Date()) {
  const result: Record<string, { level: Priority | "ok"; hasActiveInspection: boolean; score?: number }> = {};
  state.fields.forEach((f) => {
    const st = fieldStatus(state, f.id, now);
    result[f.id] = { level: st.level, hasActiveInspection: Boolean(st.task), score: st.score };
  });
  return result;
}

export function fieldAnomalies(state: AppState, fieldId: string): Anomaly[] {
  const order = { open: 0, under_review: 1, confirmed: 2, dismissed: 3 } as const;
  return state.anomalies
    .filter((a) => a.fieldId === fieldId)
    .sort((a, b) => order[a.status] - order[b.status] || b.detectedAt.localeCompare(a.detectedAt));
}

export function farmFor(state: AppState, field: Field | undefined) {
  return field ? state.farms.find((f) => f.id === field.farmId) : undefined;
}

export function adviserName(state: AppState, id: string | undefined) {
  if (!id) return undefined;
  return state.advisers.find((a) => a.id === id)?.name;
}

export function weatherSummary(state: AppState, field: Field) {
  void field; // one weather series for the whole demo area
  const series = state.weather;
  const last7 = series.slice(-7);
  const temps = last7.map((w) => w.tempMaxC).filter((t): t is number => typeof t === "number");
  let dryDays = 0;
  for (let i = series.length - 1; i >= 0 && series[i].precipitationMm < 1; i--) dryDays++;
  return {
    series,
    rain7d: +last7.reduce((s, w) => s + w.precipitationMm, 0).toFixed(1),
    avgMax7d: temps.length ? +(temps.reduce((s, t) => s + t, 0) / temps.length).toFixed(1) : undefined,
    dryDays,
    source: series[0]?.source,
  };
}

/** Rule-based recommended next steps for a field (not AI-generated). */
export function recommendedNextSteps(state: AppState, field: Field, now = new Date()): string[] {
  const status = fieldStatus(state, field.id, now);
  const steps: string[] = [];
  if (status.task?.status === "open") {
    steps.push(`Start the inspection "${status.task.title}"${status.level === "high" ? " within 48 hours" : ""}.`);
  } else if (status.task?.status === "in_progress") {
    steps.push(`Finish the ongoing inspection and record findings.`);
  }
  const openAnoms = fieldAnomalies(state, field.id).filter((a) => a.status === "open" || a.status === "under_review");
  openAnoms.forEach((a) => steps.push(a.nextAction));
  const lastReport = state.reports.filter((r) => r.fieldId === field.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (lastReport && !status.task && lastReport.recommendation) steps.push(lastReport.recommendation);
  const since = daysBetween(field.lastInspectionAt, now);
  if (!status.task && (since === undefined || since > 21)) steps.push("Schedule a routine visit — no inspection in the last 3 weeks.");
  if (steps.length === 0) steps.push("No action needed. Continue routine monitoring.");
  return Array.from(new Set(steps));
}

export interface QueueMove {
  inspectionId: string;
  fieldId: string;
  fieldName: string;
  fromRank: number | null; // 1-based, null = was not in the queue
  toRank: number | null; // null = left the queue (completed)
  movement: "new" | "resolved" | "up" | "down" | "same";
  score: number;
}

export interface QueueChangeView {
  id: string;
  at: string;
  cause: QueueChange["cause"];
  fieldId: string;
  inspectionId?: string;
  /** One sentence for a banner, e.g. "Kapsara East Block resolved — Saboti Upper Field is now #1." */
  headline: string;
  moves: QueueMove[];
}

/** The most recent queue change (or the one with `id`), with per-inspection rank movements. */
export function lastQueueChange(state: AppState, id?: string): QueueChangeView | null {
  const list = state.queueChanges ?? [];
  const change = id ? list.find((c) => c.id === id) : list[0];
  if (!change) return null;
  const name = (fieldId: string) => state.fields.find((f) => f.id === fieldId)?.name ?? fieldId;
  const ids = Array.from(new Set([...change.before, ...change.after].map((e) => e.inspectionId)));
  const moves: QueueMove[] = ids.map((inspectionId) => {
    const b = change.before.findIndex((e) => e.inspectionId === inspectionId);
    const a = change.after.findIndex((e) => e.inspectionId === inspectionId);
    const entry = change.after[a] ?? change.before[b];
    const fromRank = b >= 0 ? b + 1 : null;
    const toRank = a >= 0 ? a + 1 : null;
    const movement: QueueMove["movement"] =
      fromRank === null ? "new" : toRank === null ? "resolved" : toRank < fromRank ? "up" : toRank > fromRank ? "down" : "same";
    return { inspectionId, fieldId: entry.fieldId, fieldName: name(entry.fieldId), fromRank, toRank, movement, score: entry.score };
  });
  moves.sort((x, y) => (x.toRank ?? 999) - (y.toRank ?? 999));

  const causeName = name(change.fieldId);
  const top = change.after[0];
  const topText = top ? `${name(top.fieldId)} is now #1` : "no inspections left in the queue";
  const newRank = moves.find((m) => m.inspectionId === change.inspectionId)?.toRank;
  const headline =
    change.cause === "inspection_completed"
      ? `${causeName} inspection completed — ${topText}.`
      : change.cause === "inspection_created"
        ? `New inspection for ${causeName}${newRank ? ` at #${newRank}` : ""} — ${topText}.`
        : `Ground report for ${causeName} changed the ranking — ${topText}.`;
  return { id: change.id, at: change.at, cause: change.cause, fieldId: change.fieldId, inspectionId: change.inspectionId, headline, moves };
}

// ---------------------------------------------------------------------------
// Round 2: Today briefing, capacity, impact, time-lapse

/** One sentence for the top of "Today" plus the inspection to open. */
export function todayBriefing(state: AppState, now = new Date()): { headline: string; detail: string; inspectionId?: string } {
  const queue = activeInspections(state, now);
  const total = state.fields.length;
  const fieldsNeeding = new Set(queue.map((r) => r.task.fieldId)).size;
  if (queue.length === 0) {
    return { headline: `All ${total} fields look normal this week.`, detail: "No visits needed. FieldLoop keeps watching the satellite data." };
  }
  const top = queue[0];
  const anomaly = state.anomalies.find((a) => top.task.anomalyIds.includes(a.id));
  const why = anomaly?.observed ?? top.task.reason;
  // If the reason itself came from a farmer, `why` already is that report; only mention it next to another signal.
  const whyIsFarmer = !anomaly || anomaly.source === "farmer_report";
  const farmerReport = !whyIsFarmer && state.observations.some((o) => o.inspectionId === top.task.id && o.authorRole === "farmer");
  return {
    headline: `${fieldsNeeding} of ${total} fields need a visit. Start with ${top.field?.name ?? top.task.fieldId}.`,
    detail: `${why.split(/(?<=\.)\s/)[0]}${farmerReport ? " The farmer also reported a problem." : ""}`,
    inspectionId: top.task.id,
  };
}

/** Do this week's visits fit the team? Uses the quiz answers, or 2 advisers × 5 visits/day. */
export function weeklyCapacity(state: AppState, now = new Date()) {
  const visitsNeeded = activeInspections(state, now).length;
  const advisers = Math.max(1, state.profile?.advisers ?? 2);
  const visitsPerAdviserDay = Math.max(1, state.profile?.visitsPerAdviserDay ?? 5);
  const adviserDays = Math.ceil(visitsNeeded / visitsPerAdviserDay);
  return { visitsNeeded, advisers, visitsPerAdviserDay, adviserDays, fits: adviserDays <= advisers * 5 };
}

/** Headline numbers for the pitch: how many trips the ranking saves. */
export function impactSummary(state: AppState, now = new Date()) {
  const fieldsMonitored = state.fields.length;
  const needVisit = new Set(activeInspections(state, now).map((r) => r.task.fieldId)).size;
  return {
    fieldsMonitored,
    hectares: +state.fields.reduce((s, f) => s + f.areaHa, 0).toFixed(1),
    needVisit,
    visitsAvoidedPct: fieldsMonitored ? Math.round((1 - needVisit / fieldsMonitored) * 100) : 0,
    casesClosed30d: state.reports.filter((r) => (daysBetween(r.createdAt, now) ?? 99) <= 30).length,
  };
}

/**
 * Weekly greenness per field for the map time-lapse.
 * Readings are bucketed into 7-day steps ending at the newest reading; a field without a reading
 * in a week keeps its previous value (clouds), or null before its first reading.
 */
export function greennessTimeline(state: AppState) {
  const all = state.fields.flatMap((f) => f.vegetationIndex.series.map((r) => r.date)).sort();
  if (all.length === 0) return { weeks: [] as string[], byField: {} as Record<string, Array<{ value: number | null; simulated: boolean }>> };
  const DAY = 86_400_000;
  const first = new Date(all[0]).getTime();
  const last = new Date(all[all.length - 1]).getTime();
  const weeks: string[] = [];
  for (let t = last; t >= first - 6 * DAY; t -= 7 * DAY) weeks.unshift(new Date(t).toISOString().slice(0, 10));
  const byField: Record<string, Array<{ value: number | null; simulated: boolean }>> = {};
  state.fields.forEach((f) => {
    let prev: { value: number | null; simulated: boolean } = { value: null, simulated: false };
    byField[f.id] = weeks.map((w) => {
      const end = new Date(w).getTime();
      const inWeek = f.vegetationIndex.series.filter((r) => {
        const t = new Date(r.date).getTime();
        return t <= end && t > end - 7 * DAY;
      });
      const r = inWeek[inWeek.length - 1];
      if (r) prev = { value: r.value, simulated: r.source !== "real" };
      return prev;
    });
  });
  return { weeks, byField };
}

/** Greenness change per field: newest reading vs. the reading 3 readings (about 3 weeks) earlier. */
export function greennessChange(state: AppState) {
  return state.fields.map((field) => {
    const s = [...field.vegetationIndex.series].sort((a, b) => a.date.localeCompare(b.date));
    const last = s[s.length - 1];
    const before = s[s.length - 4];
    const pct = last && before && before.value > 0 ? Math.round(((last.value - before.value) / before.value) * 100) : null;
    return { field, pct, simulated: !!last && (last.source !== "real" || before?.source !== "real") };
  });
}

/** The five change groups shown on Today, from falling fast to rising fast. */
export const CHANGE_GROUPS = [
  { id: "fall-fast", label: "Falling fast", range: "below −20%", test: (p: number) => p < -20 },
  { id: "fall", label: "Falling", range: "−20 to −5%", test: (p: number) => p >= -20 && p < -5 },
  { id: "steady", label: "Steady", range: "−5 to +5%", test: (p: number) => p >= -5 && p <= 5 },
  { id: "rise", label: "Rising", range: "+5 to +20%", test: (p: number) => p > 5 && p <= 20 },
  { id: "rise-fast", label: "Rising fast", range: "above +20%", test: (p: number) => p > 20 },
] as const;

export function changeGroups(state: AppState) {
  const changes = greennessChange(state).filter((c) => c.pct !== null);
  return CHANGE_GROUPS.map((g) => ({ ...g, count: changes.filter((c) => g.test(c.pct!)).length }));
}
