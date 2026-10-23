/**
 * Demo / sample data for FarmSignal.
 *
 * EVERYTHING IN THIS FILE IS FICTIONAL:
 * - The cooperative, farms, farmers and advisers are invented.
 * - Coordinates are placed in a real maize region (Trans-Nzoia, Kenya) only so the
 *   map looks plausible. Field boundaries are generated, not surveyed.
 * - Vegetation index values are SIMULATED. They are not satellite measurements.
 * - Weather here is sample data (the app can optionally load live weather instead).
 *
 * To connect real data later, replace `createSeedState` with loaders in
 * `src/lib/services/*` — the rest of the app only reads `AppState`.
 */
import type {
  ActivityEvent,
  Anomaly,
  AppState,
  Farm,
  Field,
  FieldObservation,
  InspectionReport,
  InspectionTask,
  LatLng,
  VegetationSample,
  WeatherObservation,
} from "./types";

export const STATE_VERSION = 1;

const DAY = 24 * 60 * 60 * 1000;

function isoDaysAgo(now: Date, days: number, hour = 9): string {
  const d = new Date(now.getTime() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dateDaysAgo(now: Date, days: number): string {
  return isoDaysAgo(now, days, 12).slice(0, 10);
}

/** Generates a slightly irregular quadrilateral of roughly `areaHa` around a centroid. */
function makeBoundary(center: LatLng, areaHa: number, aspect: number, rotationDeg: number): LatLng[] {
  const areaM2 = areaHa * 10_000;
  const w = Math.sqrt(areaM2 * aspect);
  const h = areaM2 / w;
  const rot = (rotationDeg * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((center[0] * Math.PI) / 180);
  const corners: Array<[number, number]> = [
    [-w / 2, -h / 2],
    [w / 2 * 1.04, -h / 2],
    [w / 2, h / 2 * 0.96],
    [-w / 2 * 0.97, h / 2],
  ];
  return corners.map(([x, y]) => {
    const xr = x * Math.cos(rot) - y * Math.sin(rot);
    const yr = x * Math.sin(rot) + y * Math.cos(rot);
    return [
      +(center[0] + yr / mPerDegLat).toFixed(6),
      +(center[1] + xr / mPerDegLng).toFixed(6),
    ] as LatLng;
  });
}

/** Simulated NDVI-like series: 8 samples, 5 days apart, ending today. */
function simulatedSeries(now: Date, values: number[]): VegetationSample[] {
  return values.map((value, i) => ({
    date: dateDaysAgo(now, (values.length - 1 - i) * 5),
    value,
  }));
}

function sampleWeather(now: Date, offset: number): WeatherObservation[] {
  // 14 days: rain until 10 days ago, then a dry spell (consistent with the demo scenario).
  const rain = [6.2, 11.4, 0.8, 3.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  return rain.map((mm, i) => {
    const daysAgo = 13 - i;
    const dry = mm === 0;
    return {
      date: dateDaysAgo(now, daysAgo),
      tempMaxC: +(25.5 + (dry ? 2.4 : 0) + ((i + offset) % 3) * 0.5).toFixed(1),
      tempMinC: +(13.2 + ((i + offset) % 2) * 0.6).toFixed(1),
      precipitationMm: +(mm * (1 + offset * 0.1)).toFixed(1),
      source: "demo_sample" as const,
    };
  });
}

/**
 * Squeezes the demo layout around a center so all fields are visible at a useful zoom level.
 * Purely cosmetic — the coordinates are fictional anyway.
 */
const CENTER: LatLng = [1.04, 35.0];
const SPREAD = 0.3;
function pos(lat: number, lng: number): LatLng {
  return [+(CENTER[0] + (lat - CENTER[0]) * SPREAD).toFixed(6), +(CENTER[1] + (lng - CENTER[1]) * SPREAD).toFixed(6)];
}

export function createSeedState(now: Date = new Date()): AppState {
  const cooperative = {
    name: "Nzoia Valley Maize Cooperative",
    region: "Trans-Nzoia, Kenya",
    fictional: true as const,
  };

  const advisers: AppState["advisers"] = [
    { id: "adv-grace", name: "Grace Wanjiru", role: "field_adviser" },
    { id: "adv-peter", name: "Peter Otieno", role: "field_adviser" },
    { id: "adv-amina", name: "Amina Chebet", role: "agronomist" },
  ];

  const farms: Farm[] = [
    { id: "farm-kapsara", name: "Kapsara Farm", ownerName: "Joseph Kiprono", cooperative: cooperative.name, region: "Kapsara", location: pos(1.0662, 35.0365) },
    { id: "farm-saboti", name: "Saboti Ridge Farm", ownerName: "Mary Nafula", cooperative: cooperative.name, region: "Saboti", location: pos(1.0415, 34.9575) },
    { id: "farm-kiminini", name: "Kiminini Plots", ownerName: "Samuel Wekesa", cooperative: cooperative.name, region: "Kiminini", location: pos(0.9855, 34.9855) },
  ];

  const simLabel = "Simulated vegetation index (NDVI-like, demo data)";

  const f = (
    id: string,
    farmId: string,
    name: string,
    centroid: LatLng,
    areaHa: number,
    aspect: number,
    rot: number,
    stage: string,
    plantedDaysAgo: number,
    lastObs: number,
    lastInsp: number | undefined,
    series: number[],
  ): Field => ({
    id,
    farmId,
    name,
    crop: "maize",
    variety: "H614D (hybrid)",
    growthStage: stage,
    plantingDate: dateDaysAgo(now, plantedDaysAgo),
    areaHa,
    centroid,
    boundary: makeBoundary(centroid, areaHa, aspect, rot),
    boundarySource: "demo_sample",
    lastObservationAt: isoDaysAgo(now, lastObs, 10),
    lastInspectionAt: lastInsp === undefined ? undefined : isoDaysAgo(now, lastInsp, 11),
    vegetationIndex: { source: "simulated_index", label: simLabel, series: simulatedSeries(now, series) },
  });

  const fields: Field[] = [
    f("FS-101", "farm-kapsara", "Kapsara West Block", pos(1.0658, 35.0268), 3.2, 1.6, 8, "V10 (10-leaf)", 58, 2, 12, [0.52, 0.58, 0.63, 0.67, 0.7, 0.72, 0.73, 0.74]),
    f("FS-104", "farm-kapsara", "Kapsara East Block", pos(1.0641, 35.0448), 4.1, 1.4, -12, "V12 (approaching tasseling)", 63, 1, 26, [0.56, 0.62, 0.67, 0.7, 0.71, 0.71, 0.64, 0.58]),
    f("FS-107", "farm-kapsara", "Kapsara River Strip", pos(1.0718, 35.0392), 1.6, 3.2, 25, "V9 (9-leaf)", 55, 1, 18, [0.48, 0.52, 0.55, 0.57, 0.58, 0.6, 0.61, 0.6]),
    f("FS-112", "farm-saboti", "Saboti Upper Field", pos(1.0452, 34.9512), 2.4, 1.2, -5, "V11 (11-leaf)", 60, 4, 15, [0.54, 0.6, 0.65, 0.68, 0.7, 0.69, 0.67, 0.66]),
    f("FS-115", "farm-saboti", "Saboti Lower Field", pos(1.0362, 34.9618), 2.9, 1.8, 14, "V11 (11-leaf)", 61, 3, 3, [0.53, 0.59, 0.64, 0.66, 0.66, 0.67, 0.69, 0.7]),
    f("FS-118", "farm-saboti", "Saboti Hillside", pos(1.0478, 34.9628), 1.2, 1.1, 30, "V10 (10-leaf)", 57, 6, 30, [0.5, 0.56, 0.61, 0.65, 0.68, 0.7, 0.71, 0.71]),
    f("FS-121", "farm-kiminini", "Kiminini North", pos(0.9902, 34.9812), 2.0, 1.5, -20, "V10 (10-leaf)", 56, 5, 20, [0.51, 0.57, 0.62, 0.66, 0.69, 0.7, 0.72, 0.72]),
    f("FS-124", "farm-kiminini", "Kiminini South", pos(0.9801, 34.9903), 1.8, 1.3, 5, "V11 (11-leaf)", 59, 2, 9, [0.53, 0.58, 0.62, 0.64, 0.62, 0.63, 0.65, 0.67]),
  ];

  const anomalies: Anomaly[] = [
    {
      id: "ANM-2041",
      fieldId: "FS-104",
      type: "vegetation_decline",
      detectedAt: isoDaysAgo(now, 2, 7),
      severity: "high",
      status: "open",
      source: "simulated_index",
      observed:
        "Simulated vegetation index for the north-east section fell from 0.71 to 0.58 (−18%) over the last 10 days, while the west of the same field stayed stable.",
      whyItMatters:
        "The field is approaching tasseling, a stage where maize is sensitive to stress. A sustained decline in only part of a field can indicate a localized problem that is cheaper to address early.",
      possibleExplanations: [
        "Water stress during the current 10-day dry spell (sample weather shows no rain).",
        "Nutrient deficiency (e.g. nitrogen) becoming visible as the crop's demand peaks.",
        "Pest or disease pressure in a specific zone — cannot be determined from an index alone.",
        "Data artefact (cloud shadow, sensor noise) — the signal must be verified on the ground.",
      ],
      confidence: "medium",
      confidenceNote:
        "The decline appears in three consecutive simulated samples, so it is unlikely to be one-off noise. It says nothing about the cause.",
      verifyOnSite: [
        "Walk the north-east corner and compare 20 plants with the healthy west side.",
        "Check soil moisture at 10–20 cm depth in affected and unaffected areas.",
        "Look for leaf rolling, discoloration, lesions and insects in whorls and leaf undersides.",
        "Take photos of affected and reference plants.",
      ],
      nextAction: "Prioritize an on-site inspection within 48 hours.",
      changePct: -18,
      location: pos(1.0652, 35.0458),
      zoneLabel: "North-east section",
    },
    {
      id: "ANM-2038",
      fieldId: "FS-107",
      type: "uneven_growth",
      detectedAt: isoDaysAgo(now, 5, 7),
      severity: "medium",
      status: "under_review",
      source: "simulated_index",
      observed:
        "Simulated index values vary strongly along the strip: the river-side third is ~0.12 lower than the rest of the field.",
      whyItMatters: "Uneven growth can reduce the field's overall yield and may point to a drainage or establishment problem.",
      possibleExplanations: [
        "Waterlogging or different soil near the river.",
        "Uneven emergence after planting (seed depth, crusting).",
        "Edge effects along the riverbank (shading, animals).",
      ],
      confidence: "medium",
      confidenceNote: "Pattern is spatially consistent in the simulated data but has not been checked on site.",
      verifyOnSite: [
        "Compare plant height and stand count in the river-side third vs. the rest.",
        "Check for standing water or compacted soil.",
      ],
      nextAction: "Complete the ongoing inspection and record stand counts.",
      changePct: -4,
      location: pos(1.0712, 35.0381),
      zoneLabel: "River-side third",
    },
    {
      id: "ANM-2036",
      fieldId: "FS-112",
      type: "vegetation_decline",
      detectedAt: isoDaysAgo(now, 6, 7),
      severity: "low",
      status: "open",
      source: "simulated_index",
      observed: "Simulated index declined slightly from 0.70 to 0.66 (−6%) over 15 days across the whole field.",
      whyItMatters: "A small, field-wide decline is often within normal variation but worth checking during the next routine visit.",
      possibleExplanations: ["Normal variation or measurement noise.", "Early water stress during the dry spell."],
      confidence: "low",
      confidenceNote: "The change is small and close to the noise level of the simulated data.",
      verifyOnSite: ["Quick visual check during the next routine visit."],
      nextAction: "Combine with the next routine visit; no urgent action.",
      changePct: -6,
      location: pos(1.0455, 34.9516),
    },
    {
      id: "ANM-2029",
      fieldId: "FS-115",
      type: "uneven_growth",
      detectedAt: isoDaysAgo(now, 8, 7),
      severity: "medium",
      status: "dismissed",
      source: "simulated_index",
      observed: "A small patch in the south of the field showed lower simulated index values than its surroundings.",
      whyItMatters: "Could have indicated a localized establishment problem.",
      possibleExplanations: ["Weed patch", "Poor emergence"],
      confidence: "low",
      confidenceNote: "Small patch, single sample.",
      verifyOnSite: ["Inspect the southern patch."],
      nextAction: "Resolved — see inspection report.",
      location: pos(1.0352, 34.9614),
    },
    {
      id: "ANM-2017",
      fieldId: "FS-124",
      type: "reported_issue",
      detectedAt: isoDaysAgo(now, 11, 8),
      severity: "high",
      status: "confirmed",
      source: "farmer_report",
      observed: "Farmer reported ragged holes in young leaves and sawdust-like residue in the whorls.",
      whyItMatters: "Whorl feeding damage can spread quickly at this stage if a pest population is establishing.",
      possibleExplanations: ["Caterpillar feeding (e.g. fall armyworm)", "Other leaf-feeding insects"],
      confidence: "medium",
      confidenceNote: "Based on a farmer description; needed on-site confirmation.",
      verifyOnSite: ["Scout 5 × 10 plants in a W pattern and count damaged plants and larvae."],
      nextAction: "Follow-up scouting in 7 days (see report).",
      location: pos(0.9806, 34.9899),
    },
  ];

  const observations: FieldObservation[] = [
    {
      id: "OBS-3310",
      fieldId: "FS-104",
      createdAt: isoDaysAgo(now, 1, 15),
      author: "Joseph Kiprono",
      authorRole: "farmer",
      source: "farmer_report",
      category: "water_stress",
      description:
        "Leaves are rolling by midday in the north-east corner and the plants look greyish-green. The west side looks normal.",
    },
    {
      id: "OBS-3302",
      fieldId: "FS-107",
      createdAt: isoDaysAgo(now, 4, 9),
      author: "Joseph Kiprono",
      authorRole: "farmer",
      source: "farmer_report",
      category: "unusual_growth",
      description: "Plants near the river are shorter and some gaps in the rows.",
    },
    {
      id: "OBS-3291",
      fieldId: "FS-115",
      createdAt: isoDaysAgo(now, 3, 11),
      author: "Amina Chebet",
      authorRole: "agronomist",
      source: "adviser",
      category: "other",
      description: "Southern patch is dominated by weeds (mainly couch grass); maize plants there are normal in color.",
      inspectionId: "INS-1305",
    },
    {
      id: "OBS-3277",
      fieldId: "FS-124",
      createdAt: isoDaysAgo(now, 11, 8),
      author: "Samuel Wekesa",
      authorRole: "farmer",
      source: "farmer_report",
      category: "leaf_damage",
      description: "Ragged holes in young leaves and sawdust-like residue in the whorls on several rows.",
    },
  ];

  const checks = (labels: string[], doneCount = 0) =>
    labels.map((label, i) => ({ id: `chk-${i + 1}`, label, done: i < doneCount }));

  const inspections: InspectionTask[] = [
    {
      id: "INS-1312",
      fieldId: "FS-104",
      anomalyIds: ["ANM-2041"],
      observationIds: ["OBS-3310"],
      title: "Investigate vegetation decline in north-east section",
      reason:
        "High-severity simulated index decline (−18% in 10 days) in one zone, confirmed by a farmer report of leaf rolling. Last inspection was 26 days ago.",
      supportingObservations: [
        "Simulated index: 0.71 → 0.58 in the north-east section (demo data).",
        "Farmer report (yesterday): leaves rolling by midday, greyish-green color in NE corner.",
        "Sample weather: no rainfall in the last 10 days.",
      ],
      suggestedChecks: checks(anomalies[0].verifyOnSite.concat(["Record findings and decide on follow-up."])),
      status: "open",
      createdAt: isoDaysAgo(now, 2, 8),
      updatedAt: isoDaysAgo(now, 1, 15),
      notes: [],
      photos: [],
    },
    {
      id: "INS-1309",
      fieldId: "FS-107",
      anomalyIds: ["ANM-2038"],
      observationIds: ["OBS-3302"],
      title: "Check uneven growth along river strip",
      reason: "Medium-severity uneven growth pattern plus farmer report of shorter plants near the river.",
      supportingObservations: [
        "Simulated index ~0.12 lower in the river-side third (demo data).",
        "Farmer report: shorter plants and gaps in rows near the river.",
      ],
      suggestedChecks: checks(anomalies[1].verifyOnSite.concat(["Photograph a representative row."]), 1),
      assigneeId: "adv-peter",
      status: "in_progress",
      createdAt: isoDaysAgo(now, 5, 8),
      updatedAt: isoDaysAgo(now, 1, 10),
      startedAt: isoDaysAgo(now, 1, 10),
      notes: [
        {
          id: "note-1",
          at: isoDaysAgo(now, 1, 10),
          author: "Peter Otieno",
          text: "Started walking the strip. Soil near the river is noticeably wetter; continuing stand counts tomorrow.",
        },
      ],
      photos: [],
    },
    {
      id: "INS-1307",
      fieldId: "FS-112",
      anomalyIds: ["ANM-2036"],
      observationIds: [],
      title: "Routine check: slight field-wide decline",
      reason: "Low-severity decline close to noise level. Combine with next routine visit.",
      supportingObservations: ["Simulated index: 0.70 → 0.66 over 15 days (demo data)."],
      suggestedChecks: checks(anomalies[2].verifyOnSite),
      assigneeId: "adv-amina",
      status: "open",
      createdAt: isoDaysAgo(now, 6, 8),
      updatedAt: isoDaysAgo(now, 6, 8),
      notes: [],
      photos: [],
    },
    {
      id: "INS-1305",
      fieldId: "FS-115",
      anomalyIds: ["ANM-2029"],
      observationIds: ["OBS-3291"],
      title: "Inspect low-index patch in southern area",
      reason: "Localized low simulated index values in the south of the field.",
      supportingObservations: ["Simulated index patch in the southern area (demo data)."],
      suggestedChecks: checks(["Inspect the southern patch.", "Check plant color and stand."], 2),
      assigneeId: "adv-amina",
      status: "completed",
      createdAt: isoDaysAgo(now, 8, 8),
      updatedAt: isoDaysAgo(now, 3, 12),
      startedAt: isoDaysAgo(now, 3, 10),
      completedAt: isoDaysAgo(now, 3, 12),
      notes: [],
      photos: [],
      reportId: "RPT-0907",
    },
    {
      id: "INS-1298",
      fieldId: "FS-124",
      anomalyIds: ["ANM-2017"],
      observationIds: ["OBS-3277"],
      title: "Verify reported leaf damage",
      reason: "Farmer reported whorl feeding damage.",
      supportingObservations: ["Farmer report: ragged holes and residue in whorls."],
      suggestedChecks: checks(["Scout 5 × 10 plants in a W pattern.", "Count damaged plants and larvae."], 2),
      assigneeId: "adv-grace",
      status: "completed",
      createdAt: isoDaysAgo(now, 11, 9),
      updatedAt: isoDaysAgo(now, 9, 13),
      startedAt: isoDaysAgo(now, 9, 10),
      completedAt: isoDaysAgo(now, 9, 13),
      notes: [],
      photos: [],
      reportId: "RPT-0899",
    },
  ];

  const reports: InspectionReport[] = [
    {
      id: "RPT-0907",
      inspectionId: "INS-1305",
      fieldId: "FS-115",
      createdAt: isoDaysAgo(now, 3, 12),
      author: "Amina Chebet",
      outcome: "no_issue_found",
      confirmedFindings: "Low-index patch is a weed patch (couch grass). Maize plants in the patch are healthy in color and stand.",
      recommendation: "Schedule weeding of the southern patch. No crop-health follow-up needed.",
      photos: [],
      checksCompleted: ["Inspect the southern patch.", "Check plant color and stand."],
    },
    {
      id: "RPT-0899",
      inspectionId: "INS-1298",
      fieldId: "FS-124",
      createdAt: isoDaysAgo(now, 9, 13),
      author: "Grace Wanjiru",
      outcome: "issue_confirmed",
      confirmedFindings:
        "Larvae and fresh whorl feeding damage found on 6 of 50 scouted plants (12%), concentrated in the eastern rows.",
      recommendation: "Re-scout in 7 days; discuss control options with the cooperative agronomist if damage exceeds local thresholds.",
      photos: [],
      checksCompleted: ["Scout 5 × 10 plants in a W pattern.", "Count damaged plants and larvae."],
    },
  ];

  const weather: AppState["weather"] = {
    "farm-kapsara": sampleWeather(now, 0),
    "farm-saboti": sampleWeather(now, 1),
    "farm-kiminini": sampleWeather(now, 2),
  };

  const ev = (
    id: string,
    daysAgo: number,
    hour: number,
    fieldId: string,
    type: ActivityEvent["type"],
    message: string,
    actor: string,
    inspectionId?: string,
  ): ActivityEvent => ({ id, at: isoDaysAgo(now, daysAgo, hour), fieldId, type, message, actor, inspectionId });

  const activity: ActivityEvent[] = [
    ev("act-12", 1, 15, "FS-104", "observation_added", "Farmer reported leaf rolling in the north-east corner", "Joseph Kiprono", "INS-1312"),
    ev("act-11", 1, 10, "FS-107", "inspection_started", "Inspection started", "Peter Otieno", "INS-1309"),
    ev("act-10", 2, 8, "FS-104", "inspection_created", "Inspection created from high-severity alert", "FarmSignal rules", "INS-1312"),
    ev("act-09", 2, 7, "FS-104", "anomaly_flagged", "Simulated index decline (−18%) flagged in north-east section", "FarmSignal rules"),
    ev("act-08", 3, 12, "FS-115", "inspection_completed", "Inspection completed — no crop issue found (weed patch)", "Amina Chebet", "INS-1305"),
    ev("act-07", 5, 8, "FS-107", "inspection_created", "Inspection created for uneven growth", "FarmSignal rules", "INS-1309"),
    ev("act-06", 6, 8, "FS-112", "inspection_created", "Low-priority check created", "FarmSignal rules", "INS-1307"),
    ev("act-05", 9, 13, "FS-124", "inspection_completed", "Inspection completed — leaf feeding damage confirmed", "Grace Wanjiru", "INS-1298"),
  ];

  return {
    version: STATE_VERSION,
    seededAt: now.toISOString(),
    cooperative,
    advisers,
    farms,
    fields,
    anomalies,
    observations,
    inspections,
    reports,
    weather,
    activity,
    settings: { currentUserId: "adv-grace", liveWeather: true },
  };
}
