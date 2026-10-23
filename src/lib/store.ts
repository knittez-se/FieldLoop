"use client";

/**
 * Data-access layer.
 *
 * Prototype persistence: the whole AppState lives in the browser's localStorage.
 * Limitations (documented in the README):
 *  - Data is per browser/device — not shared between team members.
 *  - localStorage is limited to ~5 MB, so photos are downscaled before saving.
 *  - Clearing site data resets the demo.
 *
 * To move to a real backend, keep the exported function signatures and replace
 * `persist`/`load` with API calls (e.g. Next.js route handlers + a database).
 * UI components only use `useAppState()` and the action functions below.
 */
import { useSyncExternalStore } from "react";
import { BUILTIN_FIELD_DATA } from "./builtin-field-data";
import { createSeedState, STATE_VERSION } from "./demo-data";
import { hashPayload, type FieldDataPayload } from "./field-data";
import { CATEGORY_LABEL } from "./labels";
import type {
  ActivityEvent,
  Anomaly,
  AppSettings,
  AppState,
  FieldObservation,
  InspectionOutcome,
  InspectionReport,
  InspectionTask,
  ObservationCategory,
} from "./types";

const STORAGE_KEY = "farmsignal:state:v1";

let state: AppState | null = null;
let persistError: string | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === STATE_VERSION && Array.isArray(parsed.fields)) {
        state = parsed;
        return state;
      }
    }
  } catch {
    // corrupted or unavailable storage → fall back to fresh demo data
  }
  state = createSeedState(BUILTIN_FIELD_DATA);
  persist(state);
  return state;
}

function persist(next: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    persistError = null;
  } catch (err) {
    persistError =
      err instanceof Error && /quota/i.test(err.name + err.message)
        ? "Browser storage is full. Remove photos or reset the demo data in Settings."
        : "Could not save to browser storage. Changes will be lost on reload.";
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = null; // another tab changed data → reload lazily
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function update(mutator: (s: AppState) => AppState) {
  const next = mutator(load());
  state = next;
  persist(next);
  emit();
}

/** Returns the app state on the client, or `null` during server render / before hydration. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, load, () => null);
}

export function getPersistError() {
  return persistError;
}

// ---------------------------------------------------------------------------
// helpers

let counter = 0;
function newId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${counter}`;
}

/** Human-friendly sequential ids like "INS-1313" based on existing records. */
function nextId(prefix: string, existing: string[], pad = 4) {
  const max = existing.reduce((m, id) => {
    const n = Number(id.slice(prefix.length + 1));
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function currentUserName(s: AppState) {
  return s.advisers.find((a) => a.id === s.settings.currentUserId)?.name ?? "Unknown user";
}

function withActivity(s: AppState, e: Omit<ActivityEvent, "id" | "at">): ActivityEvent[] {
  return [{ ...e, id: newId("act"), at: nowIso() }, ...s.activity];
}

function patchTask(s: AppState, id: string, patch: Partial<InspectionTask>): InspectionTask[] {
  return s.inspections.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t));
}

// ---------------------------------------------------------------------------
// actions

export function startInspection(taskId: string) {
  update((s) => {
    const task = s.inspections.find((t) => t.id === taskId);
    if (!task || task.status !== "open") return s;
    const user = currentUserName(s);
    return {
      ...s,
      inspections: patchTask(s, taskId, {
        status: "in_progress",
        startedAt: nowIso(),
        assigneeId: task.assigneeId ?? s.settings.currentUserId,
      }),
      anomalies: s.anomalies.map((a) =>
        task.anomalyIds.includes(a.id) && a.status === "open" ? { ...a, status: "under_review" } : a,
      ),
      activity: withActivity(s, {
        fieldId: task.fieldId,
        type: "inspection_started",
        message: "Inspection started",
        actor: user,
        inspectionId: taskId,
      }),
    };
  });
}

export function assignInspection(taskId: string, adviserId: string | undefined) {
  update((s) => {
    const task = s.inspections.find((t) => t.id === taskId);
    if (!task) return s;
    const name = s.advisers.find((a) => a.id === adviserId)?.name ?? "nobody";
    return {
      ...s,
      inspections: patchTask(s, taskId, { assigneeId: adviserId }),
      activity: withActivity(s, {
        fieldId: task.fieldId,
        type: "assignment_changed",
        message: `Assigned to ${name}`,
        actor: currentUserName(s),
        inspectionId: taskId,
      }),
    };
  });
}

export function toggleCheck(taskId: string, checkId: string) {
  update((s) => {
    const task = s.inspections.find((t) => t.id === taskId);
    if (!task) return s;
    return {
      ...s,
      inspections: patchTask(s, taskId, {
        suggestedChecks: task.suggestedChecks.map((c) => (c.id === checkId ? { ...c, done: !c.done } : c)),
      }),
    };
  });
}

export function addInspectionNote(taskId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  update((s) => {
    const task = s.inspections.find((t) => t.id === taskId);
    if (!task) return s;
    const user = currentUserName(s);
    return {
      ...s,
      inspections: patchTask(s, taskId, {
        notes: [...task.notes, { id: newId("note"), at: nowIso(), author: user, text: trimmed }],
      }),
      activity: withActivity(s, {
        fieldId: task.fieldId,
        type: "inspection_note",
        message: `Note added: "${trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed}"`,
        actor: user,
        inspectionId: taskId,
      }),
    };
  });
}

export function addInspectionPhoto(taskId: string, dataUrl: string) {
  update((s) => {
    const task = s.inspections.find((t) => t.id === taskId);
    if (!task) return s;
    return { ...s, inspections: patchTask(s, taskId, { photos: [...task.photos, dataUrl] }) };
  });
}

export function removeInspectionPhoto(taskId: string, index: number) {
  update((s) => {
    const task = s.inspections.find((t) => t.id === taskId);
    if (!task) return s;
    return { ...s, inspections: patchTask(s, taskId, { photos: task.photos.filter((_, i) => i !== index) }) };
  });
}

export interface CompleteInspectionInput {
  outcome: InspectionOutcome;
  confirmedFindings: string;
  recommendation: string;
}

/** Completes a task, writes an InspectionReport and updates anomalies + field. Returns the report id. */
export function completeInspection(taskId: string, input: CompleteInspectionInput): string | undefined {
  let reportId: string | undefined;
  update((s) => {
    const task = s.inspections.find((t) => t.id === taskId);
    if (!task || task.status === "completed") return s;
    const user = currentUserName(s);
    const at = nowIso();
    reportId = nextId("RPT", s.reports.map((r) => r.id));
    const report: InspectionReport = {
      id: reportId,
      inspectionId: taskId,
      fieldId: task.fieldId,
      createdAt: at,
      author: user,
      outcome: input.outcome,
      confirmedFindings: input.confirmedFindings.trim(),
      recommendation: input.recommendation.trim(),
      photos: task.photos,
      checksCompleted: task.suggestedChecks.filter((c) => c.done).map((c) => c.label),
    };
    const anomalyStatus: Anomaly["status"] =
      input.outcome === "issue_confirmed" ? "confirmed" : input.outcome === "no_issue_found" ? "dismissed" : "under_review";
    const outcomeText =
      input.outcome === "issue_confirmed"
        ? "issue confirmed on site"
        : input.outcome === "no_issue_found"
          ? "no issue found"
          : "follow-up needed";
    return {
      ...s,
      reports: [report, ...s.reports],
      inspections: patchTask(s, taskId, {
        status: "completed",
        completedAt: at,
        startedAt: task.startedAt ?? at,
        assigneeId: task.assigneeId ?? s.settings.currentUserId,
        reportId,
      }),
      anomalies: s.anomalies.map((a) =>
        task.anomalyIds.includes(a.id)
          ? {
              ...a,
              status: anomalyStatus,
              nextAction: input.recommendation.trim() || a.nextAction,
            }
          : a,
      ),
      fields: s.fields.map((f) => (f.id === task.fieldId ? { ...f, lastInspectionAt: at, lastObservationAt: at } : f)),
      activity: withActivity(s, {
        fieldId: task.fieldId,
        type: "inspection_completed",
        message: `Inspection completed — ${outcomeText}`,
        actor: user,
        inspectionId: taskId,
      }),
    };
  });
  return reportId;
}

export interface SubmitObservationInput {
  fieldId: string;
  category: ObservationCategory;
  description: string;
  voiceTranscript?: string;
  photoDataUrl?: string;
}

export interface SubmitObservationResult {
  observationId: string;
  inspectionId?: string;
  createdInspection: boolean;
}

const CATEGORY_SEVERITY: Record<ObservationCategory, Anomaly["severity"]> = {
  leaf_damage: "medium",
  pests_visible: "medium",
  water_stress: "medium",
  unusual_growth: "low",
  other: "low",
};

/**
 * Stores an observation and links it to the workflow:
 *  - If the field already has an open / in-progress inspection, the observation is attached to it.
 *  - Otherwise (unless category is "other") a new inspection task is created from the report.
 */
export function submitObservation(input: SubmitObservationInput): SubmitObservationResult {
  const result: SubmitObservationResult = { observationId: "", createdInspection: false };
  update((s) => {
    result.observationId = nextId("OBS", s.observations.map((o) => o.id));
    const user = s.advisers.find((a) => a.id === s.settings.currentUserId);
    const at = nowIso();
    const activeTask = s.inspections.find((t) => t.fieldId === input.fieldId && t.status !== "completed");

    const observation: FieldObservation = {
      id: result.observationId,
      fieldId: input.fieldId,
      createdAt: at,
      author: user?.name ?? "Unknown user",
      authorRole: user?.role ?? "farmer",
      source: user?.role === "farmer" ? "farmer_report" : "adviser",
      category: input.category,
      description: input.description.trim(),
      voiceTranscript: input.voiceTranscript?.trim() || undefined,
      photoDataUrl: input.photoDataUrl,
    };

    let inspections = s.inspections;
    let anomalies = s.anomalies;
    let activity = withActivity(s, {
      fieldId: input.fieldId,
      type: "observation_added",
      message: `${CATEGORY_LABEL[input.category]} observation added`,
      actor: observation.author,
      inspectionId: activeTask?.id,
    });
    const summary = `${CATEGORY_LABEL[input.category]} (${observation.author}): ${truncate(observation.description, 120)}`;

    if (activeTask) {
      observation.inspectionId = activeTask.id;
      result.inspectionId = activeTask.id;
      inspections = inspections.map((t) =>
        t.id === activeTask.id
          ? {
              ...t,
              observationIds: [...t.observationIds, observation.id],
              supportingObservations: [...t.supportingObservations, summary],
              updatedAt: at,
            }
          : t,
      );
    } else if (input.category !== "other") {
      const anomaly: Anomaly = {
        id: nextId("ANM", s.anomalies.map((a) => a.id)),
        fieldId: input.fieldId,
        type: "reported_issue",
        detectedAt: at,
        severity: CATEGORY_SEVERITY[input.category],
        status: "open",
        source: observation.source,
        observed: observation.description,
        whyItMatters: "A ground report indicates a possible problem that has not yet been verified by an adviser.",
        possibleExplanations: [],
        confidence: "low",
        confidenceNote: "Single ground report, not yet verified.",
        verifyOnSite: defaultChecks(input.category),
        nextAction: "Schedule an on-site inspection.",
      };
      const task: InspectionTask = {
        id: nextId("INS", s.inspections.map((t) => t.id)),
        fieldId: input.fieldId,
        anomalyIds: [anomaly.id],
        observationIds: [observation.id],
        title: `Verify reported ${CATEGORY_LABEL[input.category].toLowerCase()}`,
        reason: `New ground report: ${truncate(observation.description, 140)}`,
        supportingObservations: [summary],
        suggestedChecks: defaultChecks(input.category).map((label, i) => ({ id: `chk-${i + 1}`, label, done: false })),
        status: "open",
        createdAt: at,
        updatedAt: at,
        notes: [],
        photos: input.photoDataUrl ? [input.photoDataUrl] : [],
      };
      observation.inspectionId = task.id;
      result.inspectionId = task.id;
      result.createdInspection = true;
      anomalies = [anomaly, ...anomalies];
      inspections = [task, ...inspections];
      activity = [
        { id: newId("act"), at, fieldId: input.fieldId, type: "inspection_created", message: "Inspection created from ground report", actor: "FarmSignal rules", inspectionId: task.id },
        ...activity,
      ];
    }

    return {
      ...s,
      observations: [observation, ...s.observations],
      inspections,
      anomalies,
      activity,
      fields: s.fields.map((f) => (f.id === input.fieldId ? { ...f, lastObservationAt: at } : f)),
    };
  });
  return result;
}

function defaultChecks(category: ObservationCategory): string[] {
  switch (category) {
    case "water_stress":
      return ["Check soil moisture at 10–20 cm depth.", "Look for leaf rolling during midday.", "Compare with a nearby unaffected area."];
    case "leaf_damage":
      return ["Inspect leaves and whorls on 20 plants.", "Note the pattern of damage (holes, lesions, discoloration).", "Photograph affected leaves."];
    case "pests_visible":
      return ["Scout 5 × 10 plants in a W pattern.", "Count affected plants and visible insects.", "Photograph insects and damage."];
    case "unusual_growth":
      return ["Compare plant height and stand count with the rest of the field.", "Check for waterlogging or compaction."];
    default:
      return ["Visit the field and verify the report."];
  }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function updateSettings(patch: Partial<AppSettings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

/** Rebuilds the demo from the current field data (keeps the data source, drops all user changes). */
export function resetDemoData() {
  const payload = load().data.payload;
  const keepSettings = load().settings;
  state = { ...createSeedState(payload), settings: keepSettings };
  persist(state);
  emit();
}

let syncPromise: Promise<FieldSyncResult> | null = null;
let lastSync: FieldSyncResult | null = null;

export interface FieldSyncResult {
  status: "unchanged" | "rebuilt" | "unavailable";
  origin?: FieldDataPayload["origin"];
  message?: string;
}

export function getLastFieldSync() {
  return lastSync;
}

/**
 * Loads field data from /api/field-data (the files in data/). If the data differs from what
 * the current state was built from, the demo state is rebuilt from the new data.
 * Called once per page load by the app shell; `force` re-checks (Settings → Reload data).
 */
export function syncFieldData(force = false): Promise<FieldSyncResult> {
  if (syncPromise && !force) return syncPromise;
  syncPromise = (async (): Promise<FieldSyncResult> => {
    try {
      const res = await fetch("/api/field-data", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as FieldDataPayload;
      if (!Array.isArray(payload.fields)) throw new Error("Invalid payload");
      const current = load();
      if (current.data.hash === hashPayload(payload)) {
        lastSync = { status: "unchanged", origin: payload.origin };
      } else if (payload.fields.length === 0) {
        lastSync = { status: "unavailable", message: "Data files contain no usable fields. " + payload.warnings.join(" ") };
      } else {
        state = { ...createSeedState(payload), settings: current.settings };
        persist(state);
        lastSync = {
          status: "rebuilt",
          origin: payload.origin,
          message:
            payload.origin === "data_files"
              ? `Loaded ${payload.fields.length} fields from data/. The demo was rebuilt from the new data.`
              : "Data files not found — using the built-in sample. The demo was rebuilt.",
        };
      }
    } catch (err) {
      lastSync = { status: "unavailable", message: `Could not load field data (${err instanceof Error ? err.message : "error"}). Showing saved data.` };
    }
    emit();
    return lastSync;
  })();
  return syncPromise;
}
