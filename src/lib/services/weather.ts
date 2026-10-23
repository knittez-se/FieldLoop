/**
 * Weather integration (server-side): Open-Meteo forecast API — free, no API key.
 * Docs: https://open-meteo.com/en/docs
 *
 * Returns the last 14 days of daily values. If the request fails, the caller
 * falls back to the sample weather in demo-data.ts (and labels it as such).
 */
import type { WeatherObservation } from "../types";

interface OpenMeteoDaily {
  daily?: {
    time?: string[];
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
  };
}

export async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherObservation[]> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lng.toFixed(4));
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("past_days", "13");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } } as RequestInit);
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const json = (await res.json()) as OpenMeteoDaily;
  const d = json.daily;
  if (!d?.time?.length) throw new Error("Open-Meteo returned no daily data");

  return d.time.map((date, i) => ({
    date,
    tempMaxC: d.temperature_2m_max?.[i] ?? NaN,
    tempMinC: d.temperature_2m_min?.[i] ?? NaN,
    precipitationMm: d.precipitation_sum?.[i] ?? 0,
    source: "open_meteo" as const,
  })).filter((w) => Number.isFinite(w.tempMaxC));
}
