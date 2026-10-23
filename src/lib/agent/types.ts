export type AgentMode =
  | "why_attention"
  | "explain_priority"
  | "structure_report"
  | "questions"
  | "checklist"
  | "summarize_findings";

export const AGENT_MODES: Array<{ id: AgentMode; label: string; needsInspection?: boolean }> = [
  { id: "why_attention", label: "Why does this field need attention?" },
  { id: "explain_priority", label: "Explain the priority" },
  { id: "checklist", label: "Inspection checklist" },
  { id: "questions", label: "Questions to investigate" },
  { id: "structure_report", label: "Turn observations into a report" },
  { id: "summarize_findings", label: "Summarize latest findings" },
];

/** Plain JSON context sent to the agent. Contains no photo data — only whether a photo exists. */
export interface AgentContext {
  field: {
    id: string;
    name: string;
    crop: string;
    growthStage: string;
    areaHa: number;
    farmName?: string;
    daysSinceInspection?: number;
  };
  priority?: { score: number; level: string; factors: Array<{ label: string; points: number }> };
  inspection?: {
    id: string;
    title: string;
    status: string;
    reason: string;
    supportingObservations: string[];
    checks: Array<{ label: string; done: boolean }>;
    notes: string[];
    photosCount: number;
  };
  anomalies: Array<{
    id: string;
    type: string;
    severity: string;
    status: string;
    source: string;
    observed: string;
    possibleExplanations: string[];
    confidence: string;
    verifyOnSite: string[];
    nextAction: string;
    changePct?: number;
  }>;
  observations: Array<{
    createdAt: string;
    author: string;
    role: string;
    category: string;
    description: string;
    voiceTranscript?: string;
    hasPhoto: boolean;
  }>;
  reports: Array<{ createdAt: string; author: string; outcome: string; confirmedFindings: string; recommendation: string }>;
  weather?: { rain7dMm: number; dryDays: number; avgMaxTempC?: number; source?: string };
}

export type SectionKind = "observed" | "confirmed" | "interpretation" | "hypothesis" | "action" | "question";

export interface AgentSection {
  kind: SectionKind;
  heading: string;
  items: string[];
}

export interface AgentResponse {
  mode: "demo" | "llm";
  title: string;
  sections: AgentSection[];
  disclaimer: string;
  model?: string;
}

export const DISCLAIMER =
  "AI-assisted summary based only on the records in FarmSignal. It cannot see photos or satellite images, may be wrong, and does not diagnose crop diseases. Verify on site and consult an agronomist before consequential decisions.";
