"""
Test that we can get real satellite numbers for our fields, before building the real script.

Uses Microsoft Planetary Computer (free, no account or API key):
  1. Search its catalog for Sentinel-2 L2A images over our fields from the last 10 weeks.
  2. Print every image found, with its date and how cloudy it was.
  3. For the clearest recent image, ask their server for one field's average NDVI, and
     for the cloud-check layer (SCL) inside that field.

Their server does the pixel maths and sends back only the numbers, so we never
download whole satellite images. (Reading the images on this laptop is blocked by
Windows Smart App Control, which is why we don't use Earth Search plus rasterio.)

Run from the repo root:
    python scripts/test_access.py
"""

import json
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

from pystac_client import Client

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CATALOG = "https://planetarycomputer.microsoft.com/api/stac/v1"
STATS_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/statistics"
CLEAR_ENOUGH = 20  # images with less than 20% cloud count as clear

# What the numbers in the SCL (scene classification) layer mean.
SCL_NAMES = {0: "no data", 1: "saturated", 2: "dark area", 3: "cloud shadow", 4: "vegetation",
             5: "bare soil", 6: "water", 7: "unclassified", 8: "cloud (medium)", 9: "cloud (high)",
             10: "thin cirrus", 11: "snow"}


def field_stats(item_id, field, **params):
    """Send one field outline to Planetary Computer and get back statistics for one image."""
    query = urllib.parse.urlencode({"collection": "sentinel-2-l2a", "item": item_id, **params})
    request = urllib.request.Request(f"{STATS_URL}?{query}", json.dumps(field).encode(),
                                     {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=120) as response:
        stats = json.load(response)["properties"]["statistics"]
    return next(iter(stats.values()))  # one band in, one set of statistics out


def main():
    fields = json.loads((DATA_DIR / "fields.geojson").read_text())["features"]

    # A box around all fields: smallest and largest longitude and latitude.
    points = [p for f in fields for p in f["geometry"]["coordinates"][0]]
    bbox = [min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)]

    # Step 1: search the catalog.
    end = date.today()
    start = end - timedelta(weeks=10)
    catalog = Client.open(CATALOG)
    search = catalog.search(collections=["sentinel-2-l2a"], bbox=bbox, datetime=f"{start}/{end}")
    images = sorted(search.items(), key=lambda item: item.datetime)

    # Step 2: list them.
    print(f"Found {len(images)} Sentinel-2 images over our fields from {start} to {end}:")
    for item in images:
        cloud = item.properties["eo:cloud_cover"]
        print(f"  {item.datetime.date()}  {cloud:5.1f}% cloud  {'clear' if cloud < CLEAR_ENOUGH else ''}")
    clear = [item for item in images if item.properties["eo:cloud_cover"] < CLEAR_ENOUGH]
    print(f"{len(clear)} of them are under {CLEAR_ENOUGH}% cloud.")
    if not clear:
        print("No clear images, so nothing to test further. Try a longer date range.")
        return

    # Step 3: real numbers for one field from the newest clear image.
    item, field = clear[-1], fields[0]
    field_id = field["properties"]["field_id"]
    print(f"\nAsking for {field_id} in the image from {item.datetime.date()} ({item.id})...")

    # NDVI = (NIR - red) / (NIR + red). On Sentinel-2, B08 is near-infrared and B04 is red.
    ndvi = field_stats(item.id, field, expression="(B08-B04)/(B08+B04)", asset_as_band="true")
    print(f"  {field_id} average NDVI: {ndvi['mean']:.3f} (from {ndvi['count']:.0f} pixels, "
          f"lowest {ndvi['min']:.2f}, highest {ndvi['max']:.2f})")

    # The SCL layer says, per pixel, whether it is vegetation, soil, cloud, shadow and so on.
    scl = field_stats(item.id, field, assets="SCL", categorical="true")
    counts, values = scl["histogram"]
    total = sum(counts)
    print(f"  What the pixels in {field_id} are, according to the SCL layer:")
    for count, value in zip(counts, values):
        if count:
            print(f"    {SCL_NAMES.get(int(value), value)}: {count / total:.0%}")

    print("\nSatellite access works.")


if __name__ == "__main__":
    main()
