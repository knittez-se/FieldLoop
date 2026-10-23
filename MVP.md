# FarmSignal MVP

This is the smallest version of FarmSignal that still tells the whole story. If these five steps work in the demo, we have a project. Everything else is optional.

Deadline: Sunday 25 October, 23:59. Aim to submit around 20:00.

## The five steps

1. A map with 6 to 8 fields, colored by status: fine, check soon, check now.
2. Each field has a weekly greenness history. The app compares every field to its own past and to its neighbors.
3. An AI step takes those numbers plus recent rainfall and writes a ranked check list. For each field: the reason, how unsure it is, and what the advisor should look for.
4. Clicking the top field opens a visit task. An advisor view lets us submit a short note and a photo from the field.
5. The AI reads the report, updates the field's status, re-ranks the list, and adds a line to a case history.

This loop is the whole pitch. Protect it.

## What we cut

- Accounts and logins
- A real database (save to a JSON file)
- Offline mode
- Other crops or regions
- Real messaging to advisors
- Voice input (stretch goal only, text and photo first)

## Who builds what

| Person | Part |
| --- | --- |
| Dominik | Data script: turns satellite images into a small file of greenness numbers per field per week |
| Ivan | The app: map, ranked list, visit task, advisor report, case history |

The two parts only meet at one file (see below), so you can both work at the same time without waiting for each other.

## The data contract

The data script writes one CSV file. The app only reads that file. It never touches satellite images.

File: `data/field_scores.csv`

| Column | Meaning | Example |
| --- | --- | --- |
| `field_id` | Short unique name for the field | `F3` |
| `date` | Date of the satellite reading (YYYY-MM-DD) | `2026-09-14` |
| `greenness` | Average NDVI for the field that week, between 0 and 1. Higher means greener | `0.62` |
| `source` | `real` if it came from satellite data, `simulated` if we made it up | `simulated` |

The `source` column matters. The app must show a clear "simulated" label whenever a field's data is not real, so we stay honest with the judges.

Field outlines go in `data/fields.geojson` (one shape per field, each with a `field_id`). Draw them at geojson.io.

Weather: one file, `data/weather.csv`, with columns `date` and `rainfall_mm` (daily rain for the demo area).

**Ivan can start right now with a hand-made fake `field_scores.csv`.** About 8 fields times 10 weeks is 80 rows. When Dominik's script produces the real file, swap it in. Nothing else should need to change.

Plant one or two clear problem fields in the fake data (for example a field whose greenness drops for three weeks while its neighbors stay steady). Label them `simulated`. The demo needs something to find.

## The data script (Dominik)

1. Read the field outlines from `data/fields.geojson`.
2. Search a free satellite catalog (Earth Search) for Sentinel-2 images of the area over the last 10 weeks, skipping cloudy ones.
3. For each image, compute NDVI, the greenness number, from the red and near-infrared bands.
4. For each field outline, average the pixels inside it into one number per week.
5. Write `data/field_scores.csv`.

Test the satellite access and the free weather service (Open-Meteo) tonight, before trusting them. Use one small farming area and a date range with few clouds.

**Hard time limit:** if real satellite numbers are not working by Saturday noon, keep the fake file, label it `simulated`, and move on. Our story is the workflow after the alert, not the pixels.

## The app (Ivan)

Stack (decided): Next.js + TypeScript with a Leaflet map. See the README for how to run it. The app reads the three files in `data/` through `src/app/api/field-data/route.ts` and runs without them on built-in sample data.

Screens:

1. **Cooperative view:** map of fields colored by status, plus the ranked check list.
2. **Visit task:** what to check at the top field and why.
3. **Advisor report:** a text box and photo upload.
4. **Case history:** what was checked, what was found, new status.

The AI step:

- Input: each field's recent greenness numbers, its neighbors' numbers, and recent rainfall.
- Output: a ranked list with a reason, an uncertainty level, and what to look for.
- Rule: it never claims a diagnosis from satellite data alone. A drop means "something changed, go and look".

## Timeline

| When | Goal |
| --- | --- |
| Friday evening | Split the work. Ivan: map plus ranked list on fake data. Dominik: test satellite access, get one image working. Something visible on screen before bed. |
| Saturday morning | AI ranking works on fake data. Real numbers for one area start coming out of the script. |
| Saturday afternoon | Swap real data in. Build the visit, report and update loop. |
| Saturday night | **Checkpoint:** a full run of all five steps, even if ugly. |
| Sunday morning | Polish, plant clear problem fields, fill the README TODOs, take screenshots. |
| Sunday afternoon | Rehearse the 3 minute demo twice out loud, record a backup video, submit by about 20:00. |

## Working rules

- Commit small and often, so there is always a working version saved.
- Never commit API keys. Keep them in `.env` (already ignored by `.gitignore`).
- Both of us must be able to explain every part of the demo.
- Anything simulated gets labeled "simulated" in the app and in the README table.
