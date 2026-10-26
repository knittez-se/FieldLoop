"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info, Sprout } from "lucide-react";
import { useAppState } from "@/lib/store";
import { activeInspections, adviserName, changeGroups, greennessChange, hasRealData, impactSummary, mapStatus, todayBriefing } from "@/lib/selectors";
import { INSPECTION_STATUS_LABEL } from "@/lib/labels";
import { cn, formatDate } from "@/lib/format";
import type { Priority } from "@/lib/types";
import { FieldMap, MapLegend } from "@/components/field-map";
import { QueueShiftBanner } from "@/components/queue-shift";
import { Button, DemoNotice, EmptyState, PageLoading } from "@/components/ui";

const OTHERS_SHOWN = 4; // fields without a visit listed under the queue; the rest are on the map
const GAUGE_COLOR: Record<Priority, string> = { high: "#e0483a", medium: "#ef8a2c", low: "#3b82c4" };
const GROUP_COLOR: Record<string, string> = {
  "fall-fast": "#e0483a",
  fall: "#ef8a2c",
  steady: "#c7cfc8",
  rise: "#8fd18a",
  "rise-fast": "#2fae7c",
};
const PILL: Record<Priority | "ok", string> = {
  high: "bg-[#fde8e5] text-[#b02a1e]",
  medium: "bg-[#fdefe0] text-[#9a4f05]",
  low: "bg-sky-50 text-sky-800",
  ok: "bg-[#e6f5ee] text-[#1d7550]",
};

function Panel({ className, children, labelledBy }: { className?: string; children: ReactNode; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cn("rounded-[20px] border border-hairline bg-white p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}

export default function TodayPage() {
  const state = useAppState();
  const router = useRouter();
  const d = useMemo(() => {
    if (!state) return null;
    const queue = activeInspections(state);
    const changes = greennessChange(state);
    const changeById = new Map(changes.map((c) => [c.field.id, c]));
    const queued = new Set(queue.map((r) => r.task.fieldId));
    const others = state.fields
      .filter((f) => !queued.has(f.id))
      .sort((a, b) => (changeById.get(b.id)?.pct ?? -999) - (changeById.get(a.id)?.pct ?? -999));
    const dates = state.fields.flatMap((f) => f.vegetationIndex.series.map((r) => r.date)).sort();
    const simulatedReadings = state.fields.flatMap((f) => f.vegetationIndex.series).filter((r) => r.source !== "real").length;
    return {
      queue,
      others,
      changeById,
      groups: changeGroups(state),
      impact: impactSummary(state),
      briefing: todayBriefing(state),
      status: mapStatus(state),
      haNoVisit: state.fields.filter((f) => !queued.has(f.id)).reduce((s, f) => s + f.areaHa, 0).toFixed(1),
      simulatedChanges: changes.filter((c) => c.simulated && c.pct !== null).length,
      range: dates.length ? `${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}` : "",
      simulatedReadings,
      totalReadings: state.fields.flatMap((f) => f.vegetationIndex.series).length,
    };
  }, [state]);

  if (!state || !d) return <PageLoading />;
  const top = d.queue[0];
  const maxGroup = Math.max(1, ...d.groups.map((g) => g.count));
  const pct = (id: string) => d.changeById.get(id)?.pct;

  return (
    <div className="space-y-5">
      <QueueShiftBanner state={state} />

      <p className="flex items-start gap-2 text-sm text-stone-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Based on {hasRealData(state) ? "Sentinel-2 satellite" : "simulated"} greenness readings for {state.fields.length} fields from {d.range}.
          {d.simulatedReadings > 0 && d.simulatedReadings < d.totalReadings && ` ${d.simulatedReadings} readings are simulated for the demo.`}
        </span>
      </p>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
        {/* First visit, Genesis-style gauge */}
        <Panel labelledBy="first-h" className="flex flex-col">
          <h2 id="first-h" className="text-xl font-bold tracking-tight">First visit today</h2>
          {top ? (
            <>
              <p className="mt-1 text-sm text-stone-500">Priority score from greenness change, farmer reports and time since the last visit</p>
              <div className="relative mx-auto mt-5 w-60 max-w-full">
                <svg viewBox="0 0 236 130" aria-hidden="true" className="block w-full">
                  <path d="M18 118 A100 100 0 0 1 218 118" fill="none" stroke="#eef2ee" strokeWidth="20" strokeLinecap="round" />
                  <path
                    d="M18 118 A100 100 0 0 1 218 118"
                    fill="none"
                    stroke={GAUGE_COLOR[top.priority.level]}
                    strokeWidth="20"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={`${top.priority.score} 100`}
                  />
                </svg>
                <div className="absolute inset-x-0 bottom-2 text-center">
                  <div className="text-5xl font-semibold leading-none tracking-tight tabular-nums">{top.priority.score}</div>
                  <span className={cn("mt-1 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold", PILL[top.priority.level])}>
                    {top.priority.level[0].toUpperCase() + top.priority.level.slice(1)} priority
                  </span>
                </div>
              </div>
              <div className="mx-auto flex w-60 max-w-full justify-between text-xs text-stone-400 tabular-nums">
                <span>0</span>
                <span>100</span>
              </div>
              <div className="mt-4 border-t border-hairline pt-4">
                <div className="text-lg font-bold">{top.field?.name}</div>
                <p className="mt-0.5 text-sm text-stone-500">{d.briefing.detail}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" href={`/inspections/${top.task.id}`}>
                  Why this field
                </Button>
                <Button href={`/inspections/${top.task.id}/visit`} className="ml-auto min-h-11 !bg-forest hover:!brightness-110">
                  {top.task.status === "in_progress" ? "Continue visit" : "Start visit"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <EmptyState icon={Sprout} title="All caught up" description="No field needs a visit. New alerts and farmer reports will appear here." />
          )}
        </Panel>

        {/* Change groups, Genesis-style bar chart */}
        <Panel labelledBy="change-h">
          <h2 id="change-h" className="text-xl font-bold tracking-tight">Greenness change, last 3 weeks</h2>
          <p className="mt-1 text-sm text-stone-500">Each field compared with its own reading three readings earlier</p>
          <div className="mt-4 grid items-end gap-6 md:grid-cols-[170px_minmax(0,1fr)]">
            <div>
              <div className="text-[56px] font-semibold leading-none tracking-tight tabular-nums">
                {d.impact.visitsAvoidedPct}
                <span className="text-4xl font-medium text-stone-400">%</span>
              </div>
              <p className="mt-1.5 text-sm text-stone-500">of your fields need no visit</p>
              <p className="mt-4 text-sm text-stone-500">
                <b className="font-semibold text-stone-900 tabular-nums">{d.impact.fieldsMonitored - d.impact.needVisit}</b> of{" "}
                <b className="font-semibold text-stone-900 tabular-nums">{d.impact.fieldsMonitored}</b> fields,{" "}
                <b className="font-semibold text-stone-900 tabular-nums">{d.haNoVisit}</b> of {d.impact.hectares} ha
              </p>
            </div>
            <div className="grid grid-cols-5 items-end gap-1.5 sm:gap-2" role="img" aria-label={d.groups.map((g) => `${g.label}: ${g.count}`).join(", ")}>
              {d.groups.map((g) => (
                <div key={g.id} className="flex flex-col items-center">
                  <span className="mb-1.5 text-sm font-medium tabular-nums text-stone-600">{g.count}</span>
                  <div
                    className="w-full rounded-t-[4px]"
                    style={{ height: g.count ? `${Math.max(6, (g.count / maxGroup) * 150)}px` : "3px", background: GROUP_COLOR[g.id] }}
                  />
                  <span className="mt-2 text-center text-[13px] font-semibold leading-tight sm:text-sm">{g.label}</span>
                  <span className="text-center text-[11.5px] text-stone-500 sm:text-xs">{g.range}</span>
                </div>
              ))}
            </div>
          </div>
          {d.simulatedChanges > 0 && d.simulatedChanges < state.fields.length && (
            <p className="mt-4 text-xs text-stone-500">
              {d.simulatedChanges} field{d.simulatedChanges === 1 ? "'s" : "s'"} change includes simulated readings.
            </p>
          )}
        </Panel>

        {/* Ranked fields next to the map */}
        <Panel labelledBy="queue-h" className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="queue-h" className="text-xl font-bold tracking-tight">Visits, most urgent first</h2>
            <Link href="/inspections" className="inline-flex min-h-10 items-center rounded-xl border border-hairline px-3 text-sm font-medium hover:bg-stone-50">
              All visits
            </Link>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="overflow-x-auto">
              <table className="w-full text-[14.5px]">
                <thead>
                  <tr className="text-left text-[13px] text-stone-500">
                    <th className="px-2 pb-2.5 font-medium">Field</th>
                    <th className="px-2 pb-2.5 font-medium">Priority</th>
                    <th className="px-2 pb-2.5 text-right font-medium">3-week change</th>
                  </tr>
                </thead>
                <tbody>
                  {[...d.queue.map((r) => ({ field: r.field!, r })), ...d.others.slice(0, OTHERS_SHOWN).map((field) => ({ field, r: undefined }))].map(({ field, r }, i) => {
                    const p = pct(field.id);
                    return (
                      <tr
                        key={field.id}
                        onClick={() => router.push(`/fields/${field.id}`)}
                        className={cn("cursor-pointer border-t border-hairline hover:bg-stone-50", i === 0 && r && "bg-[#f6faf6]", !r && "text-stone-400")}
                      >
                        <td className="px-2 py-2.5">
                          <Link href={`/fields/${field.id}`} className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                            <span
                              className={cn(
                                "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums",
                                i === 0 && r ? "bg-lime text-forest" : "bg-stone-100 text-stone-500",
                              )}
                            >
                              {i + 1}
                            </span>
                            <span className="min-w-0">
                              <span className={cn("block", r && "text-stone-900")}>{field.name}</span>
                              {r && (
                                <span className="block text-[12.5px] text-stone-500">
                                  {INSPECTION_STATUS_LABEL[r.task.status]}
                                  {r.task.assigneeId ? `, ${adviserName(state, r.task.assigneeId)}` : ""}
                                </span>
                              )}
                            </span>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums", PILL[r ? r.priority.level : "ok"])}>
                            {r ? `${r.priority.score} ${r.priority.level[0].toUpperCase() + r.priority.level.slice(1)}` : "No visit needed"}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                          {p == null ? "–" : <span className={p < 0 ? "text-[#b02a1e]" : "text-[#1d7550]"}>{p > 0 ? "+" : ""}{p}%</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {d.others.length > OTHERS_SHOWN && (
                    <tr className="border-t border-hairline">
                      <td colSpan={3} className="px-2 py-3 text-sm text-stone-500">
                        {d.others.length - OTHERS_SHOWN} more fields need no visit.{" "}
                        <Link href="/map" className="font-medium text-forest underline-offset-2 hover:underline">
                          See them on the map
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col">
              <FieldMap
                compact
                fields={state.fields}
                status={d.status}
                anomalies={state.anomalies}
                onSelect={(id) => router.push(`/fields/${id}`)}
                className="h-80 flex-1 overflow-hidden rounded-2xl lg:h-auto lg:min-h-80"
              />
              <MapLegend className="mt-3 px-1" />
            </div>
          </div>
        </Panel>
      </div>

      <DemoNotice>
        {state.cooperative.name}, its farmers and advisers are fictional.{" "}
        {d.simulatedReadings === 0
          ? "Greenness values are real Sentinel-2 NDVI. Alerts are rule-based signals, not diagnoses."
          : d.simulatedReadings === d.totalReadings
            ? "Greenness values are simulated, not satellite measurements."
            : `${d.totalReadings - d.simulatedReadings} of ${d.totalReadings} greenness readings are real Sentinel-2 NDVI; the ${d.simulatedReadings} simulated ones are marked on each field's chart. Alerts are rule-based signals, not diagnoses.`}
      </DemoNotice>
    </div>
  );
}
