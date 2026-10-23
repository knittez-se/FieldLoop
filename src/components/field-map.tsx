"use client";

/**
 * Interactive field map (Leaflet, loaded client-side only).
 *
 * - Field polygons are coloured by the field's current inspection priority.
 * - Diamonds mark potential anomalies, round pins mark active inspections.
 * - If map tiles fail (offline / blocked), polygons still render on a plain background
 *   and a notice is shown. If Leaflet itself fails to load, an SVG schematic is used.
 */
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { Anomaly, Field, Priority } from "@/lib/types";
import { PRIORITY_COLOR } from "./ui";
import { SchematicMap } from "./schematic-map";
import { cn } from "@/lib/format";

export interface MapFieldStatus {
  level: Priority | "ok";
  hasActiveInspection: boolean;
  score?: number;
}

export interface FieldMapProps {
  fields: Field[];
  status: Record<string, MapFieldStatus>;
  anomalies: Anomaly[];
  selectedId?: string;
  onSelect?: (fieldId: string) => void;
  className?: string;
  /** Compact mode: no zoom controls, no scroll zoom (dashboard preview). */
  compact?: boolean;
}

type LeafletModule = typeof Leaflet;

export function FieldMap(props: FieldMapProps) {
  const { fields, status, anomalies, selectedId, onSelect, className, compact } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const LRef = useRef<LeafletModule | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fittedRef = useRef(false);

  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [tilesFailed, setTilesFailed] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = (await import("leaflet")) as unknown as LeafletModule & { default?: LeafletModule };
        const L = mod.default ?? mod;
        if (cancelled || !containerRef.current) return;
        LRef.current = L;
        const map = L.map(containerRef.current, {
          zoomControl: !compact,
          scrollWheelZoom: !compact,
          attributionControl: true,
        });
        let tileErrors = 0;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on("tileerror", () => {
            tileErrors += 1;
            if (tileErrors >= 3) setTilesFailed(true);
          })
          .addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("failed");
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      fittedRef.current = false;
    };
  }, [compact]);

  // (Re)draw layers whenever data changes.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const group = layerRef.current;
    if (loadState !== "ready" || !L || !map || !group) return;
    group.clearLayers();

    fields.forEach((field) => {
      const st = status[field.id] ?? { level: "ok", hasActiveInspection: false };
      const color = PRIORITY_COLOR[st.level];
      const selected = field.id === selectedId;
      const poly = L.polygon(field.boundary, {
        color: selected ? "#111827" : color,
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: selected ? 0.35 : 0.22,
      })
        .bindTooltip(`<strong>${field.name}</strong><br/>${field.id} · ${field.areaHa} ha`, { sticky: true })
        .on("click", () => onSelectRef.current?.(field.id));
      group.addLayer(poly);

      if (st.hasActiveInspection) {
        const icon = L.divIcon({
          className: "",
          html: `<div class="fs-pin" style="width:22px;height:22px;background:${color}">${st.score ?? ""}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        group.addLayer(
          L.marker(field.centroid, { icon, title: `Inspection: ${field.name}` }).on("click", () => onSelectRef.current?.(field.id)),
        );
      }
    });

    anomalies
      .filter((a) => a.location && (a.status === "open" || a.status === "under_review"))
      .forEach((a) => {
        const color = PRIORITY_COLOR[a.severity];
        const icon = L.divIcon({
          className: "",
          html: `<div class="fs-diamond" style="background:${color}"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        group.addLayer(
          L.marker(a.location!, { icon, title: "Potential anomaly" })
            .bindTooltip(`Potential anomaly (${a.severity})${a.zoneLabel ? ` – ${a.zoneLabel}` : ""}`)
            .on("click", () => onSelectRef.current?.(a.fieldId)),
        );
      });

    if (!fittedRef.current && fields.length) {
      const bounds = L.latLngBounds(fields.flatMap((f) => f.boundary));
      map.fitBounds(bounds, { padding: [24, 24] });
      fittedRef.current = true;
    }
  }, [fields, status, anomalies, selectedId, loadState]);

  // Pan to the selected field.
  useEffect(() => {
    const map = mapRef.current;
    const field = fields.find((f) => f.id === selectedId);
    if (loadState === "ready" && map && field && !compact) {
      map.panTo(field.centroid, { animate: true });
    }
  }, [selectedId, loadState, fields, compact]);

  if (loadState === "failed") {
    return (
      <SchematicMap
        fields={fields}
        status={status}
        anomalies={anomalies}
        selectedId={selectedId}
        onSelect={onSelect}
        className={className}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {loadState === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 text-xs text-stone-500">Loading map…</div>
      )}
      {tilesFailed && (
        <div className="absolute bottom-7 left-2 z-[500] rounded-md bg-white/90 px-2 py-1 text-[11px] text-stone-700 shadow">
          Map tiles unavailable – showing field geometry only
        </div>
      )}
    </div>
  );
}

export function MapLegend({ className }: { className?: string }) {
  const items: Array<{ color: string; label: string }> = [
    { color: PRIORITY_COLOR.high, label: "High priority" },
    { color: PRIORITY_COLOR.medium, label: "Medium priority" },
    { color: PRIORITY_COLOR.low, label: "Low priority" },
    { color: PRIORITY_COLOR.ok, label: "No open inspection" },
  ];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-stone-600", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border" style={{ background: i.color + "40", borderColor: i.color }} />
          {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2 border-white bg-stone-600 shadow" /> Active inspection (score)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rotate-45 border border-white bg-stone-600 shadow" /> Potential anomaly
      </span>
    </div>
  );
}
