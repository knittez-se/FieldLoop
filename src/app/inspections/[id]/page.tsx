"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Camera,
  CircleCheck,
  ClipboardCheck,
  Gauge,
  ListChecks,
  MessageSquare,
  Play,
  Send,
  Trash,
} from "lucide-react";
import {
  addInspectionNote,
  addInspectionPhoto,
  assignInspection,
  completeInspection,
  removeInspectionPhoto,
  startInspection,
  toggleCheck,
  useAppState,
} from "@/lib/store";
import { scoreInspection } from "@/lib/priority";
import { formatDateTime, relativeTime, cn } from "@/lib/format";
import { OUTCOME_LABEL } from "@/lib/labels";
import type { InspectionOutcome } from "@/lib/types";
import { FieldAgent } from "@/components/field-agent";
import { PhotoInput } from "@/components/photo-input";
import { VoiceInput } from "@/components/voice-input";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  NotFoundCard,
  PageHeader,
  PageLoading,
  PriorityBadge,
  ProvenanceTag,
  StatusBadge,
} from "@/components/ui";

const OUTCOMES: Array<{ id: InspectionOutcome; hint: string }> = [
  { id: "issue_confirmed", hint: "You saw a problem on site" },
  { id: "no_issue_found", hint: "The signal was not confirmed" },
  { id: "needs_follow_up", hint: "Unclear — needs another visit or expert" },
];

export default function InspectionPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ""));
  const state = useAppState();
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<InspectionOutcome | null>(null);
  const [findings, setFindings] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);
  const [followUpId, setFollowUpId] = useState<string | null>(null);

  if (!state) return <PageLoading />;
  const task = state.inspections.find((t) => t.id === id);
  if (!task) return <NotFoundCard title={`Inspection "${id}" not found`} href="/inspections" linkLabel="Back to inspections" />;

  const field = state.fields.find((f) => f.id === task.fieldId);
  const priority = scoreInspection(task, state);
  const report = state.reports.find((r) => r.id === task.reportId);
  const isOpen = task.status === "open";
  const inProgress = task.status === "in_progress";
  const completed = task.status === "completed";
  const doneChecks = task.suggestedChecks.filter((c) => c.done).length;

  function submitNote() {
    if (!note.trim()) return;
    addInspectionNote(task!.id, note);
    setNote("");
  }

  function complete() {
    if (!outcome) return setFormError("Choose an outcome.");
    if (findings.trim().length < 10) return setFormError("Describe what you actually observed on site (at least a short sentence).");
    setFormError(null);
    if (note.trim()) submitNote();
    const result = completeInspection(task!.id, { outcome, confirmedFindings: findings, recommendation });
    setFollowUpId(result.followUpId ?? null);
    setJustCompleted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span>
            <Link href="/inspections" className="hover:underline">
              Inspections
            </Link>{" "}
            / {task.id}
          </span>
        }
        title={task.title}
        description={
          <span>
            <Link href={`/fields/${task.fieldId}`} className="font-medium text-brand-700 hover:underline">
              {field?.name} ({task.fieldId})
            </Link>{" "}
            · created {formatDateTime(task.createdAt)} · updated {relativeTime(task.updatedAt)}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!completed && <PriorityBadge level={priority.level} score={priority.score} />}
            <StatusBadge status={task.status} />
            {!completed && (
              <Button href={`/inspections/${task.id}/visit`} icon={Play}>
                {inProgress ? "Continue visit" : "Open visit"}
              </Button>
            )}
            {isOpen && (
              <Button variant="secondary" icon={Play} onClick={() => startInspection(task.id)}>
                Start here
              </Button>
            )}
          </div>
        }
      />

      {justCompleted && report && (
        <div className="flex flex-col gap-3 rounded-xl border border-brand-300 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-2 text-sm text-brand-900">
            <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            <span>
              Inspection completed and report <strong>{report.id}</strong> saved. The dashboard, queue and field history are updated.
              {followUpId && (
                <>
                  {" "}
                  The case stays open as follow-up{" "}
                  <Link href={`/inspections/${followUpId}`} className="font-semibold underline">
                    {followUpId}
                  </Link>
                  .
                </>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            {followUpId && (
              <Button size="sm" href={`/inspections/${followUpId}`}>
                Open follow-up
              </Button>
            )}
            <Button size="sm" variant="secondary" href={`/fields/${task.fieldId}`}>
              View field
            </Button>
            <Button size="sm" href="/" variant={followUpId ? "secondary" : "primary"}>
              Back to overview
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Reason */}
          <Card>
            <CardHeader title="Why this inspection" />
            <div className="space-y-3 p-4 sm:p-5">
              <p className="text-sm text-stone-800">{task.reason}</p>
              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-stone-600">
                  Supporting observations <ProvenanceTag kind="observed" />
                </div>
                <ul className="space-y-1">
                  {task.supportingObservations.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-stone-700">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Completed report */}
          {completed && report && (
            <Card className="border-brand-200">
              <CardHeader
                icon={ClipboardCheck}
                title={`Inspection report ${report.id}`}
                description={`${report.author} · ${formatDateTime(report.createdAt)}`}
                action={
                  <Badge tone={report.outcome === "issue_confirmed" ? "red" : report.outcome === "no_issue_found" ? "green" : "amber"}>
                    {OUTCOME_LABEL[report.outcome]}
                  </Badge>
                }
              />
              <div className="space-y-3 p-4 text-sm sm:p-5">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-stone-600">
                    Findings <ProvenanceTag kind="confirmed" />
                  </div>
                  <p className="text-stone-800">{report.confirmedFindings}</p>
                </div>
                {report.recommendation && (
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-stone-600">
                      Recommendation <ProvenanceTag kind="action" />
                    </div>
                    <p className="text-stone-800">{report.recommendation}</p>
                  </div>
                )}
                {report.checksCompleted.length > 0 && (
                  <div className="text-xs text-stone-600">Checks completed: {report.checksCompleted.join(" · ")}</div>
                )}
              </div>
            </Card>
          )}

          {/* Checks */}
          <Card>
            <CardHeader
              icon={ListChecks}
              title="Suggested checks"
              description={isOpen ? "Start the inspection to tick off checks." : `${doneChecks} of ${task.suggestedChecks.length} done`}
            />
            <ul className="divide-y divide-stone-100">
              {task.suggestedChecks.map((c) => (
                <li key={c.id}>
                  <label className={cn("flex items-start gap-3 px-4 py-2.5 text-sm sm:px-5", inProgress ? "cursor-pointer hover:bg-stone-50" : "cursor-default")}>
                    <input
                      type="checkbox"
                      checked={c.done}
                      disabled={!inProgress}
                      onChange={() => toggleCheck(task.id, c.id)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span className={c.done ? "text-stone-500 line-through" : "text-stone-800"}>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader icon={MessageSquare} title="Field notes" description="What you see on site, in your own words" />
            <div className="p-4 sm:p-5">
              {task.notes.length === 0 ? (
                <p className="text-xs text-stone-500">No notes yet.</p>
              ) : (
                <ul className="space-y-3">
                  {task.notes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-stone-50 p-3">
                      <p className="text-sm text-stone-800">{n.text}</p>
                      <div className="mt-1 text-xs text-stone-500">
                        {n.author} · {formatDateTime(n.at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!completed && (
                <div className="mt-4 space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="e.g. Leaves rolled on ~15 of 20 plants in the NE corner, soil dry at 15 cm…"
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    aria-label="New note"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <VoiceInput onText={(t) => setNote((prev) => (prev ? `${prev} ${t}` : t))} />
                    <Button size="sm" icon={Send} disabled={!note.trim()} onClick={submitNote}>
                      Add note
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader icon={Camera} title="Photos" description="Stored on this device (downscaled). Photos are not analyzed automatically." />
            <div className="p-4 sm:p-5">
              {task.photos.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {task.photos.map((p, i) => (
                    <div key={i} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p} alt={`Inspection photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                      {!completed && (
                        <button
                          type="button"
                          onClick={() => removeInspectionPhoto(task.id, i)}
                          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                          aria-label="Remove photo"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {completed ? (
                task.photos.length === 0 && <p className="text-xs text-stone-500">No photos were attached.</p>
              ) : (
                <PhotoInput onPhoto={(url) => addInspectionPhoto(task.id, url)} />
              )}
            </div>
          </Card>

          {/* Complete */}
          {!completed && (
            <Card className={inProgress ? "border-brand-300" : ""}>
              <CardHeader icon={ClipboardCheck} title="Record findings & complete" description="Only record what you confirmed on site." />
              <div className="space-y-4 p-4 sm:p-5">
                {isOpen ? (
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-stone-600">Start the inspection when you arrive at the field.</p>
                    <Button icon={Play} onClick={() => startInspection(task.id)}>
                      Start inspection
                    </Button>
                  </div>
                ) : (
                  <>
                    <fieldset>
                      <legend className="mb-2 text-xs font-semibold text-stone-600">Outcome</legend>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {OUTCOMES.map((o) => (
                          <label
                            key={o.id}
                            className={cn(
                              "cursor-pointer rounded-lg border p-3 text-sm",
                              outcome === o.id ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-stone-200 hover:bg-stone-50",
                            )}
                          >
                            <input type="radio" name="outcome" value={o.id} checked={outcome === o.id} onChange={() => setOutcome(o.id)} className="sr-only" />
                            <div className="font-medium">{OUTCOME_LABEL[o.id]}</div>
                            <div className="text-xs text-stone-500">{o.hint}</div>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-stone-600">Confirmed findings *</span>
                      <textarea
                        value={findings}
                        onChange={(e) => setFindings(e.target.value)}
                        rows={3}
                        placeholder="What did you actually see? e.g. Leaf rolling on 15/20 plants in NE corner; soil dry at 15 cm; no insects found."
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-stone-600">Recommendation / follow-up</span>
                      <textarea
                        value={recommendation}
                        onChange={(e) => setRecommendation(e.target.value)}
                        rows={2}
                        placeholder="e.g. Re-check in 5 days; discuss irrigation options with the farmer."
                        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </label>
                    {formError && <p className="text-sm text-red-700">{formError}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-stone-500">
                        {doneChecks}/{task.suggestedChecks.length} checks done · {task.photos.length} photo(s)
                      </span>
                      <Button icon={CircleCheck} onClick={complete}>
                        Complete inspection
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={Gauge} title="Priority breakdown" description="Rule-based, not a risk prediction" />
            <div className="p-4 sm:p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{priority.score}</span>
                <span className="text-sm text-stone-500">/ 100</span>
                {!completed && <PriorityBadge level={priority.level} />}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {priority.factors.map((f) => (
                  <li key={f.label} className="flex justify-between gap-2">
                    <span className="text-stone-700">{f.label}</span>
                    <span className={cn("tabular-nums font-medium", f.points < 0 ? "text-red-600" : "text-stone-900")}>
                      {f.points > 0 ? "+" : ""}
                      {f.points}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Assignment" />
            <div className="p-4 sm:p-5">
              <select
                value={task.assigneeId ?? ""}
                disabled={completed}
                onChange={(e) => assignInspection(task.id, e.target.value || undefined)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:bg-stone-50"
                aria-label="Assigned adviser"
              >
                <option value="">Unassigned</option>
                {state.advisers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.id === state.settings.currentUserId ? " (you)" : ""}
                  </option>
                ))}
              </select>
              <dl className="mt-3 space-y-1 text-xs text-stone-600">
                <div className="flex justify-between">
                  <dt>Started</dt>
                  <dd>{formatDateTime(task.startedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Completed</dt>
                  <dd>{formatDateTime(task.completedAt)}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <FieldAgent
            state={state}
            fieldId={task.fieldId}
            inspectionId={task.id}
            defaultMode={completed ? "summarize_findings" : "checklist"}
            modes={["checklist", "questions", "why_attention", "structure_report", "summarize_findings"]}
          />

          <Link href={`/fields/${task.fieldId}`} className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium hover:border-brand-300">
            Field details, anomalies & history <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
