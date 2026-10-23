"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardCheck, Eye, FileText, Plus } from "lucide-react";
import { useAppState } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABEL, OUTCOME_LABEL, SOURCE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/format";
import { Badge, Button, Card, EmptyState, PageHeader, PageLoading, ProvenanceTag } from "@/components/ui";

type Tab = "reports" | "observations";

export default function ReportsPage() {
  const state = useAppState();
  const [tab, setTab] = useState<Tab>("reports");
  if (!state) return <PageLoading />;

  const fieldName = (id: string) => state.fields.find((f) => f.id === id)?.name ?? id;
  const reports = [...state.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const observations = [...state.observations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <PageHeader
        title="Field Reports"
        description="Inspection reports with confirmed findings, and ground observations from farmers and advisers."
        actions={
          <Button href="/reports/new" icon={Plus}>
            Report observation
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-stone-200/60 p-1 sm:inline-flex">
        {(
          [
            { id: "reports", label: `Inspection reports (${reports.length})`, icon: ClipboardCheck },
            { id: "observations", label: `Observations (${observations.length})`, icon: Eye },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
              tab === t.id ? "bg-white shadow-sm" : "text-stone-600",
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "reports" ? (
        <Card>
          {reports.length === 0 ? (
            <EmptyState icon={FileText} title="No inspection reports yet" description="Reports are created when an inspection is completed." />
          ) : (
            <ul className="divide-y divide-stone-100">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link href={`/inspections/${r.inspectionId}`} className="block px-4 py-4 hover:bg-stone-50 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{fieldName(r.fieldId)}</span>
                      <Badge tone={r.outcome === "issue_confirmed" ? "red" : r.outcome === "no_issue_found" ? "green" : "amber"}>
                        {OUTCOME_LABEL[r.outcome]}
                      </Badge>
                      <span className="text-xs text-stone-500">
                        {r.id} · {r.author} · {formatDateTime(r.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-stone-800">
                      <ProvenanceTag kind="confirmed" className="mr-1.5" />
                      {r.confirmedFindings}
                    </p>
                    {r.recommendation && <p className="mt-1 text-xs text-stone-600">Recommendation: {r.recommendation}</p>}
                    {r.photos.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {r.photos.slice(0, 4).map((p, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={p} alt="" className="h-12 w-12 rounded object-cover" />
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card>
          {observations.length === 0 ? (
            <EmptyState icon={Eye} title="No observations yet" action={<Button href="/reports/new">Report observation</Button>} />
          ) : (
            <ul className="divide-y divide-stone-100">
              {observations.map((o) => (
                <li key={o.id}>
                  <Link href={o.inspectionId ? `/inspections/${o.inspectionId}` : `/fields/${o.fieldId}`} className="flex gap-3 px-4 py-4 hover:bg-stone-50 sm:px-5">
                    {o.photoDataUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.photoDataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{fieldName(o.fieldId)}</span>
                        <Badge>{CATEGORY_LABEL[o.category]}</Badge>
                        <Badge tone="stone">{SOURCE_LABEL[o.source]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-stone-800">{o.description}</p>
                      {o.voiceTranscript && <p className="mt-0.5 text-xs italic text-stone-500">Voice: “{o.voiceTranscript}”</p>}
                      <div className="mt-1 text-xs text-stone-500">
                        {o.author} · {formatDateTime(o.createdAt)}
                        {o.inspectionId && ` · linked to ${o.inspectionId}`}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
