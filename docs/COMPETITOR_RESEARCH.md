# Competitor research and "wow" plan

Researched 23 October 2026 from the products' public pages (sources at the end). We have not used these products ourselves, so some may do more than described here.

## What the market already does

| Product | Who it is for | What it does well | What it leaves open |
| --- | --- | --- | --- |
| **EOSDA Crop Monitoring** | Advisers, cooperatives, input suppliers | NDVI change alerts, a **field leaderboard** ranking fields by crop performance, scouts sent to problem spots with GPS navigation (works offline), on-the-spot reports with photos shared in a team account, 14-day weather forecast | Ranking is by crop performance, not by "what should we do first and why". No AI reading the scout's report. Built for professional users. |
| **OneSoil** | Farmers and agronomists (strong in Europe) | Free app: field boundaries and crop type detected from satellite, NDVI over time, **flags problem spots and navigates you there**, variable-rate maps (paid) | Stops at "here is a problem spot". No case tracking, no follow-up. |
| **Farmonaut** | Smallholders (India, Africa) | **WhatsApp onboarding**: drop a pin, boundary detected automatically, first report about a minute later, no app install | One-way reports to individual farmers. No coordination of advisers. |
| **Cropin (Connect / Grow)** | Agribusinesses, development agencies, field teams | Multilingual farmer app, task planning, early warning alerts, field team sees all records | Enterprise platform, heavy setup. |
| **Farmforce** | Outgrower schemes, exporters, field officers | Field officers collect data on phones, traceability and compliance, farmers reached by **SMS**, mobile payments | Compliance and traceability focus, not crop-health response. |
| **Plantix** | Smallholders | Photo of a plant → automatic diagnosis of pests and diseases, treatment options, offline disease library | Diagnosis from one photo, no field context, no satellite signal, no adviser workflow. |
| **Digital Green FarmerChat** | Extension workers and smallholders | AI assistant by **text, voice or image**, in Hindi, Telugu, Swahili and Amharic, on **WhatsApp**, Telegram and web | Answers questions; does not know which fields need a visit. |

Note: the README previously named "CropSense, OpenFarm and Open Farm Analytics". We could not confirm these as satellite crop-monitoring products. Use the verified names above in the pitch.

## Where FarmSignal fits

Everyone covers **seeing** the problem (satellite alerts) or **answering** a farmer's question (chat, photo diagnosis). Nobody we found closes the loop for a cooperative with few advisers:

> **Signal → which field first and why → what to check → adviser's report → AI reads it → queue re-ranks → case history.**

EOSDA comes closest (leaderboard + scouting reports), but it ranks by crop performance and stops when the report is filed. FarmSignal's angle: **the work after the alert, explained in plain language, with AI that reads the field report.**

Expectations set by the competitors (judges may know them):

1. **Voice and WhatsApp are normal** for smallholder tools (FarmerChat, Farmonaut). A typed-only form looks dated.
2. **Navigation to the problem spot** is standard (EOSDA, OneSoil).
3. **NDVI over time** is standard. Showing a chart is not a wow; showing the field *fade* is.
4. **"Simple" is the selling point** everywhere (FieldSense was praised for simplicity; Cropin and EOSDA stress ease of use).

## Wow effects for round 1 (ranked by impact per hour)

The first-round judges may click the prototype themselves for a minute or two. It must explain itself on the first screen and show the "magic" within three clicks.

| # | Feature | Why it wows | Effort | Area |
| --- | --- | --- | --- | --- |
| 1 | **Greenness time-lapse on the map**: a play button and week slider that recolors every field by its NDVI week by week; the problem field visibly fades from green to yellow while its neighbors stay green | Instantly shows "the satellite saw something" without reading a chart. Uses data we already have (`field_scores.csv`). | ~2–3 h | B (UI) + A (selector) |
| 2 | **Today's briefing**: one AI-written sentence at the top of the Overview ("3 fields need you today. Start with Kapsara East Block: greenness fell 46% in 3 weeks while neighbors held steady, and the farmer reported leaf rolling.") with one big *Start visit* button | Answers "what do I do now?" in five seconds. Makes the AI visible on the first screen. | ~1–2 h | A (text) + B (placement) |
| 3 | **Voice report → structured report live**: on the visit screen one big *Record* button; when the adviser stops talking, the AI suggestion appears automatically (outcome, supported/ruled-out causes, follow-up) | The core "AI reads the report" moment, hands-free. Matches what FarmerChat taught judges to expect. | ~1–2 h (dictation + analysis already exist) | B |
| 4 | **Farmer report via WhatsApp (simulated)**: a phone mockup where a farmer sends "leaves are rolling in the corner" + photo; it appears as a ground report and the queue re-ranks live | Shows the smallholder side and low-tech access. Strong for an international, development-focused jury. Clearly labeled as a simulation. | ~3 h | B + A (reuse `submitObservation`) |
| 5 | **Impact counter**: "6 of 8 fields did not need a visit this week · 1 case closed in 2 days" | Turns the workflow into a business result for the pitch. | ~1 h | A (selector) + B |
| 6 | **Guided demo tour**: a small "Take the 60-second tour" button that highlights the five steps in order | Judges who click alone do not get lost. | ~2 h | B |

## Make it simpler (intuitive)

- **First screen = one decision.** The briefing sentence and one button. Move the four stat tiles below the queue.
- **Field page: summary first.** Show "Why flagged" (2 lines) + "What to check" (3 bullets) + *Start visit*. Fold the six-part assessment, trend and weather into an expandable "Evidence" section.
- **Fewer words on buttons and badges.** One label per state: *Check now / Check this week / OK*.
- **Navigation:** *Today*, *Map*, *Visits*, *Reports*. Settings moves to a small icon.
- **Demo data stays clearly labeled**, but in one small footer line instead of several banners.

## Recommendation

Build **1, 2 and 3** first (about one day together). They cover the three moments judges remember: *the satellite saw it* (time-lapse), *the AI tells me what to do* (briefing), *the AI understands the field report* (voice → structured report). Add **4** if time allows; it is the strongest story for an international jury but the least essential for the workflow.

## Sources

- EOSDA Crop Monitoring for cooperatives: https://eos.com/products/crop-monitoring/cooperatives
- EOSDA for advisors: https://eos.com/products/crop-monitoring/for-advisors
- OneSoil field map and scouting app (Future Farming): https://futurefarming.com/smart-farming/tools-data/onesoil-a-handy-free-fieldmap-and-scouting-app
- Farmonaut WhatsApp farm mapping: https://farmonaut.com/remote-sensing/whatsapp-your-farm-to-space-farmonauts-2-minute-revolution-in-satellite-farm-mapping
- Cropin farmer engagement solution: https://www.cropin.com/intelligent-agriculture-cloud/cropin-apps/farmer-engagement-solution
- Farmforce (GSMA): https://www.gsma.com/mobilefordevelopment/resources/farmforce/
- Plantix (FAO e-Agriculture): https://www.fao.org/e-agriculture/es/node/13281
- Plantix (Future Farming): https://futurefarming.com/smart-farming/plantix-more-than-a-crop-doctor-driven-by-ai
- Digital Green Farmer Chat (TechX Lab): https://techxlab.org/solutions/farmer-chat/
- FieldSense (Copernicus Masters): https://copernicus-masters.com/winner/fieldsense-simple-monitoring-crop-health-using-satellite-data/

---

# Part 2 — Personalization, showcase data and the development angle

Added 23 October 2026 after the team discussion: (1) a showcase dataset that shows the vision clearly, (2) an onboarding quiz that personalizes the app, (3) positioning for cooperatives and NGOs in low-income countries.

## Why this angle is strong

- **The adviser gap is the problem we solve.** Kenya has roughly **1 agricultural extension worker per 5,000 farmers**, against a recommended 1 per 400 (Farm Africa). An adviser cannot visit every field, so *which field first* is the core question.
- **Small farms matter for food supply.** Farms under 2 hectares produce about **a third of the world's food on about 12% of the farmland** (FAO, 2021).
- **The users already exist at scale.** One Acre Fund alone served **5.5 million farmers in 2024** in 10 African countries through field officers who live in the farming communities, and already uses remote sensing and digital tools. These field-officer organisations are our customer.
- **The "missing middle".** GEOGLAM's Crop Monitor gives **monthly, national/regional** early warning for food-insecure countries (used by FEWS NET, WFP and FAO). Plantix and FarmerChat help **one farmer at a time**. Nothing plans the **field officer's week** across hundreds of small fields. That is FarmSignal.

## How competitors onboard users

| Product | Onboarding | Lesson for us |
| --- | --- | --- |
| OneSoil | Add fields by **selecting boundaries already detected from satellite**, drawing, or uploading a file | Never make users draw first. Show detected plots and let them tap. |
| Farmonaut | WhatsApp: **drop a pin**, boundary detected, first report about a minute later | Time to first value must be under 2 minutes. |
| Cropin | Farm and crop set-up "in a few clicks", in the grower's language | Ask only what changes the output. Language choice first. |
| FarmerChat | Text, voice or image; Hindi, Telugu, Swahili, Amharic | Plan for voice and local languages, even if the prototype is English. |

## Proposal 1 — Showcase data (default in the prototype)

A clearly labeled simulated dataset designed to show what FarmSignal is for. Real Sentinel-2 data stays available as a switch ("Showcase" / "Real data from Kitale").

What the showcase should make obvious in seconds:

1. **Scale:** ~40 smallholder plots (0.3–3 ha) across 3 villages, so the "which field first" problem is visible. Real data has 8 plots, which looks too easy.
2. **Several crops:** maize, beans, sorghum, cassava, so crop-specific advice shows.
3. **Four stories in the data:**
   - a **dry-spell cluster**: 4 neighbouring maize plots declining together on light soil (water stress hypothesis),
   - a **spreading problem**: one plot drops, two weeks later its neighbours start dropping (pest spread, visible in the time-lapse),
   - a **recovered field**: flagged, visited, action taken, greenness recovers afterwards (shows impact),
   - a **normal harvest dip**: all mature fields fall together and are correctly **not** flagged (shows the detection is smart, not noisy).
4. **Labeling:** a permanent "Showcase data (simulated)" chip, as now.

## Proposal 2 — Onboarding quiz (under 60 seconds, skippable)

| Step | Question | What it changes |
| --- | --- | --- |
| 1 | **Who are you?** Farmer · Cooperative adviser · NGO / program manager | Wording, default screen (my fields vs. team queue vs. region overview) |
| 2 | **Where do you work?** Country → region (list, no GPS needed) | The map centers there; weather and crop calendar for that region |
| 3 | **What is grown?** Crop chips (maize, beans, sorghum, cassava, rice, coffee …) + rough hectares | Growth stages, checklists and hypotheses per crop; area totals |
| 4 | **Pick your fields** Tap plots on the map (pre-detected outlines, like OneSoil) or "Use demo farms" | The monitored fields; area calculated automatically |
| 5 | **Team** (advisers only) Number of advisers and visits per week | Capacity planning: "This week 5 of 40 fields need a visit — fits 1 adviser-day" |

End screen: a personal summary ("Nzoia Valley Cooperative · 3 villages · 41 fields · 62 ha maize and beans · 2 advisers") and straight into *Today*.

Prototype limits to state openly: field "detection" in the quiz uses pre-traced outlines for the demo region; other regions show the showcase farms.

## How we stand out in round 1

1. **Lead with the person, not the satellite:** "One adviser, 5,000 farmers. Which field first?"
2. **Show the vision with showcase data**, prove feasibility with the real Kitale data switch.
3. **Three wow moments:** the quiz personalizes the map in under a minute → the time-lapse shows the problem spreading → the visit report is read by AI and the queue re-ranks.
4. **Impact in one number:** visits avoided and adviser days saved per week, per cooperative.
5. **Honesty as a feature:** every simulated value is labeled; the AI never diagnoses.

## Additional sources

- Farm Africa, Village-Based Advisor model (extension worker ratio in Kenya): https://www.farmafrica.org/publication/the-village-based-advisor-vba-model/
- FAO, Small family farmers produce a third of the world's food: https://www.fao.org/newsroom/detail/small-family-farmers-produce-a-third-of-the-world-s-food/en
- One Acre Fund, Our model: https://oneacrefund.org/about-us/our-model
- NASA Harvest, GEOGLAM Crop Monitor for Early Warning: https://www.nasaharvest.org/news/the-geoglam-crop-monitor-for-early-warning-strengthening-agricultural-decision-making-in-countries-at-risk-of-food-insecurity
- OneSoil help, Adding fields: https://help.onesoil.ai/en/articles/6998993-adding-fields
