/**
 * Builds the app state from field data (data/ files or the built-in sample).
 *
 * 1. Fields, outlines and greenness readings come from the FieldDataPayload.
 * 2. Change detection (detection.ts) creates anomalies + open inspection tasks.
 * 3. A small FICTIONAL demo scenario is layered on top so the workflow has history:
 *    - a farmer report on the top flagged field,
 *    - an inspection already in progress on an unflagged field (ground report),
 *    - two completed inspections with reports on other unflagged fields.
 *    The scenario attaches to whatever field IDs the data uses (F1…F8 or FS-101…).
 *
 * The cooperative, farmers and advisers are fictional.
 */
import { detectChanges, type Detection } from "./detection";
import { hashPayload, type FieldDataPayload, type FieldInput } from "./field-data";
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
  WeatherObservation,
} from "./types";

export const STATE_VERSION = 2;

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CENTER: LatLng = [1.04, 35.0];

function isoDaysAgo(now: Date, days: number, hour = 9): string {
  const d = new Date(now.getTime() - days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// --- geometry helpers ------------------------------------------------------

function centroidOf(ring: LatLng[]): LatLng {
  const lat = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lng = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return [+lat.toFixed(6), +lng.toFixed(6)];
}

/** Approximate polygon area in hectares (equirectangular projection — fine for small fields). */
function areaHa(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (centroidOf(ring)[0] * Math.PI) / 180;
  const pts = ring.map(([lat, lng]) => [lng * 111_320 * Math.cos(lat0), lat * 111_320]);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return +(Math.abs(a) / 2 / 10_000).toFixed(1);
}

function squareAround(c: LatLng, sideM = 120): LatLng[] {
  const dLat = sideM / 2 / 111_320;
  const dLng = sideM / 2 / (111_320 * Math.cos((c[0] * Math.PI) / 180));
  return [
    [c[0] - dLat, c[1] - dLng],
    [c[0] - dLat, c[1] + dLng],
    [c[0] + dLat, c[1] + dLng],
    [c[0] + dLat, c[1] - dLng],
  ];
}

// --- text templates for detected anomalies ---------------------------------

const fmtPct = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`;

function anomalyFromDetection(d: Detection, id: string, field: Field, now: Date): Anomaly {
  const dataNote = d.allReal ? "Sentinel-2 NDVI" : "simulated greenness data";
  const dry = d.rain14dMm !== undefined && d.rain14dMm < 15;
  const explanations = [
    ...(dry ? [`Water stress during the recent dry period (${d.rain14dMm} mm rain in the 14 days before the last reading).`] : []),
    "Nutrient deficiency becoming visible as the crop's demand increases.",
    "Pest or disease pressure — cannot be determined from greenness alone.",
    d.allReal
      ? "Measurement artefact (thin cloud, haze or mixed pixels at the field edge) — the signal must be checked on the ground."
      : "Simulated demo data — the pattern illustrates the workflow only.",
  ];
  return {
    id,
    fieldId: d.fieldId,
    type: "vegetation_decline",
    detectedAt: new Date(Math.min(new Date(`${d.lastDate}T07:00:00`).getTime(), now.getTime())).toISOString(),
    severity: d.severity,
    status: "open",
    source: d.allReal ? "sentinel2" : "simulated_index",
    observed:
      `Greenness (NDVI) fell from ${d.baseline.toFixed(2)} to ${d.last.toFixed(2)} (${fmtPct(d.ownChangePct)}) compared with the weeks before, ` +
      `while the other fields changed by ${fmtPct(d.neighborChangePct)} on average` +
      (d.consecutiveDrops >= 2 ? `. It declined ${d.consecutiveDrops} readings in a row.` : "."),
    whyItMatters:
      `This field is ${Math.abs(d.relativePct)} percentage points worse than its neighbors, which points to a local problem rather than a region-wide change. ` +
      `Growth stage: ${field.growthStage}. Checking early is cheaper than reacting late.`,
    possibleExplanations: explanations,
    confidence: d.confidence,
    confidenceNote:
      (d.confidence === "medium"
        ? `The decline is consistent over ${d.consecutiveDrops} readings, so it is unlikely to be one-off noise.`
        : "The change is small or short, so it may be noise.") + ` Based on ${dataNote}. Says nothing about the cause.`,
    verifyOnSite: [
      "Walk the field and compare 20 plants in the affected part with a healthy part.",
      "Check soil moisture at 10–20 cm depth.",
      "Look for leaf rolling, discoloration, lesions and insects in whorls and leaf undersides.",
      "Take photos of affected and reference plants.",
    ],
    nextAction:
      d.severity === "high" ? "Inspect within 48 hours." : d.severity === "medium" ? "Inspect this week." : "Check during the next routine visit.",
    changePct: d.ownChangePct,
    location: field.centroid,
  };
}

// --- main builder ----------------------------------------------------------

export function createSeedState(payload: FieldDataPayload, now: Date = new Date()): AppState {
  const fromFiles = payload.origin === "data_files";

  const advisers: AppState["advisers"] = [
    { id: "adv-grace", name: "Grace Wanjiru", role: "field_adviser" },
    { id: "adv-peter", name: "Peter Otieno", role: "field_adviser" },
    { id: "adv-amina", name: "Amina Chebet", role: "agronomist" },
  ];
  const farmerNames = ["Joseph Kiprono", "Mary Nafula", "Samuel Wekesa", "Esther Akinyi"];

  // Fields with an outline + at least one reading. Missing outlines get a placeholder square.
  const inputs: FieldInput[] = payload.fields.filter((f) => f.readings.length > 0);
  const withShape = inputs.filter((f) => f.boundary.length >= 3);
  const center: LatLng = withShape.length
    ? centroidOf(withShape.map((f) => centroidOf(f.boundary)))
    : DEFAULT_CENTER;

  // Farms: from the `farm` property, otherwise one demo farm.
  const farmNames = Array.from(new Set(inputs.map((f) => f.farm ?? "Demo Farm")));
  const farms: Farm[] = farmNames.map((name, i) => ({
    id: `farm-${i + 1}`,
    name,
    ownerName: farmerNames[i % farmerNames.length],
    cooperative: "Nzoia Valley Maize Cooperative",
    region: "Trans-Nzoia, Kenya",
    location: center,
  }));
  const farmIdFor = (f: FieldInput) => farms[farmNames.indexOf(f.farm ?? "Demo Farm")].id;

  const fields: Field[] = inputs.map((f, i) => {
    const boundary =
      f.boundary.length >= 3
        ? f.boundary
        : squareAround([center[0] - 0.004 * Math.floor(i / 4), center[1] + 0.003 * (i % 4) - 0.006]);
    const series = f.readings.map((r) => ({ date: r.date, value: r.greenness }));
    const allReal = f.readings.every((r) => r.source === "real");
    const someReal = f.readings.some((r) => r.source === "real");
    return {
      id: f.id,
      farmId: farmIdFor(f),
      name: f.name ?? `Field ${f.id}`,
      crop: "maize",
      growthStage: f.growthStage ?? "Not recorded",
      areaHa: areaHa(boundary),
      centroid: centroidOf(boundary),
      boundary,
      boundarySource: f.boundary.length >= 3 ? (fromFiles ? "data_file" : "builtin_sample") : "generated",
      lastObservationAt: new Date(`${f.readings[f.readings.length - 1].date}T10:00:00`).toISOString(),
      vegetationIndex: {
        source: allReal ? "sentinel2" : "simulated_index",
        label: allReal
          ? "NDVI from Sentinel-2 (data script)"
          : someReal
            ? "NDVI — mix of real Sentinel-2 and simulated readings"
            : "Simulated greenness (NDVI-like) — demo data",
        series,
      },
    };
  });
  farms.forEach((farm) => {
    const own = fields.filter((f) => f.farmId === farm.id);
    if (own.length) farm.location = centroidOf(own.map((f) => f.centroid));
  });

  // Weather (rainfall). Only rainfall is part of the contract.
  const weather: WeatherObservation[] = payload.weather.map((w) => ({
    date: w.date,
    precipitationMm: w.rainfallMm,
    source: fromFiles ? "weather_file" : "demo_sample",
  }));

  // --- detection → anomalies + open inspections
  const detections = detectChanges(inputs, payload.weather);
  const flagged = new Set(detections.map((d) => d.fieldId));
  const healthy = fields.filter((f) => !flagged.has(f.id));

  const anomalies: Anomaly[] = [];
  const inspections: InspectionTask[] = [];
  const observations: FieldObservation[] = [];
  const reports: InspectionReport[] = [];
  const activity: ActivityEvent[] = [];
  const lastInspectionDays = new Map<string, number>();
  let actN = 0;
  const ev = (daysAgo: number, hour: number, fieldId: string, type: ActivityEvent["type"], message: string, actor: string, inspectionId?: string) =>
    activity.push({ id: `act-${String(++actN).padStart(3, "0")}`, at: isoDaysAgo(now, daysAgo, hour), fieldId, type, message, actor, inspectionId });

  detections.forEach((d, i) => {
    const field = fields.find((f) => f.id === d.fieldId)!;
    const anomaly = anomalyFromDetection(d, `ANM-${2041 + i}`, field, now);
    anomalies.push(anomaly);
    const insId = `INS-${1312 + i}`;
    inspections.push({
      id: insId,
      fieldId: d.fieldId,
      anomalyIds: [anomaly.id],
      observationIds: [],
      title: d.severity === "low" ? "Routine check: slight greenness decline" : "Investigate greenness decline",
      reason:
        `${d.severity[0].toUpperCase()}${d.severity.slice(1)}-severity signal: greenness ${fmtPct(d.ownChangePct)} vs. its own recent weeks ` +
        `while other fields changed ${fmtPct(d.neighborChangePct)}.`,
      supportingObservations: [
        `Greenness ${d.baseline.toFixed(2)} → ${d.last.toFixed(2)} (${d.allReal ? "Sentinel-2" : "simulated data"}, last reading ${d.lastDate}).`,
        `Neighbor comparison: ${fmtPct(d.relativePct)} relative to the median of the other fields.`,
        ...(d.rain14dMm !== undefined ? [`Rainfall in the 14 days before the last reading: ${d.rain14dMm} mm.`] : []),
      ],
      suggestedChecks: anomaly.verifyOnSite.concat("Record findings and decide on follow-up.").map((label, j) => ({ id: `chk-${j + 1}`, label, done: false })),
      assigneeId: i === 0 ? undefined : "adv-amina",
      status: "open",
      createdAt: isoDaysAgo(now, 2, 8),
      updatedAt: isoDaysAgo(now, 2, 8),
      notes: [],
      photos: [],
    });
    lastInspectionDays.set(d.fieldId, i === 0 ? 26 : 15 + i);
    ev(2, 7, d.fieldId, "anomaly_flagged", `Greenness decline (${fmtPct(d.ownChangePct)}) flagged by change detection`, "FarmSignal detection");
    ev(2, 8, d.fieldId, "inspection_created", `Inspection created (${d.severity} severity)`, "FarmSignal rules", insId);
  });

  // Scenario: farmer report on the top flagged field
  const top = detections[0];
  if (top) {
    const obs: FieldObservation = {
      id: "OBS-3310",
      fieldId: top.fieldId,
      createdAt: isoDaysAgo(now, 1, 15),
      author: farms.find((fm) => fm.id === fields.find((f) => f.id === top.fieldId)!.farmId)!.ownerName,
      authorRole: "farmer",
      source: "farmer_report",
      category: "water_stress",
      description: "Leaves are rolling by midday in one part of the field and the plants look greyish-green. The rest looks normal.",
      inspectionId: "INS-1312",
    };
    observations.push(obs);
    const task = inspections[0];
    task.observationIds.push(obs.id);
    task.supportingObservations.push(`Farmer report (yesterday): leaves rolling by midday, greyish-green color in one part of the field.`);
    task.reason += " A farmer also reported leaf rolling.";
    task.updatedAt = obs.createdAt;
    ev(1, 15, top.fieldId, "observation_added", "Farmer reported leaf rolling", obs.author, task.id);
  }

  // Scenario: in-progress inspection from a ground report (first healthy field)
  const [h1, h2, h3] = healthy;
  if (h1) {
    anomalies.push({
      id: "ANM-2038",
      fieldId: h1.id,
      type: "reported_issue",
      detectedAt: isoDaysAgo(now, 4, 9),
      severity: "medium",
      status: "under_review",
      source: "farmer_report",
      observed: "Farmer reported shorter plants and gaps in the rows in the lower part of the field.",
      whyItMatters: "Uneven stands reduce yield. Not visible in the field-average greenness, so it needs a ground check.",
      possibleExplanations: ["Waterlogging or a different soil patch.", "Uneven emergence after planting (seed depth, crusting).", "Damage by animals."],
      confidence: "low",
      confidenceNote: "Single ground report; not yet verified.",
      verifyOnSite: ["Compare plant height and stand count in the lower part vs. the rest.", "Check for standing water or compacted soil."],
      nextAction: "Complete the ongoing inspection and record stand counts.",
      location: h1.centroid,
    });
    observations.push({
      id: "OBS-3302",
      fieldId: h1.id,
      createdAt: isoDaysAgo(now, 4, 9),
      author: farms.find((fm) => fm.id === h1.farmId)!.ownerName,
      authorRole: "farmer",
      source: "farmer_report",
      category: "unusual_growth",
      description: "Plants in the lower part of the field are shorter and there are gaps in some rows.",
      inspectionId: "INS-1309",
    });
    inspections.push({
      id: "INS-1309",
      fieldId: h1.id,
      anomalyIds: ["ANM-2038"],
      observationIds: ["OBS-3302"],
      title: "Check uneven growth reported by farmer",
      reason: "Farmer reported shorter plants and gaps in rows. Field-average greenness looks normal, so this needs a ground check.",
      supportingObservations: ["Farmer report: shorter plants and gaps in rows in the lower part of the field."],
      suggestedChecks: [
        { id: "chk-1", label: "Compare plant height and stand count in the lower part vs. the rest.", done: true },
        { id: "chk-2", label: "Check for standing water or compacted soil.", done: false },
        { id: "chk-3", label: "Photograph a representative row.", done: false },
      ],
      assigneeId: "adv-peter",
      status: "in_progress",
      createdAt: isoDaysAgo(now, 4, 10),
      updatedAt: isoDaysAgo(now, 1, 10),
      startedAt: isoDaysAgo(now, 1, 10),
      notes: [
        {
          id: "note-1",
          at: isoDaysAgo(now, 1, 10),
          author: "Peter Otieno",
          text: "Started walking the field. Soil in the lower part is noticeably wetter; continuing stand counts tomorrow.",
        },
      ],
      photos: [],
    });
    lastInspectionDays.set(h1.id, 18);
    ev(4, 9, h1.id, "observation_added", "Farmer reported uneven growth", farms.find((fm) => fm.id === h1.farmId)!.ownerName, "INS-1309");
    ev(1, 10, h1.id, "inspection_started", "Inspection started", "Peter Otieno", "INS-1309");
  }

  // Scenario: completed inspections (history)
  const completed = (
    field: Field | undefined,
    daysAgo: number,
    insId: string,
    rptId: string,
    anmId: string,
    adviser: string,
    outcome: InspectionReport["outcome"],
    title: string,
    observed: string,
    findings: string,
    recommendation: string,
  ) => {
    if (!field) return;
    anomalies.push({
      id: anmId,
      fieldId: field.id,
      type: "reported_issue",
      detectedAt: isoDaysAgo(now, daysAgo + 2, 8),
      severity: "medium",
      status: outcome === "issue_confirmed" ? "confirmed" : "dismissed",
      source: "farmer_report",
      observed,
      whyItMatters: "Needed a ground check to decide whether action is required.",
      possibleExplanations: [],
      confidence: "low",
      confidenceNote: "Single report.",
      verifyOnSite: ["Inspect the reported area."],
      nextAction: recommendation,
      location: field.centroid,
    });
    inspections.push({
      id: insId,
      fieldId: field.id,
      anomalyIds: [anmId],
      observationIds: [],
      title,
      reason: observed,
      supportingObservations: [observed],
      suggestedChecks: [
        { id: "chk-1", label: "Inspect the reported area.", done: true },
        { id: "chk-2", label: "Count affected plants.", done: true },
      ],
      assigneeId: adviser,
      status: "completed",
      createdAt: isoDaysAgo(now, daysAgo + 2, 9),
      updatedAt: isoDaysAgo(now, daysAgo, 13),
      startedAt: isoDaysAgo(now, daysAgo, 10),
      completedAt: isoDaysAgo(now, daysAgo, 13),
      notes: [],
      photos: [],
      reportId: rptId,
    });
    const author = advisers.find((a) => a.id === adviser)!.name;
    reports.push({
      id: rptId,
      inspectionId: insId,
      fieldId: field.id,
      createdAt: isoDaysAgo(now, daysAgo, 13),
      author,
      outcome,
      confirmedFindings: findings,
      recommendation,
      photos: [],
      checksCompleted: ["Inspect the reported area.", "Count affected plants."],
    });
    lastInspectionDays.set(field.id, daysAgo);
    ev(daysAgo, 13, field.id, "inspection_completed", `Inspection completed — ${outcome === "issue_confirmed" ? "issue confirmed on site" : "no crop issue found"}`, author, insId);
  };
  completed(
    h2, 3, "INS-1305", "RPT-0907", "ANM-2029", "adv-amina", "no_issue_found",
    "Check reported patch of yellow plants",
    "Farmer reported a patch of yellowish plants near the path.",
    "The patch is dominated by weeds (couch grass). Maize plants there are healthy in color and stand.",
    "Schedule weeding of the patch. No crop-health follow-up needed.",
  );
  completed(
    h3, 9, "INS-1298", "RPT-0899", "ANM-2017", "adv-grace", "issue_confirmed",
    "Verify reported leaf damage",
    "Farmer reported ragged holes in young leaves and sawdust-like residue in the whorls.",
    "Larvae and fresh whorl feeding damage found on 6 of 50 scouted plants (12%), concentrated on one side of the field.",
    "Re-scout in 7 days; discuss control options with the cooperative agronomist if damage exceeds local thresholds.",
  );

  observations.forEach((o) => {
    const f = fields.find((x) => x.id === o.fieldId);
    if (f && o.createdAt > f.lastObservationAt) f.lastObservationAt = o.createdAt;
  });

  const defaultDays = [12, 20, 15, 30, 10, 22, 14, 25];
  fields.forEach((f, i) => {
    f.lastInspectionAt = isoDaysAgo(now, lastInspectionDays.get(f.id) ?? defaultDays[i % defaultDays.length], 11);
  });

  return {
    version: STATE_VERSION,
    seededAt: now.toISOString(),
    cooperative: {
      name: "Nzoia Valley Maize Cooperative",
      region: fromFiles ? "Trans-Nzoia, Kenya · simulated outlines" : "Trans-Nzoia, Kenya",
      fictional: true,
      center,
    },
    advisers,
    farms,
    fields,
    anomalies,
    observations,
    inspections,
    reports,
    weather,
    activity: activity.sort((a, b) => b.at.localeCompare(a.at)),
    settings: { currentUserId: "adv-grace", liveWeather: false },
    data: { hash: hashPayload(payload), origin: payload.origin, warnings: payload.warnings, payload },
  };
}
