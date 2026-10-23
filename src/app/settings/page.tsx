"use client";

import { useEffect, useState } from "react";
import { Bot, CloudRain, Database, RefreshCw, RotateCcw, Satellite, UserRound } from "lucide-react";
import { resetDemoData, resetOnboarding, setDataMode, syncFieldData, updateSettings, useAppState } from "@/lib/store";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Card, CardHeader, PageHeader, PageLoading } from "@/components/ui";

export default function SettingsPage() {
  const state = useAppState();
  const [agent, setAgent] = useState<{ configured: boolean; model: string | null } | "error" | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then(setAgent)
      .catch(() => setAgent("error"));
  }, []);

  if (!state) return <PageLoading />;
  const storageKb = Math.round(new Blob([JSON.stringify(state)]).size / 1024);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Demo configuration, data sources and integrations." />

      <Card>
        <CardHeader icon={UserRound} title="Current user" description="Prototype only — there is no login. Pick who you are acting as." />
        <div className="p-4 sm:p-5">
          <select
            value={state.settings.currentUserId}
            onChange={(e) => updateSettings({ currentUserId: e.target.value })}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm sm:w-80"
            aria-label="Current user"
          >
            {state.advisers.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.role.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        <CardHeader icon={Bot} title="AI Field Agent" />
        <div className="space-y-2 p-4 text-sm sm:p-5">
          {agent === null ? (
            <Badge>Checking…</Badge>
          ) : agent === "error" ? (
            <Badge tone="amber">API not reachable — local demo mode</Badge>
          ) : agent.configured ? (
            <Badge tone="violet">LLM configured · {agent.model}</Badge>
          ) : (
            <Badge tone="amber">Demo mode (no API key)</Badge>
          )}
          <p className="text-stone-600">
            Without an API key the agent produces deterministic summaries from the field records. To use a language model, add{" "}
            <code className="rounded bg-stone-100 px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-stone-100 px-1">.env.local</code> and
            restart the dev server. The key stays on the server.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader icon={CloudRain} title="Weather" />
        <div className="space-y-2 p-4 text-sm sm:p-5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={state.settings.liveWeather}
              onChange={(e) => updateSettings({ liveWeather: e.target.checked })}
              className="h-4 w-4 accent-brand-600"
            />
            Load live weather from Open-Meteo (free, no key)
          </label>
          <p className="text-stone-600">If the request fails, the app shows clearly labeled sample weather instead.</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={Satellite}
          title="Field data"
          description="data/field_scores.csv, data/fields.geojson and data/weather.csv (see MVP.md)"
          action={
            <Badge tone={state.data.origin === "data_files" ? "green" : "amber"}>
              {state.data.origin === "data_files" ? "From data/ files" : "Built-in sample"}
            </Badge>
          }
        />
        <div className="space-y-3 p-4 text-sm sm:p-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Data source">
            {(
              [
                ["showcase", "Showcase data (simulated)"],
                ["real", "Real data (Kitale)"],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                size="sm"
                variant={(state.settings.dataMode ?? "showcase") === mode ? "primary" : "secondary"}
                aria-pressed={(state.settings.dataMode ?? "showcase") === mode}
                onClick={() => setDataMode(mode)}
              >
                {label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => resetOnboarding()}>
              Retake setup quiz
            </Button>
          </div>
          <ul className="space-y-1 text-stone-700">
            <li>
              {state.fields.length} fields · {state.data.payload.fields.reduce((n, f) => n + f.readings.length, 0)} greenness readings ·{" "}
              {state.weather.length} days of rainfall
            </li>
            <li>
              Greenness:{" "}
              {(() => {
                const all = state.data.payload.fields.flatMap((f) => f.readings);
                const real = all.filter((r) => r.source === "real").length;
                return real === 0 ? (
                  <Badge tone="amber">all simulated</Badge>
                ) : real === all.length ? (
                  <Badge tone="green">all real (Sentinel-2)</Badge>
                ) : (
                  <Badge tone="amber">
                    {real} real / {all.length - real} simulated
                  </Badge>
                );
              })()}
            </li>
            <li className="text-xs text-stone-500">
              Anomalies are created by transparent rules in src/lib/detection.ts (own history + comparison with the other fields).
            </li>
          </ul>
          {state.data.warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              {state.data.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          {syncMsg && <p className="text-xs text-stone-700">{syncMsg}</p>}
          <Button
            variant="secondary"
            icon={RefreshCw}
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              const r = await syncFieldData(true);
              setSyncMsg(r.message ?? "Data unchanged — nothing to reload.");
              setSyncing(false);
            }}
          >
            {syncing ? "Checking…" : "Reload data files"}
          </Button>
          <p className="text-xs text-stone-500">If the data changed, the demo is rebuilt from it and recorded changes are reset.</p>
        </div>
      </Card>

      <Card id="reset-demo">
        <CardHeader icon={Database} title="Storage & demo data" />
        <div className="space-y-3 p-4 text-sm sm:p-5">
          <p className="text-stone-600">
            Data is stored in this browser&apos;s localStorage (~{storageKb} KB used of ~5 MB). It is not shared between devices or team
            members. Demo data seeded {formatDateTime(state.seededAt)}.
          </p>
          {resetDone && <p className="text-brand-700">Demo data has been reset.</p>}
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <span className="text-red-800">Delete all changes and restore the demo scenario?</span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  resetDemoData();
                  setConfirmReset(false);
                  setResetDone(true);
                }}
              >
                Yes, reset
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="secondary" icon={RotateCcw} onClick={() => { setConfirmReset(true); setResetDone(false); }}>
              Reset demo data
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
