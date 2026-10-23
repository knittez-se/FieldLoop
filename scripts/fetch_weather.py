"""
Download daily rainfall for our fields from Open-Meteo and save data/weather.csv.

Open-Meteo is a free weather service with no API key. Its "archive" endpoint gives
past weather for any point on Earth. We ask for the middle of our 8 fields, for the
same 10 weeks the satellite script covers, up to yesterday (so every day is complete).

Run from the repo root:
    python scripts/fetch_weather.py
"""

import csv
import json
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WEEKS = 10  # keep in step with build_field_scores.py


def main():
    fields = json.loads((DATA_DIR / "fields.geojson").read_text())["features"]
    points = [p for f in fields for p in f["geometry"]["coordinates"][0]]
    lng = sum(p[0] for p in points) / len(points)  # rough middle of all fields
    lat = sum(p[1] for p in points) / len(points)

    end = date.today() - timedelta(days=1)
    start = date.today() - timedelta(weeks=WEEKS)
    query = urllib.parse.urlencode({
        "latitude": round(lat, 4), "longitude": round(lng, 4),
        "start_date": start, "end_date": end,
        "daily": "precipitation_sum", "timezone": "Africa/Nairobi",
    })
    with urllib.request.urlopen(f"https://archive-api.open-meteo.com/v1/archive?{query}", timeout=60) as response:
        daily = json.load(response)["daily"]

    rows = [{"date": day, "rainfall_mm": rain} for day, rain in zip(daily["time"], daily["precipitation_sum"])]
    missing = sum(1 for r in rows if r["rainfall_mm"] is None)

    with open(DATA_DIR / "weather.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["date", "rainfall_mm"])
        writer.writeheader()
        writer.writerows(rows)

    total = sum(r["rainfall_mm"] or 0 for r in rows)
    print(f"Wrote {len(rows)} days ({start} to {end}) to data/weather.csv, {total:.0f} mm of rain in total.")
    if missing:
        print(f"Warning: {missing} days have no value yet (left empty in the file).")


if __name__ == "__main__":
    main()
