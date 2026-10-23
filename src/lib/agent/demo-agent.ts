/**
 * Deterministic "demo mode" Field Agent.
 *
 * Builds its answer ONLY from the records in the context (no hidden knowledge,
 * no image analysis). Used when no LLM API key is configured or the API fails.
 */
import { DISCLAIMER, type AgentContext, type AgentMode, type AgentResponse, type AgentSection } from "./types";

const OUTCOME_TEXT: Record<string, string> = {
  issue_confirmed: "issue confirmed",
  no_issue_found: "no issue found",
  needs_follow_up: "needs follow-up",
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function activeAnomalies(ctx: AgentContext) {
  return ctx.anomalies.filter((a) => a.status === "open" || a.status === "under_review");
}

function observedFacts(ctx: AgentContext): string[] {
  const facts: string[] = [];
  activeAnomalies(ctx).forEach((a) =>
    facts.push(`${a.observed} (source: ${a.source === "simulated_index" ? "simulated demo data" : a.source === "sentinel2" ? "Sentinel-2" : a.source.replace("_", " ")}).`),
  );
  ctx.observations.slice(0, 3).forEach((o) =>
    facts.push(
      `${shortDate(o.createdAt)} – ${o.author} (${o.role.replace("_", " ")}), ${o.category}: "${o.description}"${o.hasPhoto ? " [photo attached, not analyzed]" : ""}`,
    ),
  );
  if (ctx.weather && ctx.weather.dryDays >= 5) {
    facts.push(
      `${ctx.weather.dryDays} consecutive days without meaningful rain (${ctx.weather.source === "weather_file" ? "data/weather.csv" : ctx.weather.source === "open_meteo" ? "live weather" : "sample weather"}).`,
    );
  }
  return facts;
}

function confirmedFacts(ctx: AgentContext): string[] {
  const confirmed: string[] = [];
  ctx.reports.slice(0, 2).forEach((r) =>
    confirmed.push(`${shortDate(r.createdAt)} – ${r.author}: ${r.confirmedFindings} (${OUTCOME_TEXT[r.outcome] ?? r.outcome})`),
  );
  if (ctx.inspection?.status === "in_progress") {
    ctx.inspection.notes.forEach((n) => confirmed.push(`Field note – ${n}`));
  }
  return confirmed;
}

function hypotheses(ctx: AgentContext): string[] {
  const set = new Set<string>();
  activeAnomalies(ctx).forEach((a) => a.possibleExplanations.forEach((e) => set.add(e)));
  return Array.from(set);
}

export function runDemoAgent(mode: AgentMode, ctx: AgentContext): AgentResponse {
  const sections: AgentSection[] = [];
  const name = `${ctx.field.name} (${ctx.field.id})`;
  const push = (kind: AgentSection["kind"], heading: string, items: string[]) => {
    if (items.length) sections.push({ kind, heading, items });
  };
  let title = "";

  switch (mode) {
    case "why_attention": {
      title = `Why ${name} needs attention`;
      const active = activeAnomalies(ctx);
      if (active.length === 0 && !ctx.inspection) {
        push("interpretation", "Assessment", [
          "There are no open signals or inspections for this field. Routine monitoring is sufficient.",
        ]);
        break;
      }
      push("observed", "What the records show", observedFacts(ctx));
      push("confirmed", "Confirmed so far", confirmedFacts(ctx));
      if (ctx.priority) {
        push("interpretation", "Why it is ranked this way", [
          `Rule-based priority score ${ctx.priority.score}/100 (${ctx.priority.level}). Main factors: ${ctx.priority.factors
            .filter((f) => f.points > 0)
            .map((f) => f.label.toLowerCase())
            .join(", ")}.`,
          `Growth stage: ${ctx.field.growthStage}.`,
        ]);
      }
      push("hypothesis", "Possible explanations (not verified)", hypotheses(ctx));
      push("action", "Suggested next step", Array.from(new Set(active.map((a) => a.nextAction))));
      break;
    }

    case "explain_priority": {
      title = `Priority explanation for ${name}`;
      if (!ctx.priority) {
        push("interpretation", "No active inspection", ["This field has no open inspection, so it is not in the queue."]);
        break;
      }
      push(
        "interpretation",
        `Score ${ctx.priority.score}/100 → ${ctx.priority.level} priority`,
        ctx.priority.factors.map((f) => `${f.points > 0 ? "+" : ""}${f.points}  ${f.label}`),
      );
      push("interpretation", "How to read this", [
        "The score is a transparent rule-based heuristic (severity, size of recent change, time since last inspection, fresh ground reports).",
        "It orders the inspection queue. It is not a validated prediction of yield loss or disease.",
      ]);
      break;
    }

    case "checklist": {
      title = `Inspection checklist – ${name}`;
      const items = new Set<string>();
      ctx.inspection?.checks.filter((c) => !c.done).forEach((c) => items.add(c.label));
      activeAnomalies(ctx).forEach((a) => a.verifyOnSite.forEach((v) => items.add(v)));
      items.add("Photograph affected plants and a healthy reference area.");
      items.add("Record what you actually saw, separately from what you suspect.");
      push("action", "On site", Array.from(items));
      const done = ctx.inspection?.checks.filter((c) => c.done).map((c) => c.label) ?? [];
      push("confirmed", "Already checked", done);
      break;
    }

    case "questions": {
      title = `Questions to investigate – ${name}`;
      const qs: string[] = [];
      const active = activeAnomalies(ctx);
      if (active.some((a) => a.type === "vegetation_decline" || a.type === "uneven_growth")) {
        qs.push("Is the affected area visibly different on the ground, and does its boundary match the flagged zone?");
        qs.push("When did the farmer first notice a change, and has it spread?");
      }
      if ((ctx.weather?.dryDays ?? 0) >= 5 || ctx.observations.some((o) => /water/i.test(o.category))) {
        qs.push("Is soil moisture at root depth lower in the affected area than in the healthy part?");
        qs.push("Do the leaves recover in the evening/morning (typical of temporary water stress)?");
      }
      if (ctx.observations.some((o) => /leaf|pest/i.test(o.category))) {
        qs.push("Are insects, eggs or larvae present in the whorls or on leaf undersides?");
      }
      qs.push("Were there recent changes in fertilizer, herbicide or field operations in this area?");
      qs.push("Do neighboring fields show the same pattern?");
      push("question", "Ask and check", qs);
      push("hypothesis", "Hypotheses these questions help test", hypotheses(ctx));
      break;
    }

    case "structure_report": {
      title = `Structured field report – ${name}`;
      push("observed", "Ground observations", ctx.observations.map((o) =>
        `${shortDate(o.createdAt)} | ${o.category} | ${o.author}: ${o.description}${o.voiceTranscript ? ` (voice: "${o.voiceTranscript}")` : ""}${o.hasPhoto ? " | photo attached (not analyzed)" : ""}`,
      ));
      push("observed", "Remote signals", activeAnomalies(ctx).map((a) => a.observed));
      push("confirmed", "Confirmed findings", confirmedFacts(ctx));
      push("hypothesis", "Open hypotheses", hypotheses(ctx));
      push("action", "Recommended follow-up", Array.from(new Set(activeAnomalies(ctx).map((a) => a.nextAction))));
      if (sections.length === 0) push("interpretation", "No records", ["There are no observations recorded for this field yet."]);
      break;
    }

    case "summarize_findings": {
      title = `Latest findings – ${name}`;
      const latest = ctx.reports[0];
      if (latest) {
        push("confirmed", `Confirmed by ${latest.author} on ${shortDate(latest.createdAt)}`, [
          latest.confirmedFindings,
          `Outcome: ${OUTCOME_TEXT[latest.outcome] ?? latest.outcome}.`,
        ]);
        const remaining = hypotheses(ctx);
        push("hypothesis", "Still possible / not yet ruled out", remaining);
        push("action", "Suggested next check", [
          latest.recommendation || "Re-check the field during the next routine visit.",
          "Compare the next vegetation index update with the area inspected today.",
        ]);
      } else if (ctx.inspection?.notes.length) {
        push("confirmed", "Notes from the ongoing inspection", ctx.inspection.notes);
        push("action", "Next", ["Complete the inspection to record confirmed findings."]);
      } else {
        push("interpretation", "No findings yet", ["No inspection has been completed for this field. Start the inspection to record findings."]);
      }
      break;
    }
  }

  return { mode: "demo", title, sections, disclaimer: DISCLAIMER };
}
