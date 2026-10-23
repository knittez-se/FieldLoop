/**
 * Placeholder for a future real satellite integration (NOT implemented).
 *
 * The demo uses simulated vegetation index series from demo-data.ts. To add real data:
 *  1. Get Sentinel-2 L2A data via the Copernicus Data Space Ecosystem
 *     (https://dataspace.copernicus.eu — free account, Sentinel Hub Statistical API).
 *  2. For each field boundary, request mean NDVI per acquisition date with a cloud mask.
 *  3. Return the series below with source "sentinel2" and store it on Field.vegetationIndex.
 *  4. Anomaly rules (e.g. "−15% vs. field's own trend") can then run on real values.
 *
 * Keep the interface stable so the UI does not need to change.
 */
import type { LatLng, VegetationSample } from "../types";

export interface VegetationIndexProvider {
  getSeries(boundary: LatLng[], fromDate: string, toDate: string): Promise<VegetationSample[]>;
}

export const sentinel2Provider: VegetationIndexProvider | null = null;
