/**
 * "The AI reads the report" (MVP step 5).
 *
 * Input: what the adviser recorded during a visit (notes, ticked checks, draft findings).
 * Output: a SUGGESTION — outcome, a findings summary built only from the adviser's own
 * words, which hypotheses the notes support or rule out, open questions and a follow-up.
 * The adviser always confirms or edits it before the inspection is completed.
 *
 * Two modes:
 *  - LLM (server, when ANTHROPIC_API_KEY is set) via POST /api/process-report
 *  - Demo (no key / offline): the keyword rules in `analyzeReportDemo` below
 *
 * UI usage (Area B):
 *   const input = buildReportInput(state, inspectionId, { findingsDraft });
 *   const analysis = await analyzeReport(input);   // never throws, falls back to demo
 *   completeInspection(id, { outcome, confirmedFindings, recommendation,
 *     aiAssist: { mode: analysis.mode, suggestedOutcome: analysis.suggestedOutcome, outcomeAccepted: outcome === analysis.suggestedOutcome } });
 */
import type { AppState, InspectionOutcome } from "../types";
import { CATEGORY_LABEL } from "../labels";

export interface ReportInput {
  inspectionId: string;
  field: { id: string; name: string; growthStage: string };
  /** The signal that triggered the visit (if any). */
  anomaly?: { type: string; severity: string; source: string; observed: string; possibleExplanations: string[] };
  checks: Array<{ label: string; done: boolean }>;
  notes: string[];
  /** Text the adviser already typed into the findings box (optional). */
  findingsDraft?: string;
  photosCount: number;
  groundReports: Array<{ category: string; description: string }>;
}

export type Hypothesis = "water_stress" | "pests" | "nutrients" | "waterlogging" | "weeds" | "disease";

export const HYPOTHESIS_LABEL: Record<Hypothesis, string> = {
  water_stress: "Water stress",
  pests: "Pest damage",
  nutrients: "Nutrient deficiency",
  waterlogging: "Waterlogging",
  weeds: "Weed competition",
  disease: "Possible disease symptoms",
};

export interface ReportAnalysis {
  mode: "demo" | "llm";
  suggestedOutcome: InspectionOutcome;
  /** Why this outcome was suggested, in one sentence. */
  outcomeReason: string;
  /** Proposed text for "Confirmed findings" — only restates what the adviser wrote. */
  findingsSummary: string;
  /** Hypotheses the notes support, with the adviser's words as evidence. */
  supported: Array<{ hypothesis: Hypothesis; label: string; evidence: string }>;
  /** Hypotheses the notes explicitly rule out. */
  ruledOut: Array<{ hypothesis: Hypothesis; label: string; evidence: string }>;
  openQuestions: string[];
  followUp: { action: string; inDays: number | null };
  disclaimer: string;
  model?: string;
  warning?: string;
}

export const REPORT_DISCLAIMER =
  "Suggestion based only on your notes. It cannot see photos and does not diagnose. Check and edit before saving.";

// ---------------------------------------------------------------------------

/** Collects everything the analysis needs for one inspection. */
export function buildReportInput(state: AppState, inspectionId: string, extra?: { findingsDraft?: string }): ReportInput | null {
  const task = state.inspections.find((t) => t.id === inspectionId);
  const field = task && state.fields.find((f) => f.id === task.fieldId);
  if (!task || !field) return null;
  const anomaly = state.anomalies.find((a) => task.anomalyIds.includes(a.id));
  return {
    inspectionId,
    field: { id: field.id, name: field.name, growthStage: field.growthStage },
    anomaly: anomaly
      ? {
          type: anomaly.type,
          severity: anomaly.severity,
          source: anomaly.source,
          observed: anomaly.observed,
          possibleExplanations: anomaly.possibleExplanations,
        }
      : undefined,
    checks: task.suggestedChecks.map((c) => ({ label: c.label, done: c.done })),
    notes: task.notes.map((n) => n.text),
    findingsDraft: extra?.findingsDraft?.trim() || undefined,
    photosCount: task.photos.length,
    groundReports: state.observations
      .filter((o) => o.inspectionId === task.id || task.observationIds.includes(o.id))
      .map((o) => ({ category: CATEGORY_LABEL[o.category], description: o.description })),
  };
}

/** Calls the server (LLM or demo). Falls back to the local demo rules if the request fails. */
export async function analyzeReport(input: ReportInput): Promise<ReportAnalysis> {
  try {
    const res = await fetch("/api/process-report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as ReportAnalysis;
  } catch (err) {
    return { ...analyzeReportDemo(input), warning: `Offline — local demo rules used (${err instanceof Error ? err.message : "error"}).` };
  }
}

// ---------------------------------------------------------------------------
// Demo mode: transparent keyword rules

interface Rule {
  hypothesis: Hypothesis;
  patterns: RegExp[];
  negations: RegExp[];
}

const RULES: Rule[] = [
  {
    hypothesis: "water_stress",
    patterns: [/\b(soil|ground)\s+(is\s+|was\s+|very\s+)*dry\b/, /\bdry\s+(soil|ground)\b/, /\bleaf\s+roll\w*/, /\bleaves?\s+(are\s+|were\s+)?roll\w*/, /\bwilt\w*/, /\bdrought\b/],
    negations: [/\b(soil|ground)\s+(is\s+|was\s+)?(moist|wet)\b/, /\bno\s+(leaf\s+)?rolling\b/],
  },
  {
    hypothesis: "pests",
    patterns: [/\blarva[e]?\b/, /\bcaterpillar\w*/, /\barmyworm\w*/, /\bfrass\b/, /\bsawdust\b/, /\bholes?\s+in\s+(the\s+)?leav\w*/, /\bfeeding\s+damage\b/, /\binsects?\s+(found|seen|present)\b/, /\baphids?\b/, /\bborers?\b/],
    negations: [/\bno\s+(insects?|pests?|larva[e]?|caterpillars?|feeding\s+damage)\b/, /\bnot?\s+(any\s+)?(insects?|pests?)\b/],
  },
  {
    hypothesis: "nutrients",
    patterns: [/\byellow\w*/, /\bchloros\w*/, /\bpale\s+(green|leav\w*)\b/, /\bpurple\s+leav\w*/, /\bv-?shaped\b/],
    negations: [/\bno\s+yellow\w*/, /\bnormal\s+colou?r\b/, /\bhealthy\s+colou?r\b/],
  },
  {
    hypothesis: "waterlogging",
    patterns: [/\bwaterlog\w*/, /\bstanding\s+water\b/, /\bsoil\s+(is\s+|was\s+)?(very\s+)?wet\b/, /\bwetter\b/, /\bponding\b/],
    negations: [/\bno\s+standing\s+water\b/],
  },
  {
    hypothesis: "weeds",
    patterns: [/\bweeds?\b/, /\bcouch\s+grass\b/, /\bstriga\b/],
    negations: [/\bno\s+weeds?\b/],
  },
  {
    hypothesis: "disease",
    patterns: [/\blesions?\b/, /\bspots?\s+on\s+(the\s+)?leav\w*/, /\bstreak\w*/, /\b(stalk|ear|root|stem)\s+rot\b/, /\brotting\b/, /\b(mould|mold)\b/, /\bblight\b/, /\brust\b/],
    negations: [/\bno\s+(lesions?|spots?|disease)\b/],
  },
];

const NO_ISSUE = [/\bno\s+(issue|problem)s?\b/, /\b(looks?|look|plants?\s+(are|look))\s+(healthy|normal|fine)\b/, /\bhealthy\b/, /\bnothing\s+(abnormal|unusual|found)\b/];
const UNCERTAIN = [/\bunclear\b/, /\bnot\s+sure\b/, /\bunsure\b/, /\bmaybe\b/, /\bpossibly\b/, /\bcould\s+be\b/, /\bneeds?\s+(an?\s+)?(expert|agronomist|lab|re-?check|another\s+visit)\b/, /\?/];

function sentences(texts: string[]): string[] {
  return texts
    .flatMap((t) => t.split(/(?<=[.!?;])\s+|\n+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function firstMatch(sents: string[], res: RegExp[]): string | undefined {
  return sents.find((s) => res.some((r) => r.test(s.toLowerCase())));
}

export function analyzeReportDemo(input: ReportInput): ReportAnalysis {
  const texts = [...input.notes, ...(input.findingsDraft ? [input.findingsDraft] : [])];
  const sents = sentences(texts);
  const all = sents.join(" ").toLowerCase();

  const supported: ReportAnalysis["supported"] = [];
  const ruledOut: ReportAnalysis["ruledOut"] = [];
  RULES.forEach((rule) => {
    const neg = firstMatch(sents, rule.negations);
    if (neg) {
      ruledOut.push({ hypothesis: rule.hypothesis, label: HYPOTHESIS_LABEL[rule.hypothesis], evidence: neg });
      return;
    }
    const pos = firstMatch(sents, rule.patterns);
    if (pos) supported.push({ hypothesis: rule.hypothesis, label: HYPOTHESIS_LABEL[rule.hypothesis], evidence: pos });
  });

  const problemHypotheses = supported.filter((s) => s.hypothesis !== "weeds");
  const saysNoIssue = NO_ISSUE.some((r) => r.test(all));
  const uncertain = UNCERTAIN.some((r) => r.test(all));
  const tooShort = all.replace(/\s+/g, " ").length < 20;
  const unchecked = input.checks.filter((c) => !c.done && !/record findings/i.test(c.label));

  let suggestedOutcome: InspectionOutcome;
  let outcomeReason: string;
  if (tooShort) {
    suggestedOutcome = "needs_follow_up";
    outcomeReason = "There are not enough notes to judge the visit yet.";
  } else if (problemHypotheses.length > 0 && uncertain) {
    suggestedOutcome = "needs_follow_up";
    outcomeReason = `Your notes describe symptoms (${problemHypotheses.map((h) => h.label.toLowerCase()).join(", ")}) but also say the cause is unclear.`;
  } else if (problemHypotheses.length > 0) {
    suggestedOutcome = "issue_confirmed";
    outcomeReason = `Your notes describe a visible problem consistent with ${problemHypotheses.map((h) => h.label.toLowerCase()).join(" and ")}.`;
  } else if (saysNoIssue || supported.some((s) => s.hypothesis === "weeds")) {
    suggestedOutcome = "no_issue_found";
    outcomeReason = supported.some((s) => s.hypothesis === "weeds")
      ? "Your notes point to weeds rather than a crop-health problem."
      : "Your notes say the plants look normal.";
  } else {
    suggestedOutcome = "needs_follow_up";
    outcomeReason = "The notes do not clearly confirm or rule out a problem.";
  }

  // Findings summary: only the adviser's own sentences that carry evidence (no new facts).
  // Every sentence that matches any rule (symptom or ruled-out cause), in the adviser's original order.
  const evidenceSentences = sents.filter((sent) =>
    RULES.some((r) => [...r.patterns, ...r.negations].some((re) => re.test(sent.toLowerCase()))),
  );
  const findingsSummary = tooShort
    ? ""
    : (evidenceSentences.length ? evidenceSentences : sents.slice(0, 3)).map((s) => s.replace(/[.;]+$/, "")).join(". ") + ".";

  const openQuestions: string[] = [];
  unchecked.forEach((c) => openQuestions.push(`Not checked yet: ${c.label.replace(/\.$/, "")}.`));
  if (input.photosCount === 0) openQuestions.push("No photo attached — add one of affected and healthy plants for the record.");
  if (supported.some((s) => s.hypothesis === "water_stress") && !/\bmoisture|\bdry\b|\bwet\b/.test(all))
    openQuestions.push("Soil moisture at root depth was not described.");
  if (supported.some((s) => s.hypothesis === "pests") && !/\d/.test(all))
    openQuestions.push("How many plants were affected? A count (e.g. 6 of 50) makes the follow-up comparable.");
  if (supported.some((s) => s.hypothesis === "disease"))
    openQuestions.push("Disease cannot be confirmed from a visit note — consider asking the cooperative agronomist.");
  if (input.anomaly && suggestedOutcome === "no_issue_found")
    openQuestions.push("The remote signal showed a decline but nothing was found — re-check after the next data update.");

  const has = (h: Hypothesis) => problemHypotheses.some((s) => s.hypothesis === h);
  let followUp: ReportAnalysis["followUp"];
  if (suggestedOutcome === "no_issue_found") {
    followUp = supported.some((s) => s.hypothesis === "weeds")
      ? { action: "Schedule weeding; no crop-health follow-up needed.", inDays: null }
      : { action: "No action needed. Compare with the next greenness update.", inDays: null };
  } else if (suggestedOutcome === "needs_follow_up") {
    followUp = { action: "Plan another visit to complete the open checks.", inDays: 3 };
  } else if (has("pests")) {
    followUp = { action: "Re-scout in 7 days and compare the share of damaged plants.", inDays: 7 };
  } else if (has("water_stress")) {
    followUp = { action: "Re-check in 5 days; discuss water-saving or irrigation options with the farmer.", inDays: 5 };
  } else if (has("nutrients") || has("disease")) {
    followUp = { action: "Ask the cooperative agronomist to review the findings within 7 days.", inDays: 7 };
  } else if (has("waterlogging")) {
    followUp = { action: "Check drainage after the next rain.", inDays: 7 };
  } else {
    followUp = { action: "Re-check in one week.", inDays: 7 };
  }

  return {
    mode: "demo",
    suggestedOutcome,
    outcomeReason,
    findingsSummary,
    supported,
    ruledOut,
    openQuestions: openQuestions.slice(0, 5),
    followUp,
    disclaimer: REPORT_DISCLAIMER,
  };
}

/** Light validation for request bodies (server). */
export function isReportInput(v: unknown): v is ReportInput {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Partial<ReportInput>;
  return (
    typeof r.inspectionId === "string" &&
    typeof r.field === "object" &&
    r.field !== null &&
    Array.isArray(r.notes) &&
    r.notes.every((n) => typeof n === "string") &&
    Array.isArray(r.checks) &&
    Array.isArray(r.groundReports) &&
    JSON.stringify(v).length < 50_000
  );
}
