import { llmConfigured, runLlmReport } from "@/lib/agent/llm";
import { analyzeReportDemo, isReportInput } from "@/lib/agent/report";

export const dynamic = "force-dynamic";

/** POST /api/process-report  body: ReportInput → ReportAnalysis (LLM if configured, else demo rules). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isReportInput(body)) return Response.json({ error: "Invalid report input" }, { status: 400 });

  if (llmConfigured()) {
    try {
      return Response.json(await runLlmReport(body));
    } catch (err) {
      return Response.json({
        ...analyzeReportDemo(body),
        warning: `LLM unavailable — demo rules used (${err instanceof Error ? err.message : "error"}).`,
      });
    }
  }
  return Response.json(analyzeReportDemo(body));
}
