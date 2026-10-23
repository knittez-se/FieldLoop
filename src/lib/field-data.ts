/**
 * The data contract with the data script (see MVP.md / docs/DATA_SCRIPT_HANDOUT.md).
 *
 *   data/fields.geojson     one polygon per field, property `field_id` (optional: `name`, `farm`, `growth_stage`)
 *   data/field_scores.csv   field_id,date,greenness,source     (source = real | simulated)
 *   data/weather.csv        date,rainfall_mm                   (daily rain for the demo area)
 *
 * The server route `/api/field-data` reads these files and returns a `FieldDataPayload`.
 * If the files are missing, the built-in sample (`builtin-field-data.ts`) is used instead.
 */
import type { LatLng } from "./types";

export interface Reading {
  date: string; // YYYY-MM-DD
  greenness: number; // NDVI 0..1
  source: "real" | "simulated";
}

export interface FieldInput {
  id: string;
  name?: string;
  farm?: string;
  crop?: string;
  growthStage?: string;
  /** Showcase only: which demo story the field plays ("in_progress" | "no_issue" | "recovered"). */
  scenario?: string;
  /** [lat, lng] pairs. Empty if the field has no outline in fields.geojson. */
  boundary: LatLng[];
  readings: Reading[];
}

export interface RainfallRow {
  date: string;
  rainfallMm: number;
}

export interface FieldDataPayload {
  /** Where the data came from. */
  origin: "data_files" | "built_in";
  fields: FieldInput[];
  weather: RainfallRow[];
  /** Problems found while reading the files (shown in Settings). */
  warnings: string[];
}

/** Stable fingerprint of the data so the app knows when the files changed. */
export function hashPayload(p: FieldDataPayload): string {
  const s = JSON.stringify([p.origin, p.fields, p.weather]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${p.origin}:${(h >>> 0).toString(36)}:${s.length}`;
}

// ---------------------------------------------------------------------------
// Parsers (used by the server route; pure functions so they are easy to test)

function splitCsvLine(line: string): string[] {
  // Simple CSV: no quoted commas expected in this contract.
  return line.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { header: [], rows: [] };
  return { header: splitCsvLine(lines[0]).map((h) => h.toLowerCase()), rows: lines.slice(1).map(splitCsvLine) };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFieldScores(text: string, warnings: string[]): Map<string, Reading[]> {
  const { header, rows } = parseCsv(text);
  const idx = (name: string) => header.indexOf(name);
  const [iId, iDate, iG, iSrc] = [idx("field_id"), idx("date"), idx("greenness"), idx("source")];
  const result = new Map<string, Reading[]>();
  if (iId < 0 || iDate < 0 || iG < 0) {
    warnings.push("field_scores.csv: expected columns field_id,date,greenness,source");
    return result;
  }
  let skipped = 0;
  rows.forEach((r) => {
    const id = r[iId];
    const date = (r[iDate] ?? "").slice(0, 10);
    const g = Number(r[iG]);
    if (!id || !DATE_RE.test(date) || !Number.isFinite(g) || g < -1 || g > 1) {
      skipped++;
      return;
    }
    const src = (iSrc >= 0 ? r[iSrc] : "").toLowerCase() === "real" ? "real" : "simulated";
    const list = result.get(id) ?? [];
    list.push({ date, greenness: +g.toFixed(4), source: src });
    result.set(id, list);
  });
  if (skipped) warnings.push(`field_scores.csv: skipped ${skipped} invalid row(s)`);
  if (iSrc < 0) warnings.push("field_scores.csv: no source column — all readings treated as simulated");
  // Sort by date and average several readings on the same date (e.g. two images in one week).
  let merged = 0;
  result.forEach((list, id) => {
    const byDate = new Map<string, Reading[]>();
    list.forEach((r) => byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]));
    if (byDate.size < list.length) merged += list.length - byDate.size;
    result.set(
      id,
      [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, rs]) => ({
          date,
          greenness: +(rs.reduce((s, r) => s + r.greenness, 0) / rs.length).toFixed(4),
          source: rs.every((r) => r.source === "real") ? "real" : "simulated",
        })),
    );
  });
  if (merged) warnings.push(`field_scores.csv: averaged ${merged} duplicate reading(s) on the same field and date`);
  return result;
}

export function parseWeather(text: string, warnings: string[]): RainfallRow[] {
  const { header, rows } = parseCsv(text);
  const iDate = header.indexOf("date");
  const iRain = header.indexOf("rainfall_mm");
  if (iDate < 0 || iRain < 0) {
    warnings.push("weather.csv: expected columns date,rainfall_mm");
    return [];
  }
  return rows
    .map((r) => ({ date: (r[iDate] ?? "").slice(0, 10), rainfallMm: Number(r[iRain]) }))
    .filter((r) => DATE_RE.test(r.date) && Number.isFinite(r.rainfallMm))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface GeoFeature {
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string; coordinates?: unknown } | null;
}

/** Returns field outlines keyed by field_id. Uses the outer ring of the first polygon. */
export function parseFieldsGeojson(
  text: string,
  warnings: string[],
): Map<string, { boundary: LatLng[]; name?: string; farm?: string; crop?: string; growthStage?: string }> {
  const result = new Map<string, { boundary: LatLng[]; name?: string; farm?: string; crop?: string; growthStage?: string }>();
  let json: { features?: GeoFeature[] };
  try {
    json = JSON.parse(text);
  } catch {
    warnings.push("fields.geojson: not valid JSON");
    return result;
  }
  (json.features ?? []).forEach((f, i) => {
    const props = f.properties ?? {};
    const id = props.field_id ?? props.id;
    if (typeof id !== "string" && typeof id !== "number") {
      warnings.push(`fields.geojson: feature ${i + 1} has no field_id`);
      return;
    }
    const g = f.geometry;
    let ring: unknown;
    if (g?.type === "Polygon") ring = (g.coordinates as unknown[])?.[0];
    else if (g?.type === "MultiPolygon") ring = (g.coordinates as unknown[][])?.[0]?.[0];
    const coords = Array.isArray(ring)
      ? (ring as unknown[])
          .filter((c): c is [number, number] => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
          .map(([lng, lat]) => [lat, lng] as LatLng)
      : [];
    if (coords.length < 3) warnings.push(`fields.geojson: field ${id} has no usable polygon`);
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    result.set(String(id), {
      boundary: coords.length >= 3 ? coords : [],
      name: str(props.name),
      farm: str(props.farm) ?? str(props.farm_name),
      crop: str(props.crop)?.toLowerCase(),
      growthStage: str(props.growth_stage),
    });
  });
  return result;
}
