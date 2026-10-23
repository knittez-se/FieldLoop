"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus, RotateCcw, Sprout } from "lucide-react";
import { impactSummary, weeklyCapacity } from "@/lib/selectors";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/format";

/** Dark green cooperative banner at the top of every page (on phones only on Today). */
export function CoopBanner({ state, className, isPageTitle }: { state: AppState; className?: string; isPageTitle?: boolean }) {
  const Title = isPageTitle ? "h1" : "div"; // other pages have their own h1
  const impact = impactSummary(state);
  const advisers = weeklyCapacity(state).advisers;
  const farms = new Set(state.fields.map((f) => f.farmId)).size;
  const crops = [...new Set(state.fields.map((f) => f.crop))].map((c) => c[0].toUpperCase() + c.slice(1));
  const real = state.settings.dataMode === "real";

  return (
    <section
      aria-label="Cooperative"
      className={cn(
        "fs-grain relative flex-col gap-5 overflow-hidden sm:flex-row sm:items-center rounded-[22px] text-white",
        isPageTitle ? "p-5 sm:p-7" : "px-5 py-4 sm:px-6",
        "bg-[radial-gradient(120%_140%_at_85%_30%,#2e7a3e_0%,rgba(46,122,62,0)_55%),linear-gradient(110deg,#0a2c17_0%,#0e3d21_55%,#12502b_100%)]",
        className,
      )}
    >
      <div className={cn("relative hidden h-24 w-24 shrink-0 place-items-center rounded-2xl border border-white/15 bg-[#0b3019] text-lime", isPageTitle && "sm:grid")}>
        <Sprout className="h-12 w-12" />
      </div>
      <div className="relative min-w-0 flex-1">
        <Title className={cn("font-bold tracking-tight", isPageTitle ? "text-2xl sm:text-[34px] sm:leading-tight" : "text-xl")}>{state.cooperative.name}</Title>
        <div className={cn("flex flex-wrap gap-1.5", isPageTitle ? "mt-2.5" : "mt-1.5")}>
          <Chip>{state.cooperative.region}</Chip>
          {crops.slice(0, 4).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
          <Chip>
            <span className={cn("h-1.5 w-1.5 rounded-full", real ? "bg-lime" : "bg-amber-300")} />
            {real ? "Real satellite data" : "Showcase data (simulated)"}
          </Chip>
        </div>
        <div className={cn("flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/70", isPageTitle ? "mt-3" : "mt-2")}>
          <span><b className="font-semibold text-white tabular-nums">{impact.fieldsMonitored}</b> fields</span>
          <span><b className="font-semibold text-white tabular-nums">{farms}</b> farms</span>
          <span><b className="font-semibold text-white tabular-nums">{impact.hectares}</b> ha</span>
          <span><b className="font-semibold text-white tabular-nums">{advisers}</b> advisers</span>
          <span>Fictional cooperative</span>
        </div>
      </div>
      <div className="relative flex shrink-0 flex-wrap gap-2 sm:self-end">
        <Link
          href="/settings#reset-demo"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/85 hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" /> Reset demo
        </Link>
        <Link
          href="/reports/new"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-lime px-4 text-sm font-semibold text-forest hover:brightness-95"
        >
          <Plus className="h-4 w-4" /> Report observation
        </Link>
      </div>
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-[13px] font-medium">
      {children}
    </span>
  );
}
