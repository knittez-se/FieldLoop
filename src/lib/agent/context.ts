import { daysBetween, scoreInspection } from "../priority";
import { CATEGORY_LABEL } from "../labels";
import { farmFor, fieldAnomalies, weatherSummary } from "../selectors";
import type { AppState, InspectionTask } from "../types";
import type { AgentContext } from "./types";

/** Builds the agent context for a field (and optionally a specific inspection). */
export function buildAgentContext(state: AppState, fieldId: string, inspectionId?: string): AgentContext | null {
  const field = state.fields.find((f) => f.id === fieldId);
  if (!field) return null;
  const now = new Date();

  const task: InspectionTask | undefined =
    (inspectionId && state.inspections.find((t) => t.id === inspectionId)) ||
    state.inspections.find((t) => t.fieldId === fieldId && t.status !== "completed") ||
    state.inspections
      .filter((t) => t.fieldId === fieldId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const priority = task ? scoreInspection(task, state, now) : undefined;
  const weather = weatherSummary(state, field);

  return {
    field: {
      id: field.id,
      name: field.name,
      crop: field.crop,
      growthStage: field.growthStage,
      areaHa: field.areaHa,
      farmName: farmFor(state, field)?.name,
      daysSinceInspection: daysBetween(field.lastInspectionAt, now),
    },
    priority: priority && task?.status !== "completed" ? priority : undefined,
    inspection: task
      ? {
          id: task.id,
          title: task.title,
          status: task.status,
          reason: task.reason,
          supportingObservations: task.supportingObservations,
          checks: task.suggestedChecks.map((c) => ({ label: c.label, done: c.done })),
          notes: task.notes.map((n) => `${n.author}: ${n.text}`),
          photosCount: task.photos.length,
        }
      : undefined,
    anomalies: fieldAnomalies(state, fieldId).map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      status: a.status,
      source: a.source,
      observed: a.observed,
      possibleExplanations: a.possibleExplanations,
      confidence: a.confidence,
      verifyOnSite: a.verifyOnSite,
      nextAction: a.nextAction,
      changePct: a.changePct,
    })),
    observations: state.observations
      .filter((o) => o.fieldId === fieldId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
      .map((o) => ({
        createdAt: o.createdAt,
        author: o.author,
        role: o.authorRole,
        category: CATEGORY_LABEL[o.category],
        description: o.description,
        voiceTranscript: o.voiceTranscript,
        hasPhoto: Boolean(o.photoDataUrl),
      })),
    reports: state.reports
      .filter((r) => r.fieldId === fieldId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map((r) => ({
        createdAt: r.createdAt,
        author: r.author,
        outcome: r.outcome,
        confirmedFindings: r.confirmedFindings,
        recommendation: r.recommendation,
      })),
    weather: { rain7dMm: weather.rain7d, dryDays: weather.dryDays, avgMaxTempC: weather.avgMax7d, source: weather.source },
  };
}
