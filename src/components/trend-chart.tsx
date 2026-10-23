import type { VegetationSample } from "@/lib/types";

/** Small SVG line chart for the (simulated) vegetation index. */
export function TrendChart({ series, height = 140 }: { series: VegetationSample[]; height?: number }) {
  if (series.length < 2) {
    return <div className="py-6 text-center text-xs text-stone-500">Not enough data points yet.</div>;
  }
  const W = 480;
  const H = height;
  const padL = 32;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const values = series.map((s) => s.value);
  const min = Math.max(0, Math.floor((Math.min(...values) - 0.05) * 10) / 10);
  const max = Math.min(1, Math.ceil((Math.max(...values) + 0.05) * 10) / 10);
  const x = (i: number) => padL + (i * (W - padL - padR)) / (series.length - 1);
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);
  const path = series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(series.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const ticks = [min, (min + max) / 2, max];
  const last = series[series.length - 1];
  const peak = Math.max(...values);
  const declining = last.value < peak - 0.05;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Simulated vegetation index trend">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e7e5e4" strokeDasharray="3 3" />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#78716c">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      <path d={area} fill={declining ? "#fef3c7" : "#dcebdf"} opacity={0.7} />
      <path d={path} fill="none" stroke={declining ? "#d97706" : "#3f7f52"} strokeWidth={2} />
      {series.map((s, i) => (
        <g key={s.date}>
          <circle cx={x(i)} cy={y(s.value)} r={3} fill="white" stroke={declining ? "#d97706" : "#3f7f52"} strokeWidth={1.5}>
            <title>{`${s.date}: ${s.value.toFixed(2)}`}</title>
          </circle>
          {(i === 0 || i === series.length - 1 || (i % 2 === 0 && i < series.length - 2)) && (
            <text x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} fontSize="10" fill="#78716c">
              {new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
