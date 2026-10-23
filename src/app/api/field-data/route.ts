import { promises as fs } from "node:fs";
import path from "node:path";
import { BUILTIN_FIELD_DATA } from "@/lib/builtin-field-data";
import {
  parseFieldScores,
  parseFieldsGeojson,
  parseWeather,
  type FieldDataPayload,
  type FieldInput,
} from "@/lib/field-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");

async function readOptional(file: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(DATA_DIR, file), "utf8");
  } catch {
    return null;
  }
}

/**
 * GET /api/field-data
 * Reads data/field_scores.csv, data/fields.geojson and data/weather.csv (the data contract).
 * Falls back to the built-in sample when field_scores.csv is missing.
 */
export async function GET() {
  const [scoresText, geoText, weatherText] = await Promise.all([
    readOptional("field_scores.csv"),
    readOptional("fields.geojson"),
    readOptional("weather.csv"),
  ]);

  if (!scoresText) {
    return Response.json(BUILTIN_FIELD_DATA);
  }

  const warnings: string[] = [];
  const scores = parseFieldScores(scoresText, warnings);
  const shapes = geoText ? parseFieldsGeojson(geoText, warnings) : new Map();
  if (!geoText) warnings.push("data/fields.geojson not found — fields are shown as placeholder squares.");

  let weather = weatherText ? parseWeather(weatherText, warnings) : [];
  if (!weatherText) warnings.push("data/weather.csv not found — using built-in sample rainfall.");
  if (weather.length === 0) weather = BUILTIN_FIELD_DATA.weather;

  const ids = Array.from(new Set([...scores.keys()]));
  shapes.forEach((_, id) => {
    if (!scores.has(id)) warnings.push(`Field ${id} has an outline but no greenness readings — skipped.`);
  });
  const fields: FieldInput[] = ids
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((id) => {
      const shape = shapes.get(id);
      if (geoText && !shape) warnings.push(`Field ${id} has readings but no outline in fields.geojson.`);
      return {
        id,
        name: shape?.name,
        farm: shape?.farm,
        crop: shape?.crop,
        growthStage: shape?.growthStage,
        boundary: shape?.boundary ?? [],
        readings: scores.get(id) ?? [],
      };
    });

  const payload: FieldDataPayload = { origin: "data_files", fields, weather, warnings };
  return Response.json(payload);
}
