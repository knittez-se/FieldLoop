import type {
  AnomalyStatus,
  AnomalyType,
  DataSource,
  InspectionOutcome,
  InspectionStatus,
  ObservationCategory,
} from "./types";

export const CATEGORY_LABEL: Record<ObservationCategory, string> = {
  water_stress: "Water stress",
  unusual_growth: "Unusual growth",
  leaf_damage: "Visible leaf damage",
  pests_visible: "Pests visible",
  other: "Other",
};

export const SOURCE_LABEL: Record<DataSource, string> = {
  demo_sample: "Sample data",
  simulated_index: "Simulated index (demo)",
  farmer_report: "Farmer report",
  adviser: "Adviser entry",
  open_meteo: "Open-Meteo (live)",
  sentinel2: "Sentinel-2",
};

export const ANOMALY_TYPE_LABEL: Record<AnomalyType, string> = {
  vegetation_decline: "Vegetation index decline",
  uneven_growth: "Uneven growth pattern",
  water_stress_signal: "Possible water stress signal",
  reported_issue: "Reported issue",
};

export const ANOMALY_STATUS_LABEL: Record<AnomalyStatus, string> = {
  open: "Open",
  under_review: "Under review",
  confirmed: "Confirmed on site",
  dismissed: "Dismissed after inspection",
};

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
};

export const OUTCOME_LABEL: Record<InspectionOutcome, string> = {
  issue_confirmed: "Issue confirmed",
  no_issue_found: "No issue found",
  needs_follow_up: "Needs follow-up",
};
