/**
 * Core domain types for FarmSignal.
 *
 * Every piece of data carries an explicit `source` so the UI can always tell the
 * user whether something was observed, simulated, model-generated or confirmed.
 */

export type LatLng = [number, number];

/** Where a piece of data comes from. Shown to users as a provenance label. */
export type DataSource =
  | "demo_sample" // hand-written sample data for the hackathon demo
  | "simulated_index" // simulated vegetation index, NOT a real satellite measurement
  | "farmer_report" // entered by a farmer
  | "adviser" // entered by a field adviser
  | "open_meteo" // live weather from the Open-Meteo API
  | "weather_file" // rainfall from data/weather.csv
  | "sentinel2"; // real Sentinel-2 NDVI from the data script (source = real)

export type Priority = "high" | "medium" | "low";
export type Severity = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";

export interface Adviser {
  id: string;
  name: string;
  role: "field_adviser" | "agronomist" | "farmer";
}

export interface Farm {
  id: string;
  name: string;
  ownerName: string;
  cooperative: string;
  region: string;
  location: LatLng;
}

export interface VegetationSample {
  date: string; // ISO date
  value: number; // 0..1, NDVI-like scale
}

export interface Field {
  id: string; // e.g. "FS-104"
  farmId: string;
  name: string;
  crop: "maize";
  variety?: string;
  growthStage: string;
  areaHa: number;
  centroid: LatLng;
  boundary: LatLng[];
  /** "data_file" = outline from data/fields.geojson, "generated" = placeholder square. */
  boundarySource: "data_file" | "builtin_sample" | "generated";
  lastObservationAt: string;
  lastInspectionAt?: string;
  vegetationIndex: {
    source: DataSource;
    label: string;
    series: VegetationSample[];
  };
}

export type AnomalyType =
  | "vegetation_decline"
  | "uneven_growth"
  | "water_stress_signal"
  | "reported_issue";

export type AnomalyStatus = "open" | "under_review" | "confirmed" | "dismissed";

export interface Anomaly {
  id: string;
  fieldId: string;
  type: AnomalyType;
  detectedAt: string;
  severity: Severity;
  status: AnomalyStatus;
  source: DataSource;
  /** 1. What was observed (factual, from data). */
  observed: string;
  /** 2. Why it may matter. */
  whyItMatters: string;
  /** 3. Possible explanations — hypotheses that need field verification. */
  possibleExplanations: string[];
  /** 4. Confidence of the signal itself (not of any diagnosis). */
  confidence: Confidence;
  confidenceNote: string;
  /** 5. What an adviser should verify on site. */
  verifyOnSite: string[];
  /** 6. Next recommended action. */
  nextAction: string;
  /** Relative change of the index in % (negative = decline), if applicable. */
  changePct?: number;
  location?: LatLng;
  zoneLabel?: string;
}

export type ObservationCategory =
  | "water_stress"
  | "unusual_growth"
  | "leaf_damage"
  | "pests_visible"
  | "other";

export interface FieldObservation {
  id: string;
  fieldId: string;
  createdAt: string;
  author: string;
  authorRole: Adviser["role"];
  source: DataSource;
  category: ObservationCategory;
  description: string;
  voiceTranscript?: string;
  photoDataUrl?: string;
  inspectionId?: string;
}

export type InspectionStatus = "open" | "in_progress" | "completed";

export interface CheckItem {
  id: string;
  label: string;
  done: boolean;
}

export interface InspectionNote {
  id: string;
  at: string;
  author: string;
  text: string;
}

export interface InspectionTask {
  id: string;
  fieldId: string;
  anomalyIds: string[];
  observationIds: string[];
  title: string;
  reason: string;
  supportingObservations: string[];
  suggestedChecks: CheckItem[];
  assigneeId?: string;
  status: InspectionStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  notes: InspectionNote[];
  photos: string[];
  reportId?: string;
}

export type InspectionOutcome = "issue_confirmed" | "no_issue_found" | "needs_follow_up";

export interface InspectionReport {
  id: string;
  inspectionId: string;
  fieldId: string;
  createdAt: string;
  author: string;
  outcome: InspectionOutcome;
  /** Confirmed findings as entered by the adviser — the only "confirmed" data in the system. */
  confirmedFindings: string;
  recommendation: string;
  photos: string[];
  checksCompleted: string[];
}

export interface WeatherObservation {
  date: string;
  tempMaxC?: number;
  tempMinC?: number;
  precipitationMm: number;
  source: DataSource;
}

export type ActivityType =
  | "anomaly_flagged"
  | "observation_added"
  | "inspection_created"
  | "inspection_started"
  | "inspection_note"
  | "inspection_completed"
  | "assignment_changed";

export interface ActivityEvent {
  id: string;
  at: string;
  fieldId: string;
  type: ActivityType;
  message: string;
  actor: string;
  inspectionId?: string;
}

export interface AppSettings {
  currentUserId: string;
  liveWeather: boolean;
}

export interface AppState {
  version: number;
  seededAt: string;
  cooperative: { name: string; region: string; fictional: true; center: LatLng };
  advisers: Adviser[];
  farms: Farm[];
  fields: Field[];
  anomalies: Anomaly[];
  observations: FieldObservation[];
  inspections: InspectionTask[];
  reports: InspectionReport[];
  /** Daily weather for the demo area. */
  weather: WeatherObservation[];
  /** Which field data the state was built from (see field-data.ts). */
  data: {
    hash: string;
    origin: "data_files" | "built_in";
    warnings: string[];
    payload: import("./field-data").FieldDataPayload;
  };
  activity: ActivityEvent[];
  settings: AppSettings;
}
