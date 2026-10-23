# FarmSignal

**From satellite alert to fixed field.**

Built for the Polaris Global Hackathon (October 2026).

FarmSignal is an AI field operations assistant for small farming cooperatives. It uses free satellite imagery and weather data to find fields that have changed, ranks them by urgency, and turns each alert into a concrete visit for a field advisor. The advisor reports back by voice note or photo, and FarmSignal tracks the case until it is resolved.

## The problem

Satellites can already tell a farmer that a field looks stressed. What they cannot do is walk to the field.

A cooperative may look after hundreds of small plots with only a few advisors. The hard part is not seeing a red patch on a map. It is deciding which field to visit first, knowing what to look for once there, and making sure every alert ends with someone actually checking the plants. Today that follow-up often lives in spreadsheets, phone calls and memory.

## What FarmSignal does

1. **Spots changes.** Compares each field's satellite crop health against its own history and its neighbors, and combines it with recent weather.
2. **Ranks the fields.** An AI agent produces a prioritized check list: which field to visit first, why it was flagged, and how uncertain the signal is.
3. **Plans the visit.** For each flagged field it suggests what the advisor should look for, for example signs of water stress versus pests.
4. **Closes the loop.** The advisor reports back by voice note or photo. FarmSignal updates the field's status, adjusts the next priorities, and keeps a record of what was checked and what happened.

FarmSignal never claims a diagnosis from a satellite image alone. A low vegetation reading means "something changed here, go and look", not "this is the cause".

## Demo flow (3 minutes)

1. A cooperative opens the map of its fields.
2. FarmSignal shows the fields that changed and a ranked list of where to go first.
3. An advisor receives a visit task for the top field.
4. The advisor submits a voice note or photo from the field.
5. FarmSignal updates the case, re-ranks the list, and logs the outcome.

## What is real and what is simulated

We want to be upfront about this.

| Part | Status |
| --- | --- |
| Satellite data (Sentinel-2) | TODO: fill in, real or sample data |
| Weather data | TODO: fill in, real or sample data |
| Ranking and explanations by the AI agent | TODO: fill in |
| Voice or photo field report | TODO: fill in |
| Cooperative, advisors and field boundaries | Simulated for the demo |
| Problem signals in the demo fields | Simulated for the demo, clearly labeled in the app |

## Tech stack

TODO: update to match what was actually built.

- Python
- Streamlit for the interface
- Sentinel-2 satellite imagery (free, from the European Space Agency's Copernicus program)
- A free weather API
- A large language model API for ranking, explanations and report handling

## Run it locally

TODO: replace with the real steps once the prototype runs.

```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
pip install -r requirements.txt
streamlit run app.py
```

If the app needs API keys, copy `.env.example` to `.env` and add them there. Never commit real keys.

## Limitations

- Sentinel-2 pixels cover about 10 by 10 meters. Very small or mixed-crop plots are hard to judge from space, so FarmSignal compares whole fields and changes over time rather than pinpointing individual sick patches.
- Clouds, especially in rainy seasons, can hide fields for days or weeks.
- This is a 72-hour prototype. It has not been tested with real farmers or advisors, and its recommendations are not agronomic advice.

## How this relates to existing tools

Tools such as CropSense, OpenFarm and Open Farm Analytics already offer satellite crop monitoring and alerts. We are not trying to build a better map. FarmSignal focuses on the workflow after the alert: assigning the check, collecting the report, and tracking it to resolution. We have only reviewed these products' public websites, so some of their features may go further than we describe.

## Roadmap

Ideas beyond the hackathon, not built yet:

- Offline use for advisors with weak internet
- Support for more crops and regions
- Advisor-friendly voice input in local languages
- Tracking whether an intervention actually improved the field
- Testing with a real cooperative to validate the workflow

## Team

- Dominik Knitter
- TODO: teammate name

## Acknowledgements

Satellite data from the Copernicus Sentinel-2 mission (ESA). Weather data: TODO.

