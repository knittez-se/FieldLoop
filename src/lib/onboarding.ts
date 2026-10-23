/**
 * Onboarding quiz options and helpers.
 * shortcut: a fixed region list with map centers; replace with a geocoder when other regions get real data.
 */
import { areaHa, centroidOf } from "./demo-data";
import type { AppState, LatLng, OnboardingProfile } from "./types";

export type { OnboardingProfile };

export interface Region {
  id: string;
  country: string;
  name: string;
  center: LatLng;
  zoom: number;
  /** true if the demo data has fields here */
  hasDemoFields?: boolean;
}

export const REGIONS: Region[] = [
  { id: "ke-trans-nzoia", country: "Kenya", name: "Trans-Nzoia (Kitale)", center: [1.03, 34.99], zoom: 12, hasDemoFields: true },
  { id: "ke-uasin-gishu", country: "Kenya", name: "Uasin Gishu (Eldoret)", center: [0.52, 35.27], zoom: 11 },
  { id: "ke-bungoma", country: "Kenya", name: "Bungoma", center: [0.56, 34.56], zoom: 11 },
  { id: "ug-mbale", country: "Uganda", name: "Mbale", center: [1.08, 34.18], zoom: 11 },
  { id: "tz-mbeya", country: "Tanzania", name: "Mbeya", center: [-8.9, 33.46], zoom: 10 },
  { id: "et-oromia", country: "Ethiopia", name: "West Shewa (Oromia)", center: [8.98, 37.85], zoom: 10 },
  { id: "rw-eastern", country: "Rwanda", name: "Eastern Province", center: [-1.95, 30.44], zoom: 10 },
  { id: "mw-lilongwe", country: "Malawi", name: "Lilongwe District", center: [-13.98, 33.78], zoom: 10 },
  { id: "ng-kaduna", country: "Nigeria", name: "Kaduna", center: [10.52, 7.44], zoom: 10 },
  { id: "gh-northern", country: "Ghana", name: "Northern Region (Tamale)", center: [9.4, -0.85], zoom: 10 },
];

export const CROPS = [
  { id: "maize", label: "Maize" },
  { id: "beans", label: "Beans" },
  { id: "sorghum", label: "Sorghum" },
  { id: "cassava", label: "Cassava" },
  { id: "rice", label: "Rice" },
  { id: "coffee", label: "Coffee" },
  { id: "wheat", label: "Wheat" },
  { id: "other", label: "Other" },
];

export const DEFAULT_PROFILE: OnboardingProfile = {
  role: "adviser",
  regionId: "ke-trans-nzoia",
  crops: ["maize", "beans"],
  fieldIds: "all",
  advisers: 2,
  visitsPerAdviserDay: 5,
};

export function regionById(id: string | undefined): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}

export interface CandidateField {
  id: string;
  name: string;
  farm: string;
  crop: string;
  areaHa: number;
  boundary: LatLng[];
  centroid: LatLng;
}

/** Every plot in the current data the user can pick in the quiz (also ones not monitored yet). */
export function candidateFields(state: AppState): CandidateField[] {
  return state.data.payload.fields
    .filter((f) => f.boundary.length >= 3)
    .map((f) => ({
      id: f.id,
      name: f.name ?? `Field ${f.id}`,
      farm: f.farm ?? "Demo Farm",
      crop: f.crop ?? "maize",
      areaHa: areaHa(f.boundary),
      boundary: f.boundary,
      centroid: centroidOf(f.boundary),
    }));
}
