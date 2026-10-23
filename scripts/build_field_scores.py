"""
Build data/field_scores.csv from real Sentinel-2 satellite images.

For every field in data/fields.geojson and every image from the last 10 weeks:
  1. Ask Planetary Computer which share of the field's pixels are clear. The SCL
     (scene classification) layer labels each pixel as vegetation, soil, cloud,
     shadow and so on. If clouds or shadows cover too much of the field, skip that
     image for that field, so a cloud never looks like a dying field.
  2. If it is clear, ask for the field's average NDVI: (NIR - red) / (NIR + red).
  3. Keep one reading per field per week: the clearest one (latest if tied).

All pixel maths happens on Planetary Computer's server; we only receive numbers.

Run from the repo root (takes a few minutes):
    python scripts/build_field_scores.py
"""

import csv
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

from pystac_client import Client

from test_access import CATALOG, field_stats

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WEEKS = 10
MAX_SCENE_CLOUD = 60  # skip images that are mostly cloud over the whole 100 km tile
MIN_CLEAR_SHARE = 0.9  # a field needs at least 90% clear pixels in an image to count
CLEAR_CLASSES = {4, 5}  # SCL codes for vegetation and bare soil: what a clear field looks like


def with_retries(call, *args, **kwargs):
    """The server sometimes hiccups. Try up to 3 times before giving up."""
    for attempt in range(3):
        try:
            return call(*args, **kwargs)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def reading(item, field):
    """One image + one field -> (clear share, NDVI), or (clear share, None) if too cloudy."""
    scl = with_retries(field_stats, item.id, field, assets="SCL", categorical="true")
    counts, values = scl["histogram"]
    clear_share = sum(c for c, v in zip(counts, values) if int(v) in CLEAR_CLASSES) / sum(counts)
    if clear_share < MIN_CLEAR_SHARE:
        return clear_share, None
    ndvi = with_retries(field_stats, item.id, field, expression="(B08-B04)/(B08+B04)", asset_as_band="true")
    return clear_share, ndvi["mean"]


def main():
    fields = json.loads((DATA_DIR / "fields.geojson").read_text())["features"]
    field_ids = [f["properties"]["field_id"] for f in fields]
    points = [p for f in fields for p in f["geometry"]["coordinates"][0]]
    bbox = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]

    end = date.today()
    start = end - timedelta(weeks=WEEKS)
    search = Client.open(CATALOG).search(collections=["sentinel-2-l2a"], bbox=bbox, datetime=f"{start}/{end}",
                                         query={"eo:cloud_cover": {"lt": MAX_SCENE_CLOUD}})
    images = sorted(search.items(), key=lambda item: item.datetime)
    print(f"Checking {len(images)} images x {len(fields)} fields ({start} to {end})...")

    # best[(field_id, week)] = (clear share, date, ndvi): the clearest reading in that week so far.
    best = {}
    skipped = 0
    for item in images:
        day = item.datetime.date()
        # Ask about all 8 fields at the same time instead of one after another.
        with ThreadPoolExecutor(max_workers=len(fields)) as pool:
            results = list(pool.map(lambda f: reading(item, f), fields))
        line = []
        for field_id, (clear_share, ndvi) in zip(field_ids, results):
            if ndvi is None:
                skipped += 1
                line.append(f"{field_id}=cloud")
                continue
            line.append(f"{field_id}={ndvi:.2f}")
            week = day.isocalendar()[:2]  # (year, week number)
            key = (field_id, week)
            if key not in best or (clear_share, day) >= best[key][:2]:
                best[key] = (clear_share, day, ndvi)
        print(f"  {day}: {' '.join(line)}")

    rows = [{"field_id": field_id, "date": day.isoformat(), "greenness": round(min(max(ndvi, 0), 1), 3), "source": "real"}
            for (field_id, _), (_, day, ndvi) in sorted(best.items(), key=lambda kv: (kv[0][0], kv[1][1]))]

    with open(DATA_DIR / "field_scores.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["field_id", "date", "greenness", "source"])
        writer.writeheader()
        writer.writerows(rows)

    # Short summary, so we can see at a glance how complete the data is.
    weeks_with_data = {fid: sum(1 for r in rows if r["field_id"] == fid) for fid in field_ids}
    print(f"\nWrote {len(rows)} rows to data/field_scores.csv from {len(images)} images.")
    print(f"Skipped {skipped} field readings because of clouds or shadows.")
    print("Weeks with a reading per field: " + ", ".join(f"{k}={v}" for k, v in weeks_with_data.items()))


if __name__ == "__main__":
    main()
