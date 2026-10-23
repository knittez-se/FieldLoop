"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Calendar, ClipboardList, Eye, Leaf, ListChecks, Ruler, Sprout, TriangleAlert } from "lucide-react";
import { useAppState } from "@/lib/store";
import { farmFor, fieldAnomalies, fieldStatus, recommendedNextSteps } from "@/lib/selectors";
import { formatDate, relativeTime } from "@/lib/format";
import { ANOMALY_STATUS_LABEL, ANOMALY_TYPE_LABEL, CATEGORY_LABEL, OUTCOME_LABEL, SOURCE_LABEL } from "@/lib/labels";
import type { ReactNode } from "react";
import type { Anomaly } from "@/lib/types";
import { CaseTimeline } from "@/components/case-timeline";
import { FieldAgent } from "@/components/field-agent";
import { TrendChart } from "@/components/trend-chart";
import { WeatherCard } from "@/components/weather-card";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  NotFoundCard,
  PageHeader,
  PageLoading,
  PriorityBadge,
  ProvenanceTag,
  StatusBadge,
  type Tone,
} from "@/components/ui";

export default function FieldPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ""));
  const state = useAppState();
  if (!state) return <PageLoading />;

  const field = state.fields.find((f) => f.id === id);
  if (!field) return <NotFoundCard title={`Field "${id}" not found`} href="/map" linkLabel="Back to map" />;

  const farm = farmFor(state, field);
  const status = fieldStatus(state, field.id);
  const anomalies = fieldAnomalies(state, field.id);
  const openAnomaly = anomalies.find((a) => a.status === "open" || a.status === "under_review");
  const steps = recommendedNextSteps(state, field);
  const history = state.inspections.filter((t) => t.fieldId === field.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const observations = state.observations.filter((o) => o.fieldId === field.id);
  const s = field.vegetationIndex.series;
  const change = s.length > 3 ? Math.round(((s[s.length - 1].value - s[s.length - 4].value) / s[s.length - 4].value) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link href="/map" className="hover:underline">
            Field Map
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {field.name}
            <span className="text-base font-normal text-stone-400">{field.id}</span>
          </span>
        }
        description={`${farm?.name ?? ""} · ${farm?.ownerName ?? ""} · ${state.cooperative.name}`}
        actions={
          <>
            <Button variant="secondary" href={`/reports/new?field=${field.id}`} icon={Eye}>
              Add observation
            </Button>
            {status.task && (
              <Button href={`/inspections/${status.task.id}/visit`} icon={ClipboardList}>
                {status.task.status === "in_progress" ? "Continue visit" : "Start visit"}
              </Button>
            )}
          </>
        }
      />

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Fact icon={Sprout} label="Crop" value={field.variety ? `Maize · ${field.variety}` : "Maize"} />
        <Fact icon={Leaf} label="Growth stage" value={field.growthStage} />
        <Fact icon={Ruler} label="Approx. area" value={`${field.areaHa} ha`} />
        <Fact icon={Calendar} label="Last observation" value={relativeTime(field.lastObservationAt)} />
        <Fact icon={ClipboardList} label="Last inspection" value={relativeTime(field.lastInspectionAt)} />
        <Card className="p-3">
          <div className="text-[11px] font-medium text-stone-500">Inspection status</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <PriorityBadge level={status.level} score={status.score} />
            {status.task && <StatusBadge status={status.task.status} />}
          </div>
        </Card>
      </div>

      {openAnomaly && (
        <Card className="border-brand-300">
          <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start sm:p-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Why flagged</div>
              <p className="mt-1 text-sm text-stone-800">{openAnomaly.observed.split(/(?<=\.)\s/)[0]}</p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">What to check</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-stone-800">
                {openAnomaly.verifyOnSite.slice(0, 3).map((v) => (
                  <li key={v}>{v}</li>
                ))}
              </ul>
            </div>
            {status.task && (
              <Button href={`/inspections/${status.task.id}/visit`} className="min-h-11">
                {status.task.status === "in_progress" ? "Continue visit" : "Start visit"}
              </Button>
            )}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={ClipboardList}
          title="Case history"
          description="Signal, visit, notes, and what was confirmed on site. Oldest first."
        />
        <CaseTimeline state={state} fieldId={field.id} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Recommended next steps */}
          <Card className="border-brand-200">
            <CardHeader icon={ListChecks} title="Recommended next steps" description="Derived from open signals and inspection rules" />
            <ol className="space-y-2 p-4 sm:p-5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-stone-800">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Card>

          {/* Anomalies */}
          <Card>
            <CardHeader
              icon={TriangleAlert}
              title="Potential anomalies"
              description="Signals that need verification — not diagnoses"
            />
            {anomalies.length === 0 ? (
              <EmptyState icon={TriangleAlert} title="No anomalies recorded" description="This field has no flagged signals." />
            ) : (
              <details className="group">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-brand-700 hover:bg-stone-50 sm:px-5">
                  <span className="group-open:hidden">Show the evidence: what was observed, why it matters, possible causes, confidence</span>
                  <span className="hidden group-open:inline">Hide the evidence</span>
                </summary>
                <div className="divide-y divide-stone-100 border-t border-stone-100">
                  {anomalies.map((a) => (
                    <AnomalyCard key={a.id} anomaly={a} />
                  ))}
                </div>
              </details>
            )}
          </Card>

          {/* Vegetation trend */}
          <Card>
            <CardHeader
              title="Vegetation index trend"
              description={field.vegetationIndex.label}
              action={<ProvenanceTag kind={field.vegetationIndex.source === "simulated_index" ? "simulated" : "observed"} />}
            />
            <div className="p-4 sm:p-5">
              <TrendChart series={field.vegetationIndex.series} />
              <p className="mt-2 text-xs text-stone-500">
                Change over the last 3 readings: <span className="font-medium text-stone-700">{change > 0 ? "+" : ""}{change}%</span>. {field.vegetationIndex.source === "sentinel2"
                  ? "Real Sentinel-2 NDVI from the data script."
                  : s.some((r) => r.source === "real")
                    ? `Real Sentinel-2 NDVI except ${s.filter((r) => r.source !== "real").length} simulated reading(s), marked in orange.`
                    : "Values are simulated for the demo and do not come from a satellite."}
              </p>
            </div>
          </Card>

          {/* Inspection history + reports */}
          <Card>
            <CardHeader icon={ClipboardList} title="Inspection history" />
            {history.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No inspections yet" />
            ) : (
              <ul className="divide-y divide-stone-100">
                {history.map((t) => {
                  const report = state.reports.find((r) => r.id === t.reportId);
                  return (
                    <li key={t.id}>
                      <Link href={`/inspections/${t.id}`} className="block px-4 py-3 hover:bg-stone-50 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{t.title}</span>
                          <StatusBadge status={t.status} />
                          {report && <Badge tone={report.outcome === "issue_confirmed" ? "red" : report.outcome === "no_issue_found" ? "green" : "amber"}>{OUTCOME_LABEL[report.outcome]}</Badge>}
                        </div>
                        <div className="mt-0.5 text-xs text-stone-500">
                          {t.id} · created {formatDate(t.createdAt)}
                          {t.completedAt && ` · completed ${formatDate(t.completedAt)}`}
                        </div>
                        {report && (
                          <p className="mt-1.5 text-xs text-stone-700">
                            <ProvenanceTag kind="confirmed" className="mr-1.5" />
                            {report.confirmedFindings}
                          </p>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Observations */}
          <Card>
            <CardHeader icon={Eye} title="Ground observations" description="Reports from farmers and advisers" />
            {observations.length === 0 ? (
              <EmptyState
                icon={Eye}
                title="No observations yet"
                action={
                  <Button size="sm" variant="secondary" href={`/reports/new?field=${field.id}`}>
                    Add observation
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {observations.map((o) => (
                  <li key={o.id} className="flex gap-3 px-4 py-3 sm:px-5">
                    {o.photoDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.photoDataUrl} alt="Field observation" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{CATEGORY_LABEL[o.category]}</span>
                        <Badge>{SOURCE_LABEL[o.source]}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-stone-700">{o.description}</p>
                      {o.voiceTranscript && <p className="mt-0.5 text-xs italic text-stone-500">Voice: “{o.voiceTranscript}”</p>}
                      <div className="mt-0.5 text-xs text-stone-500">
                        {o.author} · {relativeTime(o.createdAt)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <FieldAgent state={state} fieldId={field.id} />
          <WeatherCard location={field.centroid} sample={state.weather} live={state.settings.liveWeather} />
          {status.task && (
            <Card className="p-4">
              <div className="text-xs font-medium text-stone-500">Active inspection</div>
              <Link href={`/inspections/${status.task.id}`} className="mt-1 flex items-center justify-between gap-2 text-sm font-medium hover:underline">
                {status.task.title} <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Sprout; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-stone-900">{value}</div>
    </Card>
  );
}

const STATUS_TONE: Record<Anomaly["status"], Tone> = { open: "red", under_review: "blue", confirmed: "violet", dismissed: "green" };

function AnomalyCard({ anomaly: a }: { anomaly: Anomaly }) {
  const resolved = a.status === "confirmed" || a.status === "dismissed";
  return (
    <div className={resolved ? "p-4 opacity-75 sm:p-5" : "p-4 sm:p-5"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{ANOMALY_TYPE_LABEL[a.type]}</span>
        {a.zoneLabel && <Badge>{a.zoneLabel}</Badge>}
        <Badge tone={a.severity === "high" ? "red" : a.severity === "medium" ? "amber" : "sky"}>{a.severity} severity</Badge>
        <Badge tone={STATUS_TONE[a.status]}>{ANOMALY_STATUS_LABEL[a.status]}</Badge>
        <span className="text-xs text-stone-500">
          {a.id} · {formatDate(a.detectedAt)}
        </span>
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <Section n={1} title="What was observed" tag={<ProvenanceTag kind={a.source === "simulated_index" ? "simulated" : "observed"} />}>
          {a.observed}
        </Section>
        <Section n={2} title="Why it may matter" tag={<ProvenanceTag kind="interpretation" />}>
          {a.whyItMatters}
        </Section>
        <Section n={3} title="Possible explanations" tag={<ProvenanceTag kind="hypothesis" />}>
          {a.possibleExplanations.length ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {a.possibleExplanations.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <span className="text-stone-500">Not enough evidence to suggest explanations yet.</span>
          )}
        </Section>
        <Section n={4} title="Confidence of the signal">
          <span className="font-medium capitalize">{a.confidence}</span> — {a.confidenceNote}
        </Section>
        <Section n={5} title="Verify on site" tag={<ProvenanceTag kind="action" />}>
          <ul className="list-disc space-y-0.5 pl-4">
            {a.verifyOnSite.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </Section>
        <Section n={6} title="Next recommended action">
          {a.nextAction}
        </Section>
      </dl>
    </div>
  );
}

function Section({ n, title, tag, children }: { n: number; title: string; tag?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <dt className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
        <span className="text-stone-400">{n}.</span> {title} {tag}
      </dt>
      <dd className="text-stone-800">{children}</dd>
    </div>
  );
}

