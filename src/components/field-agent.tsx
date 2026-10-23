"use client";

import { useEffect, useState } from "react";
import { Bot, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import type { AppState } from "@/lib/types";
import { buildAgentContext } from "@/lib/agent/context";
import { runDemoAgent } from "@/lib/agent/demo-agent";
import { AGENT_MODES, type AgentMode, type AgentResponse } from "@/lib/agent/types";
import { cn } from "@/lib/format";
import { Badge, Card, CardHeader, ProvenanceTag } from "./ui";

/**
 * The Field Agent is embedded in field and inspection pages and always works on
 * the currently selected field's records. It calls /api/agent (LLM if configured,
 * deterministic demo otherwise) and falls back to the local demo agent offline.
 */
export function FieldAgent({
  state,
  fieldId,
  inspectionId,
  defaultMode = "why_attention",
  modes,
}: {
  state: AppState;
  fieldId: string;
  inspectionId?: string;
  defaultMode?: AgentMode;
  modes?: AgentMode[];
}) {
  const [mode, setMode] = useState<AgentMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<(AgentResponse & { warning?: string; offline?: boolean }) | null>(null);
  const available = AGENT_MODES.filter((m) => !modes || modes.includes(m.id));

  // Reset when switching fields.
  useEffect(() => {
    setResult(null);
    setMode(null);
  }, [fieldId, inspectionId]);

  async function run(m: AgentMode) {
    const context = buildAgentContext(state, fieldId, inspectionId);
    if (!context) return;
    setMode(m);
    setLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: m, context }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult((await res.json()) as AgentResponse);
    } catch {
      setResult({ ...runDemoAgent(m, context), offline: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={Bot}
        title="Field Agent"
        description="Works only with this field's records. Cannot see photos or imagery."
        action={
          result ? (
            result.mode === "llm" ? (
              <Badge tone="violet">
                <Sparkles className="h-3 w-3" /> LLM
              </Badge>
            ) : (
              <Badge tone="amber">Demo mode</Badge>
            )
          ) : undefined
        }
      />
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          {available.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={loading}
              onClick={() => run(m.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                mode === m.id
                  ? "border-brand-600 bg-brand-600 text-white"
                  : m.id === defaultMode && !mode
                    ? "border-brand-300 bg-brand-50 text-brand-800 hover:bg-brand-100"
                    : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Reading field records…
          </div>
        )}

        {!loading && !result && (
          <p className="mt-4 text-xs text-stone-500">Choose a task above. The agent summarizes records and separates facts from hypotheses.</p>
        )}

        {!loading && result && (
          <div className="mt-4 space-y-4" aria-live="polite">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-stone-900">{result.title}</h3>
              <button
                type="button"
                onClick={() => mode && run(mode)}
                className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                aria-label="Run again"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
            {result.mode === "demo" && (
              <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                Demo mode: deterministic summary generated from the field records{result.offline ? " (offline fallback)" : ""}. Add an API key
                to use a language model.
              </p>
            )}
            {result.warning && <p className="text-[11px] text-red-700">LLM error: {result.warning}</p>}
            {result.sections.map((s, i) => (
              <div key={i}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <ProvenanceTag kind={s.kind} />
                  <span className="text-xs font-medium text-stone-700">{s.heading}</span>
                </div>
                <ul className="space-y-1 pl-1">
                  {s.items.map((item, j) => (
                    <li key={j} className="flex gap-2 text-sm text-stone-700">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-500">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
