"use client";

import Link from "next/link";
import { ArrowRight, ListOrdered } from "lucide-react";
import { latestQueueShift } from "@/lib/ui-queue";
import type { AppState } from "@/lib/types";

export function QueueShiftBanner({ state }: { state: AppState }) {
  const shift = latestQueueShift(state);
  if (!shift) return null;

  let sentence: string;
  if (shift.followUpTaskId && shift.stillRank) {
    sentence = `${shift.completedFieldName} still needs a visit. It is now #${shift.stillRank} in the queue.`;
  } else if (shift.nowFirst && shift.nowFirst.fieldId !== shift.completedFieldId) {
    sentence = `${shift.completedFieldName} left the queue. ${shift.nowFirst.fieldName} is now first, score ${shift.nowFirst.score}.`;
  } else if (!shift.nowFirst) {
    sentence = `${shift.completedFieldName} left the queue. No open visits remain.`;
  } else {
    sentence = `${shift.completedFieldName} was updated. It is still first in the queue.`;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
      <div className="flex min-w-0 gap-3">
        <ListOrdered className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Queue updated</div>
          <p className="mt-0.5 text-sm text-amber-950">{sentence}</p>
        </div>
      </div>
      {shift.nowFirst && (
        <Link
          href={`/inspections/${shift.followUpTaskId && shift.stillRank === 1 ? shift.followUpTaskId : shift.nowFirst.taskId}/visit`}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-950 hover:underline"
        >
          Open next visit <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
