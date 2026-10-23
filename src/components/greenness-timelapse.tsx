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

const WEEK_MS = 800; // playback time per week

/** Map time-lapse: every field colored by its greenness, week by week. */
export function GreennessTimelapse({ state, onSelect, className }: { state: AppState; onSelect?: (id: string) => void; className?: string }) {
  const { weeks, byField } = useMemo(() => greennessTimeline(state), [state]);
  // Position in weeks. Fractional while playing, so the slider glides and colors blend between weeks.
  const [pos, setPos] = useState(weeks.length - 1);
  const [playing, setPlaying] = useState(false);
  const last = weeks.length - 1;
  const week = Math.round(pos);

  useEffect(() => setPos(weeks.length - 1), [weeks.length]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const step = (now - prev) / WEEK_MS;
      prev = now;
      setPos((p) => {
        if (p + step >= last) setPlaying(false);
        return Math.min(p + step, last);
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, last]);

  // Scale to this dataset (real NDVI on small plots is much lower than showcase values):
  // lo = lowest value in the latest week (worst field now), hi = highest value of the season.
  const [lo, hi] = useMemo(() => {
    const all = Object.values(byField).flatMap((v) => v.map((x) => x.value)).filter((x): x is number => x !== null);
    const latest = Object.values(byField).map((v) => v[v.length - 1]?.value).filter((x): x is number => x != null);
    return all.length && latest.length ? [Math.min(...latest), Math.max(...all)] : [0.2, 0.75];
  }, [byField]);
  const colorFor = useCallback(
    (id: string) => {
      // Blend the two weeks around pos; if one is missing (clouds), use the other.
      const a = byField[id]?.[Math.floor(pos)]?.value ?? null;
      const b = byField[id]?.[Math.ceil(pos)]?.value ?? null;
      const t = pos - Math.floor(pos);
      return greenColor(a === null ? b : b === null ? a : a + (b - a) * t, lo, hi);
    },
    [byField, pos, lo, hi],
  );
  const anySimulated = Object.values(byField).some((v) => v[week]?.simulated);

  if (weeks.length === 0) return <p className="text-sm text-stone-500">No greenness data yet.</p>;

  function play() {
    if (pos >= last) setPos(0);
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
          max={last}
          step="any"
          value={pos}
          onChange={(e) => {
            setPlaying(false);
            setPos(Number(e.target.value));
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
