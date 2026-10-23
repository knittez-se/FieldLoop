"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, Send, X } from "lucide-react";
import { submitObservation, useAppState, type SubmitObservationResult } from "@/lib/store";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { ObservationCategory } from "@/lib/types";
import { cn } from "@/lib/format";
import { PhotoInput } from "@/components/photo-input";
import { VoiceInput } from "@/components/voice-input";
import { Button, Card, PageHeader, PageLoading } from "@/components/ui";

const CATEGORIES: ObservationCategory[] = ["water_stress", "unusual_growth", "leaf_damage", "pests_visible", "other"];

export default function NewObservationPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ObservationForm />
    </Suspense>
  );
}

function ObservationForm() {
  const state = useAppState();
  const params = useSearchParams();
  const [fieldId, setFieldId] = useState<string>(params?.get("field") ?? "");
  const [category, setCategory] = useState<ObservationCategory | null>(null);
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<(SubmitObservationResult & { fieldId: string }) | null>(null);

  if (!state) return <PageLoading />;
  const user = state.advisers.find((a) => a.id === state.settings.currentUserId);

  function reset() {
    setCategory(null);
    setDescription("");
    setVoice("");
    setPhoto(undefined);
    setResult(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!fieldId) return setError("Select a field.");
    if (!category) return setError("Choose a category.");
    if (description.trim().length < 5 && voice.trim().length < 5) return setError("Describe what you saw (or dictate it).");
    setError(null);
    setSubmitting(true);
    const res = submitObservation({
      fieldId,
      category,
      description: description.trim() || voice.trim(),
      voiceTranscript: voice.trim() || undefined,
      photoDataUrl: photo,
    });
    setSubmitting(false);
    setResult({ ...res, fieldId });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result) {
    const field = state.fields.find((f) => f.id === result.fieldId);
    return (
      <div className="mx-auto max-w-xl">
        <Card className="p-6 text-center" >
          <div role="status">
            <CircleCheck className="mx-auto h-10 w-10 text-brand-600" />
            <h1 className="mt-3 text-lg font-semibold">Observation saved</h1>
            <p className="mt-1 text-sm text-stone-600">
              Added to the history of <strong>{field?.name}</strong>.{" "}
              {result.createdInspection
                ? "A new inspection task was created so an adviser can verify it."
                : result.inspectionId
                  ? `It was attached to the open inspection ${result.inspectionId}.`
                  : "No inspection was created (category “Other”)."}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {result.inspectionId && <Button href={`/inspections/${result.inspectionId}`}>Open inspection</Button>}
            <Button variant="secondary" href={`/fields/${result.fieldId}`}>
              View field
            </Button>
            <Button variant="ghost" onClick={reset}>
              Report another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Report an observation" description="Quick report from the field. Works on a phone — add a photo or dictate." />
      <Card>
        <form onSubmit={submit} className="space-y-5 p-4 sm:p-6" noValidate>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-600">Field *</span>
            <select
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Select a field…</option>
              {state.farms.map((farm) => (
                <optgroup key={farm.id} label={farm.name}>
                  {state.fields
                    .filter((f) => f.farmId === farm.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.id})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-stone-600">What did you notice? *</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    category === c ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300 bg-white hover:bg-stone-50",
                  )}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-stone-600">Description *</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Where in the field, how many plants, what it looks like…"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-semibold text-stone-600">Voice note (transcribed in the browser)</span>
            <VoiceInput onText={(t) => setVoice((prev) => (prev ? `${prev} ${t}` : t))} />
            {voice && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-stone-50 p-2.5 text-sm">
                <span className="flex-1 italic text-stone-700">“{voice}”</span>
                <button type="button" onClick={() => setVoice("")} className="text-stone-400 hover:text-stone-700" aria-label="Clear transcription">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="mb-1 block text-xs font-semibold text-stone-600">Photo (optional)</span>
            {photo ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Selected" className="h-32 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPhoto(undefined)}
                  className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                  aria-label="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <PhotoInput onPhoto={setPhoto} label="Take or choose photo" />
            )}
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-stone-500">Reporting as {user?.name ?? "unknown user"} · saved on this device</span>
            <Button type="submit" icon={Send} disabled={submitting}>
              Submit observation
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
