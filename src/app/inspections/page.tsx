"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Info, UserRound } from "lucide-react";
import { useAppState } from "@/lib/store";
import { adviserName, rankInspections } from "@/lib/selectors";
import { relativeTime, cn } from "@/lib/format";
import type { InspectionStatus } from "@/lib/types";
import { Badge, Card, EmptyState, PageHeader, PageLoading, PriorityBadge, StatusBadge } from "@/components/ui";

type Tab = "active" | InspectionStatus | "all";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "active", label: "Active queue" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
];

export default function InspectionsPage() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>("active");
  const [mineOnly, setMineOnly] = useState(false);
  const ranked = useMemo(() => (state ? rankInspections(state) : []), [state]);

  if (!state) return <PageLoading />;

  const list = ranked.filter((r) => {
    if (mineOnly && r.task.assigneeId !== state.settings.currentUserId) return false;
    if (tab === "active") return r.task.status !== "completed";
    if (tab === "all") return true;
    return r.task.status === tab;
  });
  const count = (t: Tab) =>
    ranked.filter((r) => (t === "active" ? r.task.status !== "completed" : t === "all" ? true : r.task.status === t)).length;

  return (
    <div>
      <PageHeader
        title="Inspections"
        description="Prioritized queue of field visits. Highest score first."
      />

      <Card className="mb-4 flex items-start gap-2 p-3 text-xs text-stone-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <span>
          The priority score is a transparent rule-based heuristic: signal severity (+10/25/40), size of recent change (+10/20), time
          since last inspection (+10/20) and a fresh ground report (+15), minus 5 for low-confidence signals. It orders the work — it is
          not a validated risk prediction. Open an inspection to see its breakdown.
        </span>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-stone-200/60 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                tab === t.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900",
              )}
            >
              {t.label} <span className="ml-0.5 tabular-nums text-stone-400">{count(t.id)}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-stone-700">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-brand-600" />
          Only assigned to me
        </label>
      </div>

      <Card>
        {list.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing here" description="No inspections match this filter." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((r, i) => (
              <li key={r.task.id}>
                <Link href={`/inspections/${r.task.id}`} className="flex gap-3 px-4 py-4 hover:bg-stone-50 sm:items-center sm:px-5">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-white",
                      r.task.status === "completed"
                        ? "bg-stone-300"
                        : r.priority.level === "high"
                          ? "bg-red-600"
                          : r.priority.level === "medium"
                            ? "bg-amber-500"
                            : "bg-sky-600",
                    )}
                    title="Rule-based priority score"
                  >
                    <span className="text-sm font-bold leading-none tabular-nums">{r.priority.score}</span>
                    <span className="text-[9px] opacity-80">score</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {tab === "active" && <span className="text-xs font-semibold text-stone-400">#{i + 1}</span>}
                      <span className="text-sm font-semibold text-stone-900">{r.field?.name}</span>
                      <span className="text-xs text-stone-400">{r.task.fieldId}</span>
                      {r.task.status !== "completed" && <PriorityBadge level={r.priority.level} />}
                      <StatusBadge status={r.task.status} />
                    </div>
                    <div className="mt-0.5 text-sm text-stone-700">{r.task.title}</div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">{r.task.reason}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                      <Badge>
                        <UserRound className="h-3 w-3" /> {adviserName(state, r.task.assigneeId) ?? "Unassigned"}
                      </Badge>
                      <span>{r.task.suggestedChecks.filter((c) => c.done).length}/{r.task.suggestedChecks.length} checks</span>
                      <span>· updated {relativeTime(r.task.updatedAt)}</span>
                    </div>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-stone-300 sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
