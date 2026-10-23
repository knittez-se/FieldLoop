"use client";

import Link from "next/link";
import { fieldTimeline, type TimelineTone } from "@/lib/ui-history";
import type { AppState } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/format";

const DOT: Record<TimelineTone, string> = {
  signal: "bg-amber-500",
  visit: "bg-brand-600",
  note: "bg-stone-400",
  confirmed: "bg-brand-800",
  neutral: "bg-sky-600",
};

export function CaseTimeline({ state, fieldId }: { state: AppState; fieldId: string }) {
  const items = fieldTimeline(state, fieldId);
  if (items.length === 0) {
    return <p className="px-4 py-6 text-sm text-stone-500 sm:px-5">No case history for this field yet.</p>;
  }

  return (
    <ol className="px-4 py-4 sm:px-5">
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {index < items.length - 1 && <span className="absolute bottom-0 left-[7px] top-4 w-px bg-stone-200" aria-hidden />}
          <span className={cn("relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-white shadow", DOT[item.tone])} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              {item.href ? (
                <Link href={item.href} className="text-sm font-medium text-stone-900 hover:underline">
                  {item.title}
                </Link>
              ) : (
                <span className="text-sm font-medium text-stone-900">{item.title}</span>
              )}
              <time className="text-[11px] text-stone-500" dateTime={item.at}>
                {formatDateTime(item.at)}
              </time>
            </div>
            {item.detail && <p className="mt-0.5 text-sm text-stone-700">{item.detail}</p>}
            {item.meta && <p className="mt-0.5 text-[11px] text-stone-500">{item.meta}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
