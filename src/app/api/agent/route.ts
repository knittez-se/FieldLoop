import { runDemoAgent } from "@/lib/agent/demo-agent";
import { llmConfigured, llmModel, runLlmAgent } from "@/lib/agent/llm";
import { AGENT_MODES, type AgentContext, type AgentMode } from "@/lib/agent/types";

export const dynamic = "force-dynamic";

/** GET /api/agent → whether a real LLM is configured. */
export async function GET() {
  return Response.json({ configured: llmConfigured(), model: llmConfigured() ? llmModel() : null });
}

/** POST /api/agent { mode, context } → AgentResponse */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { mode, context } = (body ?? {}) as { mode?: unknown; context?: unknown };
  if (typeof mode !== "string" || !AGENT_MODES.some((m) => m.id === mode)) {
    return Response.json({ error: "Unknown mode" }, { status: 400 });
  }
  if (!isContext(context)) {
    return Response.json({ error: "Invalid context" }, { status: 400 });
  }

  if (llmConfigured()) {
    try {
      return Response.json(await runLlmAgent(mode as AgentMode, context));
    } catch (err) {
      const fallback = runDemoAgent(mode as AgentMode, context);
      return Response.json({
        ...fallback,
        title: `${fallback.title} (LLM unavailable – demo fallback)`,
        warning: err instanceof Error ? err.message : "LLM request failed",
      });
    }
  }
  return Response.json(runDemoAgent(mode as AgentMode, context));
}

function isContext(v: unknown): v is AgentContext {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Partial<AgentContext>;
  return (
    typeof c.field === "object" &&
    c.field !== null &&
    typeof c.field.id === "string" &&
    Array.isArray(c.anomalies) &&
    Array.isArray(c.observations) &&
    Array.isArray(c.reports) &&
    JSON.stringify(v).length < 100_000
  );
}
