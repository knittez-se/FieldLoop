"""
Make fake (simulated) data so the app can be built before real satellite data exists.

Creates three files in data/:
  fields.geojson    8 rectangular field outlines next to each other
  field_scores.csv  10 weekly greenness (NDVI) readings per field
  weather.csv       daily rainfall for the same 10 weeks

Every score row is labeled source=simulated, so the app can show a "simulated" badge.

Run from the repo root:
    python scripts/make_sample_data.py
"""

import csv
import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

# Same seed = same "random" numbers every run, so the files don't change for no reason.
random.seed(42)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Demo area: maize farmland near Kitale, Trans-Nzoia, Kenya (same region as the app).
# This is the south-west corner of our block of fields.
ORIGIN_LAT, ORIGIN_LNG = 1.0150, 34.9900

# Each field is 200 m wide and 150 m tall (3 hectares, about 300 satellite pixels).
FIELD_W_M, FIELD_H_M, GAP_M = 200, 150, 20
COLUMNS = 4  # 8 fields laid out as 2 rows of 4

WEEKS = 10
LAST_READING = date(2026, 10, 21)  # date of the newest weekly reading

# The two problem fields we plant on purpose so the demo has something to find.
# Numbers are how much greenness drops in each of the last 3 weeks.
BIG_DROP = {"F3": [0.10, 0.20, 0.30]}    # clear problem: falls hard
SMALL_DROP = {"F6": [0.04, 0.08, 0.12]}  # milder problem: worth a look


def meters_to_degrees(dx_m, dy_m):
    """Turn a distance in meters into a change in longitude/latitude near our area."""
    m_per_deg_lat = 111_320
    m_per_deg_lng = 111_320 * math.cos(math.radians(ORIGIN_LAT))
    return dx_m / m_per_deg_lng, dy_m / m_per_deg_lat


def make_fields():
    """Build 8 rectangles in a grid. Returns a GeoJSON FeatureCollection (a dict)."""
    features = []
    for i in range(8):
        row, col = divmod(i, COLUMNS)
        # Bottom-left corner of this field, in meters from the origin.
        x0 = col * (FIELD_W_M + GAP_M)
        y0 = row * (FIELD_H_M + GAP_M)
        corners_m = [(x0, y0), (x0 + FIELD_W_M, y0), (x0 + FIELD_W_M, y0 + FIELD_H_M), (x0, y0 + FIELD_H_M), (x0, y0)]
        ring = []
        for x, y in corners_m:
            dlng, dlat = meters_to_degrees(x, y)
            # GeoJSON wants [longitude, latitude], in that order.
            ring.append([round(ORIGIN_LNG + dlng, 6), round(ORIGIN_LAT + dlat, 6)])
        features.append({
            "type": "Feature",
            "properties": {"field_id": f"F{i + 1}", "crop": "maize", "source": "simulated"},
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        })
    return {"type": "FeatureCollection", "features": features}


def make_scores(field_ids):
    """10 weekly greenness numbers per field. Healthy fields wobble a little; problem fields drop."""
    dates = [LAST_READING - timedelta(weeks=WEEKS - 1 - w) for w in range(WEEKS)]
    rows = []
    for field_id in field_ids:
        base = random.uniform(0.62, 0.72)  # this field's normal greenness
        drops = BIG_DROP.get(field_id) or SMALL_DROP.get(field_id) or [0, 0, 0]
        for w, d in enumerate(dates):
            value = base + random.uniform(-0.02, 0.02)  # small natural wobble
            weeks_from_end = WEEKS - 1 - w  # 0 = newest week
            if weeks_from_end < 3:
                value -= drops[2 - weeks_from_end]
            rows.append({"field_id": field_id, "date": d.isoformat(), "greenness": round(value, 3), "source": "simulated"})
    return rows


def make_weather():
    """Daily rain for the 10 weeks. Normal rain early on, almost dry in the last 3 weeks (the drop)."""
    first_day = LAST_READING - timedelta(weeks=WEEKS - 1, days=6)
    dry_from = LAST_READING - timedelta(weeks=3)
    rows = []
    day = first_day
    while day <= LAST_READING:
        if day > dry_from:
            rain = random.choice([0, 0, 0, 0, 0, 0.5, 1.2])  # dry spell
        else:
            rain = random.uniform(2, 14) if random.random() < 0.5 else 0  # rain about every other day
        rows.append({"date": day.isoformat(), "rainfall_mm": round(rain, 1)})
        day += timedelta(days=1)
    return rows


def write_csv(path, rows):
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def main():
    DATA_DIR.mkdir(exist_ok=True)

    fields = make_fields()
    field_ids = [f["properties"]["field_id"] for f in fields["features"]]
    scores = make_scores(field_ids)
    weather = make_weather()

    # Quick sanity checks: if one of these fails, the files would break the app.
    assert len(scores) == len(field_ids) * WEEKS
    assert all(0 <= r["greenness"] <= 1 for r in scores)
    newest = {r["field_id"]: r["greenness"] for r in scores if r["date"] == LAST_READING.isoformat()}
    assert newest["F3"] < newest["F6"] < min(v for k, v in newest.items() if k not in ("F3", "F6"))

    (DATA_DIR / "fields.geojson").write_text(json.dumps(fields, indent=2))
    write_csv(DATA_DIR / "field_scores.csv", scores)
    write_csv(DATA_DIR / "weather.csv", weather)

    print(f"Wrote {len(field_ids)} fields, {len(scores)} score rows, {len(weather)} weather days to {DATA_DIR}")
    print("Newest greenness:", ", ".join(f"{k}={v}" for k, v in newest.items()))


if __name__ == "__main__":
    main()
