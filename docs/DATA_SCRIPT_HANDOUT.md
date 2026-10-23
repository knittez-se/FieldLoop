# Handout for Claude Code: the data script (Dominik's part)

Read `README.md` and `MVP.md` first. This file is the task list for Dominik's half of the project. Ivan builds the app. The two halves only meet at the files in `data/`.

Dominik is a beginner in software engineering and has basic Python. Explain what you do in plain English, avoid jargon (or explain it right away), and keep changes small. He needs to be able to explain every line in the demo.

Deadline: Sunday 25 October 2026, 23:59. Hard checkpoint: Saturday noon (see Task 6).

## Goal

Turn free Sentinel-2 satellite images into one small file of weekly greenness numbers (NDVI) per field, so the app can rank which fields to visit first.

## Output files (the contract with Ivan)

All in `data/`. Do not rename columns without telling Dominik, because the app reads them.

1. `data/fields.geojson`: one outline per field, each with a `field_id` property (for example `F1` to `F8`).
2. `data/field_scores.csv` with columns:
   - `field_id`: short unique name, for example `F3`
   - `date`: date of the reading, YYYY-MM-DD
   - `greenness`: average NDVI for the field that week, a number between 0 and 1
   - `source`: `real` if it came from satellite data, `simulated` if made up
3. `data/weather.csv` with columns `date` and `rainfall_mm` (daily rain for the demo area).

## Tasks, in order

### Task 1: Unblock Ivan with sample data (do this first, about 30 minutes)

Write `scripts/make_sample_data.py` that creates realistic fake versions of all three files, so Ivan can build the app tonight.

- 8 small rectangular fields next to each other in one demo area, 10 weekly readings each.
- Most fields hold steady around 0.6 to 0.75 with small random wobble.
- Plant 2 clear problem fields: one whose greenness drops for the last 3 weeks while its neighbors stay steady, and one with a smaller drop.
- Make rainfall low during the drop, so the "water stress" story is believable.
- Mark every row `source = simulated`.
- Commit the generated files so Ivan can pull them.

### Task 2: Choose the demo area and draw the fields

- Pick one small farming area with maize or similar crop, in the region the pitch mentions (East Africa), with a date range that has few clouds. Dominik makes the final choice, so suggest two or three and ask.
- Draw 6 to 8 field outlines at geojson.io (or generate rectangles in code) and save `data/fields.geojson`.
- Keep the fields at least a few pixels wide. Sentinel-2 pixels are about 10 by 10 meters, so a field smaller than roughly 100 by 100 meters will give noisy numbers.

### Task 3: Test satellite access before building anything

Write a tiny test script (`scripts/test_access.py`) that:

- Searches the free Earth Search catalog (Element 84, a STAC catalog) for Sentinel-2 L2A images over the demo area for the last 10 weeks, with low cloud cover.
- Prints how many images it found and their dates and cloud percentages.
- Reads one image's red and near-infrared bands for a small area.

Libraries to try: `pystac-client`, `rasterio`, `numpy`, `pandas`, `shapely`. No API key should be needed for Earth Search. Verify this and the current catalog address yourself, do not trust this handout blindly, since services change.

If this fails, tell Dominik plainly what failed and what the options are. Do not silently switch plans.

### Task 4: Build the real data script

Write `scripts/build_field_scores.py` that:

1. Reads `data/fields.geojson`.
2. Searches Earth Search for Sentinel-2 images over the area for the last 10 weeks, skipping very cloudy ones.
3. For each image, computes NDVI = (NIR minus red) divided by (NIR plus red).
4. Masks out clouds and cloud shadows using the scene classification band, so clouds do not look like a dying field.
5. For each field outline, averages the valid pixels inside it into one number per image.
6. If there are several images in one week, keep the clearest one or average them. Write down which you chose.
7. Writes `data/field_scores.csv` with `source = real`.

Keep it simple and readable, with comments in plain English. Print a short summary at the end (how many images used, how many fields had missing weeks).

Dominik should be able to rerun it with one command.

### Task 5: Weather file

Write `scripts/fetch_weather.py` that pulls daily rainfall for the demo area from Open-Meteo (free, no key) and saves `data/weather.csv`. Check the current Open-Meteo history endpoint in its docs before using it.

### Task 6: Fallback and the Saturday noon rule

If real satellite numbers are not working by Saturday 12:00, stop, keep the simulated files, and move on. The story is the workflow after the alert, not the pixels. Whatever happens:

- Anything not real must say `simulated` in the `source` column.
- If some fields are real and some simulated, mix them honestly and keep the labels.

### Task 7: Keep the README honest

Update the README "What is real and what is simulated" table and "Tech stack", "Run it locally" and "Acknowledgements" TODOs to match what was really built for the data side. Add the exact commands to run each script.

## Working rules

- Commit small and often, with clear messages. Pull before pushing in case Ivan pushed too.
- Never commit API keys. Use `.env` (already ignored by `.gitignore`) and a `.env.example` listing variable names only.
- Put scripts in `scripts/`, data in `data/`, and add a `requirements.txt` for the data side (merge with Ivan's if he has one).
- Do not touch the app code. Ask Dominik if you think the data contract needs to change.
- If something takes longer than expected, say so early and offer the simpler option.

## Definition of done

- `data/field_scores.csv`, `data/fields.geojson` and `data/weather.csv` exist, follow the contract, and load without errors.
- Every row is labeled `real` or `simulated` correctly.
- Dominik can rerun the scripts and explain what each step does.
- README is updated to match reality.
