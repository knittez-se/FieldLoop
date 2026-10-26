/**
 * Server-only LLM integration for the Field Agent (Anthropic Messages API via fetch).
 * Only used when ANTHROPIC_API_KEY is set. The key never reaches the browser.
 */
import { HYPOTHESIS_LABEL, REPORT_DISCLAIMER, type Hypothesis, type ReportAnalysis, type ReportInput } from "./report";
import { AGENT_MODES, DISCLAIMER, type AgentContext, type AgentMode, type AgentResponse, type AgentSection } from "./types";

const SYSTEM_PROMPT = `You are the FieldLoop Field Agent, assisting agricultural field advisers who monitor smallholder crop fields (mostly maize).
Rules:
- Use ONLY the JSON context provided. Do not invent measurements, dates or findings.
- You cannot see photos or satellite images. If a photo is attached, say it was not analyzed.
- Values with source "simulated_index" are simulated demo data, not satellite measurements — say so if you mention them.
- Never diagnose a crop disease or pest from remote signals. Present causes as hypotheses that need field verification.
- Clearly separate: observed (records), confirmed (adviser reports/notes), interpretation (your reasoning), hypothesis (unverified explanations), action (next steps), question.
- Be concise and practical. Max ~6 items per section, each one sentence.
- Respond with JSON only, no prose, matching:
{"title": string, "sections": [{"kind": "observed"|"confirmed"|"interpretation"|"hypothesis"|"action"|"question", "heading": string, "items": string[]}]}`;

export function llmConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function llmModel() {
  return process.env.AGENT_MODEL || "claude-sonnet-5-5";
}

const KINDS = new Set(["observed", "confirmed", "interpretation", "hypothesis", "action", "question"]);

export async function runLlmAgent(mode: AgentMode, ctx: AgentContext): Promise<AgentResponse> {
  const task = AGENT_MODES.find((m) => m.id === mode)?.label ?? mode;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: llmModel(),
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Task: ${task}\n\nContext JSON:\n${JSON.stringify(ctx)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
  return { ...parseResponse(text), mode: "llm", disclaimer: DISCLAIMER, model: llmModel() };
}

function parseResponse(text: string): { title: string; sections: AgentSection[] } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { title?: unknown; sections?: unknown };
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
          .filter((s): s is AgentSection =>
            typeof s === "object" && s !== null && KINDS.has((s as AgentSection).kind) && Array.isArray((s as AgentSection).items),
          )
          .map((s) => ({ kind: s.kind, heading: String(s.heading ?? ""), items: s.items.map(String) }))
      : [];
    if (sections.length) return { title: String(parsed.title ?? "Field Agent"), sections };
  } catch {
    // fall through
  }
  return { title: "Field Agent", sections: [{ kind: "interpretation", heading: "Response", items: [text.trim()] }] };
}

// ---------------------------------------------------------------------------
// Report analysis ("the AI reads the report")


const REPORT_SYSTEM_PROMPT = `You help a crop field adviser turn their own visit notes into a structured inspection report.
Rules:
- Use ONLY the adviser's notes, checks and draft findings in the JSON. Never add facts, numbers or observations they did not write.
- You cannot see photos. Never claim to have analyzed one.
- Do not diagnose a disease or pest species. Say which hypotheses the notes SUPPORT or RULE OUT, quoting the adviser's sentence as evidence.
- Remote greenness data (source "simulated_index" = simulated demo data) is context, not evidence of a cause.
- suggestedOutcome: "issue_confirmed" only if the notes describe a visible problem; "no_issue_found" if they say plants look normal or the cause is weeds;
  otherwise "needs_follow_up" (also when notes are too short or say the cause is unclear).
- findingsSummary: 1-3 sentences, only restating the adviser's own observations.
- Respond with JSON only:
{"suggestedOutcome": "issue_confirmed"|"no_issue_found"|"needs_follow_up", "outcomeReason": string, "findingsSummary": string,
 "supported": [{"hypothesis": "water_stress"|"pests"|"nutrients"|"waterlogging"|"weeds"|"disease", "evidence": string}],
 "ruledOut": [{"hypothesis": same values, "evidence": string}], "openQuestions": string[], "followUp": {"action": string, "inDays": number|null}}`;

const OUTCOMES = new Set(["issue_confirmed", "no_issue_found", "needs_follow_up"]);

export async function runLlmReport(input: ReportInput): Promise<ReportAnalysis> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: llmModel(),
      max_tokens: 900,
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Inspection data JSON:\n${JSON.stringify(input)}` }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
  const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;

  const hyp = (list: unknown) =>
    (Array.isArray(list) ? list : [])
      .filter((x): x is { hypothesis: Hypothesis; evidence: string } => typeof x === "object" && x !== null && (x as { hypothesis: string }).hypothesis in HYPOTHESIS_LABEL)
      .map((x) => ({ hypothesis: x.hypothesis, label: HYPOTHESIS_LABEL[x.hypothesis], evidence: String(x.evidence ?? "") }));
  const outcome = String(raw.suggestedOutcome);
  if (!OUTCOMES.has(outcome)) throw new Error("LLM returned an invalid outcome");
  const followUp = (raw.followUp ?? {}) as { action?: unknown; inDays?: unknown };
  return {
    mode: "llm",
    model: llmModel(),
    suggestedOutcome: outcome as ReportAnalysis["suggestedOutcome"],
    outcomeReason: String(raw.outcomeReason ?? ""),
    findingsSummary: String(raw.findingsSummary ?? ""),
    supported: hyp(raw.supported),
    ruledOut: hyp(raw.ruledOut),
    openQuestions: (Array.isArray(raw.openQuestions) ? raw.openQuestions : []).map(String).slice(0, 5),
    followUp: {
      action: String(followUp.action ?? "Re-check in one week."),
      inDays: typeof followUp.inDays === "number" ? followUp.inDays : null,
    },
    disclaimer: REPORT_DISCLAIMER,
  };
}
