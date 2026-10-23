"use client";

/** Dependency-free SVG fallback map: projects field boundaries into a box. */
import type { Anomaly, Field } from "@/lib/types";
import { PRIORITY_COLOR } from "./ui";
import type { MapFieldStatus } from "./field-map";
import { cn } from "@/lib/format";

export function SchematicMap({
  fields,
  status,
  anomalies,
  selectedId,
  onSelect,
  className,
}: {
  fields: Field[];
  status: Record<string, MapFieldStatus>;
  anomalies: Anomaly[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const pts = fields.flatMap((f) => f.boundary);
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const W = 1000;
  const H = 640;
  const pad = 40;
  const sx = (W - 2 * pad) / (maxLng - minLng || 1);
  const sy = (H - 2 * pad) / (maxLat - minLat || 1);
  const s = Math.min(sx, sy);
  const offX = (W - (maxLng - minLng) * s) / 2;
  const offY = (H - (maxLat - minLat) * s) / 2;
  const project = ([lat, lng]: [number, number]) => [offX + (lng - minLng) * s, H - (offY + (lat - minLat) * s)];

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-[#eef0ea]", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Schematic field map">
        {fields.map((f) => {
          const st = status[f.id] ?? { level: "ok" as const, hasActiveInspection: false };
          const color = PRIORITY_COLOR[st.level];
          const d = f.boundary.map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`).join(" ") + "Z";
          const [cx, cy] = project(f.centroid);
          return (
            <g key={f.id} className="cursor-pointer" onClick={() => onSelect?.(f.id)}>
              <path d={d} fill={color} fillOpacity={f.id === selectedId ? 0.45 : 0.28} stroke={f.id === selectedId ? "#111827" : color} strokeWidth={f.id === selectedId ? 6 : 2} />
              <text x={cx} y={cy} textAnchor="middle" fontSize="20" fontWeight="700" fill="#1c1f1d">
                {f.name}
              </text>
              <text x={cx} y={cy + 24} textAnchor="middle" fontSize="14" fill="#57534e">
                {f.id}
              </text>
              {st.hasActiveInspection && <circle cx={cx} cy={cy} r={11} fill={color} stroke="white" strokeWidth={3} />}
            </g>
          );
        })}
        {anomalies
          .filter((a) => a.location && (a.status === "open" || a.status === "under_review"))
          .map((a) => {
            const [x, y] = project(a.location!);
            return (
              <rect key={a.id} x={x - 7} y={y - 7} width={14} height={14} transform={`rotate(45 ${x} ${y})`} fill={PRIORITY_COLOR[a.severity]} stroke="white" strokeWidth={2} />
            );
          })}
      </svg>
      <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] text-stone-700 shadow">
        Schematic view – interactive map unavailable
      </div>
    </div>
  );
}
