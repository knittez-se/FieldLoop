"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { greennessTimeline } from "@/lib/selectors";
import type { AppState } from "@/lib/types";
import { FieldMap } from "./field-map";
import { Button } from "./ui";

/** Brown (low) → green (high) within [lo, hi]. */
function greenColor(v: number | null, lo: number, hi: number): string {
  if (v === null) return "#a8a29e";
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo || 1)));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(166, 34)}, ${mix(110, 139)}, ${mix(46, 61)})`;
}

/** Map time-lapse: every field colored by its greenness, week by week. */
export function GreennessTimelapse({ state, onSelect, className }: { state: AppState; onSelect?: (id: string) => void; className?: string }) {
  const { weeks, byField } = useMemo(() => greennessTimeline(state), [state]);
  const [week, setWeek] = useState(weeks.length - 1);
  const [playing, setPlaying] = useState(false);

  useEffect(() => setWeek(weeks.length - 1), [weeks.length]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setWeek((w) => {
        if (w >= weeks.length - 1) {
          setPlaying(false);
          return w;
        }
        return w + 1;
      });
    }, 800);
    return () => clearInterval(t);
  }, [playing, weeks.length]);

  // Scale to this dataset (real NDVI on small plots is much lower than showcase values):
  // lo = lowest value in the latest week (worst field now), hi = highest value of the season.
  const [lo, hi] = useMemo(() => {
    const all = Object.values(byField).flatMap((v) => v.map((x) => x.value)).filter((x): x is number => x !== null);
    const latest = Object.values(byField).map((v) => v[v.length - 1]?.value).filter((x): x is number => x != null);
    return all.length && latest.length ? [Math.min(...latest), Math.max(...all)] : [0.2, 0.75];
  }, [byField]);
  const colorFor = useCallback((id: string) => greenColor(byField[id]?.[week]?.value ?? null, lo, hi), [byField, week, lo, hi]);
  const anySimulated = Object.values(byField).some((v) => v[week]?.simulated);

  if (weeks.length === 0) return <p className="text-sm text-stone-500">No greenness data yet.</p>;

  function play() {
    if (week >= weeks.length - 1) setWeek(0);
    setPlaying(true);
  }

  return (
    <div>
      <FieldMap fields={state.fields} status={{}} anomalies={[]} colorFor={colorFor} onSelect={onSelect} className={className} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" icon={playing ? Pause : Play} onClick={() => (playing ? setPlaying(false) : play())}>
          {playing ? "Pause" : "Play time-lapse"}
        </Button>
        <input
          id="timelapse-week"
          type="range"
          min={0}
          max={weeks.length - 1}
          value={week}
          onChange={(e) => {
            setPlaying(false);
            setWeek(Number(e.target.value));
          }}
          className="min-w-40 flex-1 accent-brand-600"
          aria-label="Week"
        />
        <span className="w-28 text-right text-xs tabular-nums text-stone-700">
          Week of {new Date(weeks[week]).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          Low
          <span className="h-2 w-24 rounded" style={{ background: `linear-gradient(to right, ${greenColor(lo, lo, hi)}, ${greenColor(hi, lo, hi)})` }} />
          High greenness (NDVI {lo.toFixed(2)}–{hi.toFixed(2)})
        </span>
        {anySimulated && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">Includes simulated readings</span>}
      </div>
    </div>
  );
}
