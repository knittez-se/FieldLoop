"use client";

import { useEffect, useState } from "react";
import { CloudRain, Thermometer } from "lucide-react";
import type { Farm, WeatherObservation } from "@/lib/types";
import { Badge, Card, CardHeader } from "./ui";

type LiveResult = { source: "open_meteo"; series: WeatherObservation[] } | { source: "unavailable"; error: string };
const cache = new Map<string, Promise<LiveResult>>();

function loadLive(farm: Farm): Promise<LiveResult> {
  const key = farm.id;
  if (!cache.has(key)) {
    const p = fetch(`/api/weather?lat=${farm.location[0]}&lng=${farm.location[1]}`)
      .then((r) => r.json() as Promise<LiveResult>)
      .catch(() => ({ source: "unavailable", error: "Network error" }) as LiveResult);
    cache.set(key, p);
  }
  return cache.get(key)!;
}

export function WeatherCard({ farm, sample, live }: { farm: Farm | undefined; sample: WeatherObservation[]; live: boolean }) {
  const [liveSeries, setLiveSeries] = useState<WeatherObservation[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "live" | "fallback">("idle");

  useEffect(() => {
    if (!live || !farm) {
      setStatus("idle");
      setLiveSeries(null);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    loadLive(farm).then((res) => {
      if (cancelled) return;
      if (res.source === "open_meteo" && res.series.length) {
        setLiveSeries(res.series);
        setStatus("live");
      } else {
        setStatus("fallback");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [farm, live]);

  const series = (liveSeries ?? sample).slice(-14);
  const isLive = Boolean(liveSeries);
  const rain7 = series.slice(-7).reduce((s, w) => s + w.precipitationMm, 0);
  let dry = 0;
  for (let i = series.length - 1; i >= 0 && series[i].precipitationMm < 1; i--) dry++;
  const maxRain = Math.max(5, ...series.map((w) => w.precipitationMm));
  const lastTemp = series[series.length - 1];

  return (
    <Card>
      <CardHeader
        icon={CloudRain}
        title="Weather"
        description="Last 14 days at the farm"
        action={
          status === "loading" ? (
            <Badge>Loading live data…</Badge>
          ) : isLive ? (
            <Badge tone="blue">Live · Open-Meteo</Badge>
          ) : (
            <Badge tone="amber">{status === "fallback" ? "Sample (live n/a)" : "Sample data"}</Badge>
          )
        }
      />
      <div className="p-4 sm:p-5">
        {series.length === 0 ? (
          <div className="text-xs text-stone-500">No weather data available.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-semibold tabular-nums">{rain7.toFixed(1)} mm</div>
                <div className="text-[11px] text-stone-500">Rain, last 7 days</div>
              </div>
              <div>
                <div className="text-lg font-semibold tabular-nums">{dry}</div>
                <div className="text-[11px] text-stone-500">Dry days in a row</div>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums">
                  <Thermometer className="h-4 w-4 text-stone-400" />
                  {lastTemp ? `${Math.round(lastTemp.tempMaxC)}°` : "—"}
                </div>
                <div className="text-[11px] text-stone-500">Latest max temp</div>
              </div>
            </div>
            <div className="mt-4 flex h-16 items-end gap-1" aria-label="Daily precipitation">
              {series.map((w) => (
                <div key={w.date} className="flex flex-1 flex-col items-center justify-end" title={`${w.date}: ${w.precipitationMm} mm`}>
                  <div
                    className="w-full rounded-t bg-sky-400/80"
                    style={{ height: `${Math.max(2, (w.precipitationMm / maxRain) * 56)}px`, opacity: w.precipitationMm < 1 ? 0.25 : 1 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-stone-400">
              <span>{series[0] && new Date(series[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              <span>today</span>
            </div>
            {dry >= 5 && (
              <p className="mt-3 text-xs text-stone-600">
                {dry} days without meaningful rain. This is context, not evidence of a specific cause.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
