import { fetchOpenMeteo } from "@/lib/services/weather";

export const dynamic = "force-dynamic";

/** GET /api/weather?lat=..&lng=.. → { source: "open_meteo", series } or { source: "unavailable", error } */
export async function GET(req: Request) {
  if (process.env.LIVE_WEATHER === "false") {
    return Response.json({ source: "unavailable", error: "Live weather disabled via LIVE_WEATHER=false" });
  }
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ source: "unavailable", error: "Invalid coordinates" }, { status: 400 });
  }
  try {
    const series = await fetchOpenMeteo(lat, lng);
    return Response.json({ source: "open_meteo", series });
  } catch (err) {
    return Response.json({ source: "unavailable", error: err instanceof Error ? err.message : "Weather lookup failed" });
  }
}
