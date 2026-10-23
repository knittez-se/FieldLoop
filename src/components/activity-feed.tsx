import Link from "next/link";
import { Activity, CircleCheck, ClipboardList, Eye, MessageSquare, Play, TriangleAlert, UserRound } from "lucide-react";
import type { ActivityEvent, ActivityType, Field } from "@/lib/types";
import { relativeTime } from "@/lib/format";
import { EmptyState } from "./ui";

const ICONS: Record<ActivityType, { icon: typeof Activity; cls: string }> = {
  anomaly_flagged: { icon: TriangleAlert, cls: "bg-amber-50 text-amber-600" },
  observation_added: { icon: Eye, cls: "bg-stone-100 text-stone-600" },
  inspection_created: { icon: ClipboardList, cls: "bg-stone-100 text-stone-600" },
  inspection_started: { icon: Play, cls: "bg-blue-50 text-blue-600" },
  inspection_note: { icon: MessageSquare, cls: "bg-stone-100 text-stone-600" },
  inspection_completed: { icon: CircleCheck, cls: "bg-brand-50 text-brand-600" },
  assignment_changed: { icon: UserRound, cls: "bg-stone-100 text-stone-600" },
};

export function ActivityFeed({
  events,
  fields,
  showField = true,
  limit = 8,
}: {
  events: ActivityEvent[];
  fields: Field[];
  showField?: boolean;
  limit?: number;
}) {
  const list = [...events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  if (list.length === 0) {
    return <EmptyState icon={Activity} title="No activity yet" description="Observations and inspection updates will appear here." />;
  }
  return (
    <ol className="divide-y divide-stone-100">
      {list.map((e) => {
        const { icon: Icon, cls } = ICONS[e.type];
        const field = fields.find((f) => f.id === e.fieldId);
        const href = e.inspectionId ? `/inspections/${e.inspectionId}` : `/fields/${e.fieldId}`;
        return (
          <li key={e.id}>
            <Link href={href} className="flex gap-3 px-4 py-3 hover:bg-stone-50 sm:px-5">
              <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-full p-1.5 ${cls}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-stone-800">{e.message}</div>
                <div className="mt-0.5 text-xs text-stone-500">
                  {showField && field && <span className="font-medium text-stone-600">{field.name} · </span>}
                  {e.actor} · {relativeTime(e.at)}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
