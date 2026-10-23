"""
Make two images for the pitch and README, from the files in data/:
  docs/images/greenness_chart.png  F1 against the other 7 fields, plus weekly rain
  docs/images/field_map.png        the 8 field outlines on the newest clear Sentinel-2 photo

Rerun after refreshing the data:
    python scripts/make_pitch_images.py
"""

import csv
import io
import json
import urllib.request
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # draw straight to a file, no window
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw, ImageFont
from pystac_client import Client

from test_access import CATALOG

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR, OUT_DIR = ROOT / "data", ROOT / "docs" / "images"

PROBLEM_FIELD = "F1"
# Colors: one highlight, everything else recessive grey.
SURFACE, TEXT, TEXT_2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e8e7e3"
HIGHLIGHT, OTHERS, RAIN = "#2a78d6", "#b5b4ad", "#9a9993"


def greenness_chart():
    series = defaultdict(list)  # field_id -> [(date, greenness, source)]
    for row in csv.DictReader(open(DATA_DIR / "field_scores.csv")):
        series[row["field_id"]].append((date.fromisoformat(row["date"]), float(row["greenness"]), row["source"]))
    weekly_rain = defaultdict(float)  # Monday of the week -> mm
    for row in csv.DictReader(open(DATA_DIR / "weather.csv")):
        d = date.fromisoformat(row["date"])
        weekly_rain[date.fromordinal(d.toordinal() - d.weekday())] += float(row["rainfall_mm"] or 0)

    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 13, "text.color": TEXT,
                         "axes.labelcolor": TEXT_2, "xtick.color": TEXT_2, "ytick.color": TEXT_2})
    fig, (top, bottom) = plt.subplots(2, 1, figsize=(16, 9), sharex=True, facecolor=SURFACE,
                                      gridspec_kw={"height_ratios": [3, 1], "hspace": 0.12})
    for ax in (top, bottom):
        ax.set_facecolor(SURFACE)
        ax.grid(axis="y", color=GRID, linewidth=1)
        ax.set_axisbelow(True)
        for side in ("top", "right", "left"):
            ax.spines[side].set_visible(False)
        ax.spines["bottom"].set_color(GRID)
        ax.tick_params(length=0)

    # The other 7 fields: thin grey lines, all real data.
    for field_id, points in series.items():
        if field_id != PROBLEM_FIELD:
            top.plot([p[0] for p in points], [p[1] for p in points], color=OTHERS, linewidth=1.5, zorder=2)

    # F1: solid while real, dashed where simulated (the dashed part starts at the last real point).
    points = series[PROBLEM_FIELD]
    real = [p for p in points if p[2] == "real"]
    simulated = [real[-1]] + [p for p in points if p[2] == "simulated"]
    top.plot([p[0] for p in real], [p[1] for p in real], color=HIGHLIGHT, linewidth=3, zorder=3)
    top.plot([p[0] for p in simulated], [p[1] for p in simulated], color=HIGHLIGHT, linewidth=3,
             linestyle=(0, (4, 3)), zorder=3)
    top.scatter([p[0] for p in simulated[1:]], [p[1] for p in simulated[1:]], s=70, color=HIGHLIGHT,
                edgecolor=SURFACE, linewidth=2, zorder=4)

    # Direct labels instead of a legend box.
    top.annotate("F1, real", (real[-2][0], real[-2][1]), xytext=(0, 14), textcoords="offset points",
                 ha="center", color=TEXT, fontweight="bold")
    # Right of the last point, in the space made by widening the x-axis below.
    top.annotate("F1, simulated\ndrop", (simulated[-1][0], simulated[-1][1]), xytext=(14, 0),
                 textcoords="offset points", va="center", color=TEXT, fontweight="bold")
    # Bottom-left corner is empty: every grey line starts above 0.30.
    top.annotate("Other 7 fields (real)", (real[0][0], 0.2), color=TEXT_2)

    top.set_xlim(real[0][0] - timedelta(days=3), simulated[-1][0] + timedelta(days=11))
    top.set_ylim(0.15, 0.55)
    top.set_ylabel("Greenness (NDVI)")
    top.set_title("Field greenness near Kitale, Kenya: Sentinel-2, last 10 weeks", loc="left",
                  fontsize=18, fontweight="bold", pad=16)

    weeks = sorted(weekly_rain)
    bottom.bar([w + timedelta(days=3) for w in weeks], [weekly_rain[w] for w in weeks], width=6,
               color=RAIN, zorder=2)  # centered on the middle of each week (Thursday)
    bottom.set_ylabel("Rain per week (mm)")
    bottom.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))

    fig.text(0.125, 0.015, "Satellite: Copernicus Sentinel-2 via Microsoft Planetary Computer. "
             "Rain: Open-Meteo. Dashed = simulated for the demo.", color=TEXT_2, fontsize=11)
    fig.savefig(OUT_DIR / "greenness_chart.png", dpi=100, facecolor=SURFACE, bbox_inches="tight", pad_inches=0.4)
    plt.close(fig)


def field_map(width_px=1600, margin_deg=0.0015):
    """Draw the field outlines on the newest clear Sentinel-2 photo (true color, 10 m pixels)."""
    fields = json.loads((DATA_DIR / "fields.geojson").read_text())["features"]
    points = [p for f in fields for p in f["geometry"]["coordinates"][0]]
    west, east = min(p[0] for p in points) - margin_deg, max(p[0] for p in points) + margin_deg
    south, north = min(p[1] for p in points) - margin_deg, max(p[1] for p in points) + margin_deg
    height_px = round(width_px * (north - south) / (east - west))

    search = Client.open(CATALOG).search(collections=["sentinel-2-l2a"], bbox=[west, south, east, north],
                                         datetime=f"{date.today() - timedelta(weeks=4)}/{date.today()}",
                                         query={"eo:cloud_cover": {"lt": 10}})
    item = max(search.items(), key=lambda i: i.datetime)
    url = (f"https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{west},{south},{east},{north}/"
           f"{width_px}x{height_px}.png?collection=sentinel-2-l2a&item={item.id}&assets=visual&resampling=nearest")
    photo = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=120).read())).convert("RGB")

    def to_px(lng, lat):  # longitude/latitude -> pixel in the photo
        return (lng - west) / (east - west) * width_px, (north - lat) / (north - south) * height_px

    draw = ImageDraw.Draw(photo)
    font = ImageFont.load_default(size=34)
    for f in fields:
        field_id = f["properties"]["field_id"]
        pixels = [to_px(lng, lat) for lng, lat in f["geometry"]["coordinates"][0]]
        draw.line(pixels, fill=HIGHLIGHT if field_id == PROBLEM_FIELD else "#ffffff", width=5, joint="curve")
        cx = sum(p[0] for p in pixels[:-1]) / (len(pixels) - 1)
        cy = sum(p[1] for p in pixels[:-1]) / (len(pixels) - 1)
        draw.text((cx, cy), field_id, fill="#ffffff", font=font, anchor="mm", stroke_width=4, stroke_fill="#000000")

    caption = (f"Sentinel-2 true color, {item.datetime.date():%d %b %Y}, 10 m pixels. "
               f"Contains modified Copernicus Sentinel data.")
    draw.text((14, height_px - 14), caption, fill="#ffffff", font=ImageFont.load_default(size=22),
              anchor="ls", stroke_width=3, stroke_fill="#000000")
    photo.save(OUT_DIR / "field_map.png")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    greenness_chart()
    field_map()
    print(f"Saved greenness_chart.png and field_map.png in {OUT_DIR}")


if __name__ == "__main__":
    main()
