/**
 * Display helper for the Overview banner after a visit is completed.
 * Uses the activity log Area A already writes. No scoring rules live here.
 */
import { activeInspections } from "./selectors";
import type { AppState } from "./types";

export interface QueueShift {
  completedFieldId: string;
  completedFieldName: string;
  completedAt: string;
  nowFirst: {
    taskId: string;
    fieldId: string;
    fieldName: string;
    score: number;
  } | null;
  followUpTaskId?: string;
  /** 1-based rank if this field still has an open visit, otherwise null. */
  stillRank: number | null;
}

const RECENT_MS = 6 * 60 * 60 * 1000;

export function latestQueueShift(state: AppState, now = Date.now()): QueueShift | null {
  const completed = state.activity.find((event) => event.type === "inspection_completed");
  if (!completed) return null;
  const age = now - new Date(completed.at).getTime();
  if (Number.isNaN(age) || age > RECENT_MS) return null;

  const active = activeInspections(state);
  const fieldName = state.fields.find((field) => field.id === completed.fieldId)?.name ?? completed.fieldId;
  const top = active[0];
  const still = active.findIndex((row) => row.task.fieldId === completed.fieldId);
  const followUp = state.activity.find(
    (event) =>
      event.type === "inspection_created" &&
      event.fieldId === completed.fieldId &&
      event.at >= completed.at &&
      event.inspectionId !== undefined &&
      event.inspectionId !== completed.inspectionId,
  );

  return {
    completedFieldId: completed.fieldId,
    completedFieldName: fieldName,
    completedAt: completed.at,
    nowFirst: top
      ? {
          taskId: top.task.id,
          fieldId: top.task.fieldId,
          fieldName: top.field?.name ?? top.task.fieldId,
          score: top.priority.score,
        }
      : null,
    followUpTaskId: followUp?.inspectionId,
    stillRank: still >= 0 ? still + 1 : null,
  };
}
