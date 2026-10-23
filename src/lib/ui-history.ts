/**
 * Display-only case history for one field.
 * Built from records the app already stores. Does not score or detect anything.
 */
import { CATEGORY_LABEL, OUTCOME_LABEL, SOURCE_LABEL } from "./labels";
import type { AppState } from "./types";

export type TimelineTone = "signal" | "visit" | "note" | "confirmed" | "neutral";

export interface TimelineEntry {
  id: string;
  at: string;
  title: string;
  detail?: string;
  meta?: string;
  href?: string;
  tone: TimelineTone;
}

export function fieldTimeline(state: AppState, fieldId: string): TimelineEntry[] {
  const items: TimelineEntry[] = [];

  for (const anomaly of state.anomalies) {
    if (anomaly.fieldId !== fieldId) continue;
    const simulated = anomaly.source === "simulated_index" || anomaly.source === "demo_sample";
    items.push({
      id: anomaly.id,
      at: anomaly.detectedAt,
      title: simulated || anomaly.source === "sentinel2" ? "Greenness signal flagged" : "Issue reported",
      detail: anomaly.observed,
      meta:
        anomaly.source === "sentinel2"
          ? "Sentinel-2 reading · not a diagnosis"
          : simulated
            ? "Simulated index · not a diagnosis"
            : SOURCE_LABEL[anomaly.source],
      tone: "signal",
    });
  }

  for (const observation of state.observations) {
    if (observation.fieldId !== fieldId) continue;
    items.push({
      id: observation.id,
      at: observation.createdAt,
      title: `${CATEGORY_LABEL[observation.category]} observation`,
      detail: observation.description,
      meta: `${observation.author} · ${SOURCE_LABEL[observation.source]}`,
      href: observation.inspectionId ? `/inspections/${observation.inspectionId}/visit` : undefined,
      tone: "neutral",
    });
  }

  for (const task of state.inspections) {
    if (task.fieldId !== fieldId) continue;
    const followUp = task.title.toLowerCase().startsWith("follow-up");
    items.push({
      id: `${task.id}-opened`,
      at: task.createdAt,
      title: followUp ? "Follow-up visit opened" : "Inspection opened",
      detail: task.reason,
      meta: task.id,
      href: `/inspections/${task.id}/visit`,
      tone: "visit",
    });
    if (task.startedAt) {
      items.push({
        id: `${task.id}-started`,
        at: task.startedAt,
        title: "Visit started",
        meta: task.id,
        href: `/inspections/${task.id}/visit`,
        tone: "visit",
      });
    }
    for (const note of task.notes) {
      items.push({
        id: note.id,
        at: note.at,
        title: "Field note",
        detail: note.text,
        meta: note.author,
        href: `/inspections/${task.id}/visit`,
        tone: "note",
      });
    }
    const report = state.reports.find((item) => item.id === task.reportId);
    if (report) {
      items.push({
        id: report.id,
        at: report.createdAt,
        title: `Visit completed — ${OUTCOME_LABEL[report.outcome]}`,
        detail: report.confirmedFindings,
        meta: `${report.author} · confirmed on site, not by the index`,
        href: `/inspections/${task.id}`,
        tone: "confirmed",
      });
    }
  }

  return items.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}
