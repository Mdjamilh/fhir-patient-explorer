import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { axisDate, formatDate, formatNumber, formatUnit } from "../../fhir/format";
import type { Flag, Series } from "../../fhir/observations";

const FLAG_COLOR: Record<Flag, string> = { normal: "var(--accent)", low: "var(--warn)", high: "var(--warn)", critical: "var(--danger)" };

/** Values over time, with the normal range shaded when the lab reports one. */
export function TrendChart({ series }: { series: Series }) {
  const data = series.points.map((p) => ({ t: Date.parse(p.date), value: p.value, flag: p.flag }));
  const { low, high } = series.range ?? {};
  const values = data.map((d) => d.value).concat([low, high].filter((v): v is number => v !== undefined));
  const pad = (Math.max(...values) - Math.min(...values)) * 0.15 || 1;
  const span = (data.at(-1)?.t ?? 0) - (data[0]?.t ?? 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        {(low !== undefined || high !== undefined) && (
          <ReferenceArea y1={low ?? Math.min(...values) - pad} y2={high ?? Math.max(...values) + pad} fill="var(--ok)" fillOpacity={0.08} ifOverflow="extendDomain" />
        )}
        <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t: number) => axisDate(t, span)} stroke="var(--muted)" fontSize={12} />
        <YAxis domain={[(min: number) => Math.floor(min - pad), (max: number) => Math.ceil(max + pad)]} stroke="var(--muted)" fontSize={12} width={48} />
        <Tooltip
          labelFormatter={(t) => formatDate(new Date(Number(t)).toISOString())}
          formatter={(v) => [`${formatNumber(Number(v))} ${formatUnit({ unit: series.unit })}`, series.name]}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={2}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; index?: number }) => (
            <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={FLAG_COLOR[data[props.index ?? 0]?.flag ?? "normal"]} stroke="var(--surface)" strokeWidth={1.5} />
          )}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
