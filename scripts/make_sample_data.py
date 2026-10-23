"""
Make fake (simulated) data so the app can be built before real satellite data exists.

Reads the real field outlines in data/fields.geojson (8 plots west of Kitale, traced
by hand over satellite photos) and creates two files in data/:
  field_scores.csv  10 weekly greenness (NDVI) readings per field
  weather.csv       daily rainfall for the same 10 weeks

Every score row is labeled source=simulated, so the app can show a "simulated" badge.

Run from the repo root:
    python scripts/make_sample_data.py
"""

import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

# Same seed = same "random" numbers every run, so the files don't change for no reason.
random.seed(42)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

WEEKS = 10
LAST_READING = date(2026, 10, 21)  # date of the newest weekly reading

# The two problem fields we plant on purpose so the demo has something to find.
# Numbers are how much greenness drops in each of the last 3 weeks.
BIG_DROP = {"F3": [0.10, 0.20, 0.30]}    # clear problem: falls hard
SMALL_DROP = {"F6": [0.04, 0.08, 0.12]}  # milder problem: worth a look


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
    fields = json.loads((DATA_DIR / "fields.geojson").read_text())
    field_ids = [f["properties"]["field_id"] for f in fields["features"]]
    scores = make_scores(field_ids)
    weather = make_weather()

    # Quick sanity checks: if one of these fails, the files would break the app.
    assert len(scores) == len(field_ids) * WEEKS
    assert all(0 <= r["greenness"] <= 1 for r in scores)
    newest = {r["field_id"]: r["greenness"] for r in scores if r["date"] == LAST_READING.isoformat()}
    assert newest["F3"] < newest["F6"] < min(v for k, v in newest.items() if k not in ("F3", "F6"))

    write_csv(DATA_DIR / "field_scores.csv", scores)
    write_csv(DATA_DIR / "weather.csv", weather)

    print(f"Read {len(field_ids)} fields, wrote {len(scores)} score rows, {len(weather)} weather days to {DATA_DIR}")
    print("Newest greenness:", ", ".join(f"{k}={v}" for k, v in newest.items()))


if __name__ == "__main__":
    main()
