"use client";

import Link from "next/link";
import { ArrowRight, ListOrdered } from "lucide-react";
import { lastQueueChange } from "@/lib/selectors";
import type { AppState } from "@/lib/types";

export function QueueShiftBanner({ state }: { state: AppState }) {
  const change = lastQueueChange(state);
  if (!change) return null;
  const next = change.moves.find((move) => move.toRank === 1);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <ListOrdered className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Queue updated</div>
            <p className="mt-0.5 text-sm text-amber-950">{change.headline}</p>
          </div>
        </div>
        {next && (
          <Link
            href={`/inspections/${next.inspectionId}/visit`}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-amber-950 hover:underline"
          >
            Open next visit <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {change.moves.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-950">
          {change.moves
            .filter((move) => move.movement !== "same")
            .slice(0, 4)
            .map((move) => (
              <li key={move.inspectionId}>
                {move.fieldName}: {move.movement === "resolved" ? "left the queue" : move.movement === "new" ? `entered at #${move.toRank}` : `#${move.fromRank} → #${move.toRank}`}
                {move.toRank ? ` · score ${move.score}` : ""}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
