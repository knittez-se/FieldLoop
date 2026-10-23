"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sprout } from "lucide-react";
import { completeOnboarding, setDataMode } from "@/lib/store";
import { candidateFields, CROPS, DEFAULT_PROFILE, REGIONS, regionById, type OnboardingProfile } from "@/lib/onboarding";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/format";
import { FieldMap } from "./field-map";
import { Button } from "./ui";

const ROLES: Array<{ id: OnboardingProfile["role"]; label: string; hint: string }> = [
  { id: "farmer", label: "Farmer", hint: "I look after my own plots" },
  { id: "adviser", label: "Cooperative adviser", hint: "I visit many farmers' fields" },
  { id: "ngo", label: "NGO / program manager", hint: "I run a program across a region" },
];

const SELECTED = "#2f6641";
const UNSELECTED = "#a8a29e";

/** Five quick questions that personalize the demo. Skippable. */
export function OnboardingQuiz({ state }: { state: AppState }) {
  const router = useRouter();
  const candidates = useMemo(() => candidateFields(state), [state]);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<OnboardingProfile>({ ...DEFAULT_PROFILE, fieldIds: candidates.map((c) => c.id) });
  const [mode, setMode] = useState(state.settings.dataMode ?? "real");
  // Real data loads from data/ after the quiz has opened and replaces the plots; select all of the new ones.
  const candidateKey = candidates.map((c) => c.id).join();
  useEffect(() => setP((x) => ({ ...x, fieldIds: candidates.map((c) => c.id) })), [candidateKey]);
  const picked = new Set(p.fieldIds === "all" ? candidates.map((c) => c.id) : p.fieldIds);
  const pickedFields = candidates.filter((c) => picked.has(c.id));
  const hectares = pickedFields.reduce((s, c) => s + c.areaHa, 0);
  const region = regionById(p.regionId);
  const steps = p.role === "farmer" ? ["role", "region", "crops", "fields", "done"] : ["role", "region", "crops", "fields", "team", "done"];
  const current = steps[step];

  const colorFor = useCallback((id: string) => (picked.has(id) ? SELECTED : UNSELECTED), [picked]);
  const toggle = (id: string) => setP((x) => ({ ...x, fieldIds: picked.has(id) ? [...picked].filter((f) => f !== id) : [...picked, id] }));
  const pickCrops = (crops: string[]) =>
    setP((x) => ({ ...x, crops, fieldIds: candidates.filter((c) => crops.includes(c.crop)).map((c) => c.id) }));

  async function finish(profile: OnboardingProfile) {
    if (mode !== (state.settings.dataMode ?? "real")) {
      await setDataMode(mode);
      // Real data has other plots; keep all of them.
      completeOnboarding({ ...profile, fieldIds: "all" });
    } else completeOnboarding(profile);
    router.push("/");
  }

  const cropSummary = Object.entries(
    pickedFields.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.crop]: (acc[c.crop] ?? 0) + c.areaHa }), {}),
  )
    .map(([crop, ha]) => `${ha.toFixed(1)} ha ${crop}`)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-[1300] overflow-y-auto bg-stone-50" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <Sprout className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight">FarmSignal</span>
          </div>
          <button type="button" onClick={() => finish(DEFAULT_PROFILE)} className="text-sm font-medium text-stone-600 underline-offset-2 hover:underline">
            Skip — use demo farms
          </button>
        </div>

        <div className="mb-6 flex gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <div key={s} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-brand-600" : "bg-stone-200")} />
          ))}
        </div>

        <div className="flex-1">
          {current === "role" && (
            <Step title="Who are you?" hint="We adjust the words and the first screen to your work.">
              <div className="grid gap-3 sm:grid-cols-3">
                {ROLES.map((r) => (
                  <Choice key={r.id} active={p.role === r.id} onClick={() => setP({ ...p, role: r.id })} label={r.label} hint={r.hint} />
                ))}
              </div>
            </Step>
          )}

          {current === "region" && (
            <Step title="Where do you work?" hint="The map starts there.">
              <select
                id="quiz-region"
                value={p.regionId}
                onChange={(e) => setP({ ...p, regionId: e.target.value })}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base"
                aria-label="Region"
              >
                {Array.from(new Set(REGIONS.map((r) => r.country))).map((country) => (
                  <optgroup key={country} label={country}>
                    {REGIONS.filter((r) => r.country === country).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {!region.hasDemoFields && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  We don&apos;t have field data for {region.name} in this prototype yet. The next steps use our demo farms in Trans-Nzoia, Kenya.
                </p>
              )}
            </Step>
          )}

          {current === "crops" && (
            <Step title="What is grown?" hint="Pick all that apply. We preselect matching plots in the next step.">
              <div className="flex flex-wrap gap-2">
                {CROPS.map((c) => {
                  const on = p.crops.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickCrops(on ? p.crops.filter((x) => x !== c.id) : [...p.crops, c.id])}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium",
                        on ? "border-brand-600 bg-brand-600 text-white" : "border-stone-300 bg-white hover:bg-stone-50",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </Step>
          )}

          {current === "fields" && (
            <Step title={p.role === "farmer" ? "Which plots are yours?" : "Which plots do you look after?"} hint="Tap a plot to add or remove it. Outlines are already on the map — no drawing needed.">
              <FieldMap fields={candidates} status={{}} anomalies={[]} colorFor={colorFor} onSelect={toggle} className="h-80 sm:h-96" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-stone-700">
                  <strong>{pickedFields.length}</strong> plots · <strong>{hectares.toFixed(1)} ha</strong>
                  {cropSummary && <span className="text-stone-500"> · {cropSummary}</span>}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setP({ ...p, fieldIds: candidates.map((c) => c.id) })}>
                    Select all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setP({ ...p, fieldIds: [] })}>
                    Clear
                  </Button>
                </div>
              </div>
            </Step>
          )}

          {current === "team" && (
            <Step title="Your team" hint="So we can tell you whether this week's visits fit.">
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="quiz-advisers" label="Field advisers" value={p.advisers} onChange={(v) => setP({ ...p, advisers: v })} />
                <NumberField id="quiz-visits" label="Field visits per adviser per day" value={p.visitsPerAdviserDay} onChange={(v) => setP({ ...p, visitsPerAdviserDay: v })} />
              </div>
            </Step>
          )}

          {current === "done" && (
            <Step title="You're set up" hint="Here is what FarmSignal will watch for you.">
              <div className="rounded-xl border border-brand-200 bg-white p-4 text-sm leading-relaxed text-stone-800">
                <strong>{region.name}, {region.country}</strong> · {pickedFields.length} plots · {hectares.toFixed(1)} ha
                {cropSummary && <> · {cropSummary}</>}
                {p.role !== "farmer" && (
                  <>
                    {" "}· {p.advisers} adviser{p.advisers === 1 ? "" : "s"}, up to {p.advisers * p.visitsPerAdviserDay * 5} visits a week
                  </>
                )}
              </div>
              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-semibold text-stone-700">Data</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choice active={mode === "showcase"} onClick={() => setMode("showcase")} label="Showcase data" hint="Simulated. Shows everything FarmSignal can find." />
                  <Choice active={mode === "real"} onClick={() => setMode("real")} label="Real data (Kitale)" hint="8 real plots, real Sentinel-2 and rainfall." />
                </div>
              </fieldset>
            </Step>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" icon={ArrowLeft} disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </Button>
          {current === "done" ? (
            <Button onClick={() => finish(p)} className="min-h-11 px-5">
              Go to Today <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} disabled={current === "fields" && pickedFields.length === 0} className="min-h-11 px-5">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section>
      <h1 id="quiz-title" className="text-2xl font-semibold tracking-tight text-stone-900">
        {title}
      </h1>
      <p className="mb-5 mt-1 text-stone-600">{hint}</p>
      {children}
    </section>
  );
}

function Choice({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white p-4 text-left transition-colors",
        active ? "border-brand-600 ring-2 ring-brand-600" : "border-stone-200 hover:border-stone-300",
      )}
    >
      <div className="font-semibold text-stone-900">{label}</div>
      <div className="mt-0.5 text-sm text-stone-600">{hint}</div>
    </button>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      <input
        id={id}
        type="number"
        min={1}
        max={50}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-3 text-base"
      />
    </label>
  );
}
