"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Calendar, Ruler, X } from "lucide-react";
import { useAppState } from "@/lib/store";
import { farmFor, fieldAnomalies, fieldStatus, mapStatus } from "@/lib/selectors";
import { relativeTime, cn } from "@/lib/format";
import { ANOMALY_TYPE_LABEL } from "@/lib/labels";
import type { Priority } from "@/lib/types";
import { FieldMap, MapLegend } from "@/components/field-map";
import { Badge, Button, Card, DemoNotice, PageHeader, PageLoading, PriorityBadge, ProvenanceTag, StatusBadge } from "@/components/ui";

type Filter = "all" | "attention";
const LEVEL_ORDER: Record<Priority | "ok", number> = { high: 0, medium: 1, low: 2, ok: 3 };

export default function MapPage() {
  const state = useAppState();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>("all");
  const status = useMemo(() => (state ? mapStatus(state) : {}), [state]);

  if (!state) return <PageLoading />;

  const fields = [...state.fields]
    .filter((f) => filter === "all" || status[f.id]?.level !== "ok")
    .sort((a, b) => LEVEL_ORDER[status[a.id].level] - LEVEL_ORDER[status[b.id].level] || (status[b.id].score ?? 0) - (status[a.id].score ?? 0));
  const selected = state.fields.find((f) => f.id === selectedId);

  return (
    <div>
      <PageHeader
        title="Field Map"
        description="Select a field or marker to see why it was flagged and what to do next."
        actions={<DemoNotice>Demo coordinates in Trans-Nzoia, Kenya. Boundaries are generated, not surveyed.</DemoNotice>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-3">
          <FieldMap
            fields={state.fields}
            status={status}
            anomalies={state.anomalies}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="h-[420px] sm:h-[560px]"
          />
          <MapLegend className="mt-3 px-1" />
        </Card>

        <div className="space-y-4">
          {selected ? (
            <SelectedFieldPanel fieldId={selected.id} onClose={() => setSelectedId(undefined)} />
          ) : (
            <Card className="p-4 text-sm text-stone-600">Select a field on the map or in the list below.</Card>
          )}

          <Card>
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
              <span className="text-sm font-semibold">Fields ({fields.length})</span>
              <div className="flex rounded-lg bg-stone-100 p-0.5 text-xs">
                {(["all", "attention"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn("rounded-md px-2 py-1 font-medium", filter === f ? "bg-white shadow-sm" : "text-stone-600")}
                  >
                    {f === "all" ? "All" : "Needs attention"}
                  </button>
                ))}
              </div>
            </div>
            <ul className="max-h-[360px] divide-y divide-stone-100 overflow-y-auto">
              {fields.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50", f.id === selectedId && "bg-brand-50")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="text-xs text-stone-500">
                        {f.id} · {f.areaHa} ha · {farmFor(state, f)?.name}
                      </div>
                    </div>
                    <PriorityBadge level={status[f.id].level} score={status[f.id].score} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );

  function SelectedFieldPanel({ fieldId, onClose }: { fieldId: string; onClose: () => void }) {
    const s = state!;
    const field = s.fields.find((f) => f.id === fieldId)!;
    const st = fieldStatus(s, fieldId);
    const anomalies = fieldAnomalies(s, fieldId).filter((a) => a.status === "open" || a.status === "under_review");
    return (
      <Card>
        <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <div>
            <div className="text-xs text-stone-500">
              {field.id} · {farmFor(s, field)?.name}
            </div>
            <div className="text-base font-semibold">{field.name}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-stone-400 hover:bg-stone-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <PriorityBadge level={st.level} score={st.score} />
            {st.task && <StatusBadge status={st.task.status} />}
            <Badge>{field.growthStage}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-stone-600">
            <span className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> {field.areaHa} ha
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Inspected {relativeTime(field.lastInspectionAt)}
            </span>
          </div>
          {anomalies.length > 0 ? (
            anomalies.map((a) => (
              <div key={a.id} className="rounded-lg border border-stone-200 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold">{ANOMALY_TYPE_LABEL[a.type]}</span>
                  {a.source === "simulated_index" && <ProvenanceTag kind="simulated" />}
                </div>
                <p className="text-xs text-stone-600">{a.observed}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-500">No open signals for this field.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" href={`/fields/${field.id}`}>
              Field details <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            {st.task && (
              <Button size="sm" variant="secondary" href={`/inspections/${st.task.id}`}>
                Open inspection
              </Button>
            )}
          </div>
          <div className="text-[11px] text-stone-400">
            <Link href={`/reports/new?field=${field.id}`} className="hover:underline">
              + Report observation for this field
            </Link>
          </div>
        </div>
      </Card>
    );
  }
}
