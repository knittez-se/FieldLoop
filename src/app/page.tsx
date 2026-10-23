"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Map as MapIcon,
  Siren,
  Sprout,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import { activeInspections, adviserName, dashboardStats, lastQueueChange, mapStatus } from "@/lib/selectors";
import { relativeTime } from "@/lib/format";
import { OUTCOME_LABEL, CATEGORY_LABEL } from "@/lib/labels";
import { ActivityFeed } from "@/components/activity-feed";
import { FieldMap, MapLegend } from "@/components/field-map";
import { QueueShiftBanner } from "@/components/queue-shift";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DemoNotice,
  EmptyState,
  PageHeader,
  PageLoading,
  PriorityBadge,
  StatCard,
  StatusBadge,
} from "@/components/ui";

export default function OverviewPage() {
  const state = useAppState();
  const router = useRouter();
  const derived = useMemo(() => {
    if (!state) return null;
    return {
      stats: dashboardStats(state),
      queue: activeInspections(state),
      status: mapStatus(state),
    };
  }, [state]);

  if (!state || !derived) return <PageLoading />;
  const { stats, queue, status } = derived;
  const top = queue[0];
  const user = state.advisers.find((a) => a.id === state.settings.currentUserId);
  const promotedTaskId = lastQueueChange(state)?.moves.find((move) => move.toRank === 1 && move.movement !== "same")?.inspectionId;

  const recentReports = [
    ...state.reports.map((r) => ({
      id: r.id,
      at: r.createdAt,
      fieldId: r.fieldId,
      title: `Inspection report – ${OUTCOME_LABEL[r.outcome]}`,
      text: r.confirmedFindings,
      author: r.author,
      href: `/inspections/${r.inspectionId}`,
      kind: "report" as const,
    })),
    ...state.observations.map((o) => ({
      id: o.id,
      at: o.createdAt,
      fieldId: o.fieldId,
      title: `${CATEGORY_LABEL[o.category]} observation`,
      text: o.description,
      author: o.author,
      href: `/fields/${o.fieldId}`,
      kind: "observation" as const,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${state.cooperative.name} · ${state.cooperative.region}`}
        title={`Hello${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Here is what needs your attention across the cooperative's maize fields."
        actions={
          <>
            <Button variant="secondary" href="/map" icon={MapIcon}>
              Open map
            </Button>
            <Button variant="secondary" href="/settings#reset-demo">
              Reset demo
            </Button>
            <Button href="/reports/new">Report observation</Button>
          </>
        }
      />

      <QueueShiftBanner state={state} />

      {/* Next action */}
      {top ? (
        <Card className="overflow-hidden border-brand-200">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-brand-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Siren className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Inspect first</div>
                <div className="mt-0.5 text-base font-semibold text-stone-900">
                  {top.field?.name} <span className="font-normal text-stone-500">({top.task.fieldId})</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{top.task.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PriorityBadge level={top.priority.level} score={top.priority.score} />
                  <StatusBadge status={top.task.status} />
                  <Badge>
                    <UserRound className="h-3 w-3" />
                    {adviserName(state, top.task.assigneeId) ?? "Unassigned"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button href={`/inspections/${top.task.id}/visit`} className="min-h-11">
                {top.task.status === "in_progress" ? "Continue visit" : "Start visit"} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" href={`/inspections/${top.task.id}`}>
                Details
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={Sprout}
            title="All caught up"
            description="There are no open inspections. New alerts and ground reports will appear here."
          />
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Monitored fields" value={stats.totalFields} hint={`${stats.totalAreaHa} ha maize`} icon={Sprout} href="/map" />
        <StatCard
          label="Fields requiring inspection"
          value={stats.fieldsRequiringInspection}
          hint="Fields with an open or ongoing inspection"
          icon={MapIcon}
          tone="amber"
          href="/inspections"
        />
        <StatCard
          label="High-priority alerts"
          value={stats.highPriorityAlerts}
          hint="Active inspections scored ≥ 60"
          icon={TriangleAlert}
          tone="red"
          href="/inspections"
        />
        <StatCard
          label="Open inspection tasks"
          value={stats.openTasks + stats.inProgressTasks}
          hint={`${stats.openTasks} open · ${stats.inProgressTasks} in progress`}
          icon={ClipboardList}
          tone="blue"
          href="/inspections"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Priority list */}
        <Card className="lg:col-span-3">
          <CardHeader
            icon={ClipboardList}
            title="Fields requiring attention"
            description="Ranked by a transparent rule-based score (not a risk prediction)"
            action={
              <Link href="/inspections" className="text-xs font-medium text-brand-700 hover:underline">
                View all
              </Link>
            }
          />
          {queue.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No fields need inspection" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {queue.slice(0, 5).map((r, i) => (
                <li key={r.task.id}>
                  <Link
                    href={`/inspections/${r.task.id}/visit`}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-stone-50 sm:px-5 ${r.task.id === promotedTaskId ? "bg-amber-50" : ""}`}
                  >
                    <span className="w-5 text-center text-sm font-semibold tabular-nums text-stone-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-medium text-stone-900">{r.field?.name}</span>
                        {r.task.id === promotedTaskId && <span className="text-[11px] font-semibold text-amber-800">Now first</span>}
                        <PriorityBadge level={r.priority.level} score={r.priority.score} />
                        <StatusBadge status={r.task.status} />
                      </div>
                      <div className="mt-0.5 truncate text-xs text-stone-500">{r.task.title}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-stone-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Map preview */}
        <Card className="lg:col-span-2">
          <CardHeader
            icon={MapIcon}
            title="Map preview"
            description={
              state.data.origin === "data_files"
                ? "Outlines from data/fields.geojson · simulated, not a satellite image"
                : "Built-in sample outlines · not a satellite image"
            }
            action={
              <Link href="/map" className="text-xs font-medium text-brand-700 hover:underline">
                Full map
              </Link>
            }
          />
          <div className="p-3">
            <FieldMap
              compact
              fields={state.fields}
              status={status}
              anomalies={state.anomalies}
              onSelect={(id) => router.push(`/fields/${id}`)}
              className="h-64"
            />
            <MapLegend className="mt-3 px-1" />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Recent activity" description="Latest changes across all fields" />
          <ActivityFeed events={state.activity} fields={state.fields} limit={7} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            icon={FileText}
            title="Recent field reports"
            description={`${stats.reportsLast7Days} reports & observations in the last 7 days`}
            action={
              <Link href="/reports" className="text-xs font-medium text-brand-700 hover:underline">
                All reports
              </Link>
            }
          />
          {recentReports.length === 0 ? (
            <EmptyState icon={FileText} title="No reports yet" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {recentReports.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="block px-4 py-3 hover:bg-stone-50 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-stone-900">{r.title}</span>
                      <span className="shrink-0 text-xs text-stone-500">{relativeTime(r.at)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-stone-600">{r.text}</p>
                    <div className="mt-1 text-[11px] text-stone-500">
                      {state.fields.find((f) => f.id === r.fieldId)?.name} · {r.author}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <DemoNotice>
        {state.cooperative.name}, its farmers and advisers are fictional.{" "}
        {state.fields.every((f) => f.vegetationIndex.source === "sentinel2")
          ? "Greenness values are real Sentinel-2 NDVI from the data script; anomalies are rule-based signals, not diagnoses."
          : "Greenness values are simulated (labeled per field), not satellite measurements."}
      </DemoNotice>
    </div>
  );
}
