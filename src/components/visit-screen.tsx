"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CircleCheck, ClipboardList, Play } from "lucide-react";
import {
  addInspectionNote,
  addInspectionPhoto,
  completeInspection,
  removeInspectionPhoto,
  startInspection,
  toggleCheck,
  useAppState,
} from "@/lib/store";
import { scoreInspection } from "@/lib/priority";
import { OUTCOME_LABEL } from "@/lib/labels";
import type { InspectionOutcome } from "@/lib/types";
import { PhotoInput } from "@/components/photo-input";
import { VoiceInput } from "@/components/voice-input";
import { Button, NotFoundCard, PageLoading, PriorityBadge, StatusBadge } from "@/components/ui";
import { cn } from "@/lib/format";

const OUTCOMES: Array<{ id: InspectionOutcome; hint: string }> = [
  { id: "issue_confirmed", hint: "You saw a problem" },
  { id: "no_issue_found", hint: "The signal was not confirmed" },
  { id: "needs_follow_up", hint: "Needs another visit" },
];

interface ReportSuggestion {
  mode?: string;
  outcome: InspectionOutcome;
  summary: string;
  openQuestions?: string[];
  followUp?: string;
}

const OUTCOME_SET = new Set<InspectionOutcome>(["issue_confirmed", "no_issue_found", "needs_follow_up"]);

function asSuggestion(value: unknown): ReportSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.outcome !== "string" || !OUTCOME_SET.has(row.outcome as InspectionOutcome)) return null;
  if (typeof row.summary !== "string" || row.summary.trim().length < 8) return null;
  return {
    mode: typeof row.mode === "string" ? row.mode : undefined,
    outcome: row.outcome as InspectionOutcome,
    summary: row.summary.trim(),
    openQuestions: Array.isArray(row.openQuestions) ? row.openQuestions.filter((item): item is string => typeof item === "string") : [],
    followUp: typeof row.followUp === "string" ? row.followUp : undefined,
  };
}

export function VisitScreen({ inspectionId }: { inspectionId: string }) {
  const state = useAppState();
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<InspectionOutcome | null>(null);
  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ReportSuggestion | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  if (!state) return <PageLoading />;
  const task = state.inspections.find((item) => item.id === inspectionId);
  if (!task) return <NotFoundCard title={`Inspection "${inspectionId}" not found`} href="/inspections" linkLabel="Back to inspections" />;

  const field = state.fields.find((item) => item.id === task.fieldId);
  const priority = scoreInspection(task, state);
  const report = state.reports.find((item) => item.id === task.reportId);
  const open = task.status === "open";
  const inProgress = task.status === "in_progress";
  const completed = task.status === "completed";
  const doneChecks = task.suggestedChecks.filter((check) => check.done).length;

  function saveNote() {
    const text = note.trim();
    if (!text) return;
    addInspectionNote(task!.id, text);
    setNote("");
  }

  function finish() {
    if (!outcome) return setFormError("Choose an outcome.");
    if (findings.trim().length < 10) return setFormError("Write what you actually saw, in a short sentence.");
    setFormError(null);
    if (note.trim()) saveNote();
    const result = completeInspection(task!.id, { outcome, confirmedFindings: findings, recommendation });
    setFollowUpId(result.followUpId ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function askSuggestion() {
    setSuggesting(true);
    setSuggestError(null);
    setSuggestion(null);
    const anomaly = state!.anomalies.find((item) => task!.anomalyIds.includes(item.id));
    try {
      const response = await fetch("/api/process-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: task!.fieldId,
          fieldName: field?.name,
          notes: task!.notes.map((item) => item.text),
          draftNote: note.trim(),
          checksDone: task!.suggestedChecks.filter((check) => check.done).map((check) => check.label),
          findings: findings.trim(),
          anomalyObserved: anomaly?.observed,
        }),
      });
      if (response.status === 404) {
        setSuggestError("Outcome suggestion is not connected yet. Choose the outcome yourself.");
        return;
      }
      const body: unknown = await response.json().catch(() => null);
      const parsed = asSuggestion(body);
      if (!response.ok || !parsed) {
        setSuggestError("The suggestion service did not return a usable outcome. Choose it yourself.");
        return;
      }
      setSuggestion(parsed);
    } catch {
      setSuggestError("Could not reach the suggestion service. Choose the outcome yourself.");
    } finally {
      setSuggesting(false);
    }
  }

  function acceptSuggestion(next: ReportSuggestion) {
    setOutcome(next.outcome);
    if (!findings.trim()) setFindings(next.summary);
    if (next.followUp && !recommendation.trim()) setRecommendation(next.followUp);
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-28">
      <Link href={`/inspections/${task.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Full inspection
      </Link>

      <header className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Field visit · {task.id}</div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-950">{field?.name ?? task.fieldId}</h1>
        <p className="text-sm text-stone-600">{task.reason}</p>
        <div className="flex flex-wrap gap-2">
          {!completed && <PriorityBadge level={priority.level} score={priority.score} />}
          <StatusBadge status={task.status} />
        </div>
      </header>

      {completed && report && (
        <div className="rounded-xl border border-brand-300 bg-brand-50 p-4 text-sm text-brand-950" role="status">
          <div className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <div>
              <p className="font-medium">Visit saved as {report.id}.</p>
              <p className="mt-1">{report.confirmedFindings}</p>
              {followUpId ? (
                <p className="mt-2">
                  A follow-up stays on the queue:{" "}
                  <Link href={`/inspections/${followUpId}/visit`} className="font-semibold underline">
                    {followUpId}
                  </Link>
                  .
                </p>
              ) : (
                <p className="mt-2">The overview queue has been re-ranked.</p>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button href="/">Back to overview</Button>
            <Button variant="secondary" href={`/fields/${task.fieldId}`}>
              Case history
            </Button>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Checks</h2>
          <p className="text-xs text-stone-500">
            {open ? "Start the visit to tick these off." : `${doneChecks} of ${task.suggestedChecks.length} done`}
          </p>
        </div>
        <ul className="divide-y divide-stone-100">
          {task.suggestedChecks.map((check) => (
            <li key={check.id}>
              <label className={cn("flex min-h-12 items-start gap-3 px-4 py-3", inProgress ? "cursor-pointer active:bg-stone-50" : "")}>
                <input
                  type="checkbox"
                  checked={check.done}
                  disabled={!inProgress}
                  onChange={() => toggleCheck(task.id, check.id)}
                  className="mt-0.5 h-5 w-5 accent-brand-600"
                />
                <span className={cn("text-base", check.done ? "text-stone-400 line-through" : "text-stone-900")}>{check.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Notes</h2>
        {task.notes.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing written yet.</p>
        ) : (
          <ul className="space-y-2">
            {task.notes.map((item) => (
              <li key={item.id} className="rounded-lg bg-stone-50 p-3 text-sm text-stone-800">
                {item.text}
              </li>
            ))}
          </ul>
        )}
        {!completed && (
          <>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="What you see, in your own words"
              className="w-full rounded-lg border border-stone-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Field note"
            />
            <VoiceInput onText={(text) => setNote((prev) => (prev ? `${prev} ${text}` : text))} size="md" />
            <Button className="min-h-11 w-full" variant="secondary" disabled={!note.trim()} onClick={saveNote}>
              Save note
            </Button>
          </>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold">Photo</h2>
        <p className="text-xs text-stone-500">Stored on this phone only. The assistant does not look at the picture.</p>
        {task.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {task.photos.map((photo, index) => (
              <div key={photo.slice(0, 32) + index} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Visit photo ${index + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                {!completed && (
                  <button
                    type="button"
                    onClick={() => removeInspectionPhoto(task.id, index)}
                    className="absolute right-1 top-1 rounded bg-black/70 px-2 py-1 text-xs text-white"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!completed && <PhotoInput onPhoto={(url) => addInspectionPhoto(task.id, url)} label="Take or add photo" size="md" />}
      </section>

      {!completed && inProgress && (
        <section className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Outcome</h2>
          <p className="text-xs text-stone-500">Only record what you confirmed on site. A greenness drop is not a diagnosis.</p>
          <Button variant="secondary" className="min-h-11 w-full" disabled={suggesting} onClick={askSuggestion} icon={ClipboardList}>
            {suggesting ? "Asking…" : "Suggest an outcome"}
          </Button>
          {suggestError && <p className="text-sm text-stone-600">{suggestError}</p>}
          {suggestion && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Suggestion{suggestion.mode === "llm" ? " from the model" : " · demo rules"} — not saved yet
              </p>
              <p className="mt-1 font-medium">{OUTCOME_LABEL[suggestion.outcome]}</p>
              <p className="mt-1">{suggestion.summary}</p>
              {suggestion.followUp && <p className="mt-1 text-amber-900">Follow-up: {suggestion.followUp}</p>}
              <p className="mt-2 text-xs">Photos were not analyzed. Edit the text before you complete the visit.</p>
              <Button size="sm" className="mt-2" onClick={() => acceptSuggestion(suggestion)}>
                Use this suggestion
              </Button>
            </div>
          )}
          <div className="grid gap-2">
            {OUTCOMES.map((item) => (
              <label
                key={item.id}
                className={cn(
                  "min-h-12 cursor-pointer rounded-lg border px-3 py-3",
                  outcome === item.id ? "border-brand-700 bg-brand-50 ring-1 ring-brand-700" : "border-stone-200",
                )}
              >
                <input type="radio" name="outcome" className="sr-only" checked={outcome === item.id} onChange={() => setOutcome(item.id)} />
                <div className="text-base font-medium">{OUTCOME_LABEL[item.id]}</div>
                <div className="text-xs text-stone-500">{item.hint}</div>
              </label>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-600">What you saw *</span>
            <textarea
              value={findings}
              onChange={(event) => setFindings(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-stone-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-600">Recommendation</span>
            <textarea
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-stone-300 px-3 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          {formError && <p className="text-sm text-red-700">{formError}</p>}
        </section>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 p-3 backdrop-blur lg:left-60">
          <div className="mx-auto max-w-lg">
            <Button className="min-h-12 w-full text-base" icon={Play} onClick={() => startInspection(task.id)}>
              Start visit
            </Button>
          </div>
        </div>
      )}
      {inProgress && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 p-3 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-lg gap-2">
            <Button className="min-h-12 flex-1 text-base" icon={CircleCheck} onClick={finish}>
              Complete visit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
