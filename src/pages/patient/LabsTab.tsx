import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";

import { Badge, DataTable, type Tone } from "../../components/DataTable";
import { QueryView, TruncatedNote } from "../../components/QueryView";
import { Empty } from "../../components/States";
import { useObservations } from "../../data/queries";
import { formatDate, formatNumber, formatUnit } from "../../fhir/format";
import { toSeries, trend, type Flag, type Point, type Series } from "../../fhir/observations";
import styles from "./Labs.module.css";
import { TrendChart } from "./TrendChart";

type Filter = "all" | "vital-signs" | "laboratory";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "vital-signs", label: "Vital signs" },
  { value: "laboratory", label: "Labs" },
];

const FLAG_TONE: Record<Flag, Tone> = { normal: "ok", low: "warn", high: "warn", critical: "danger" };
const FLAG_LABEL: Record<Flag, string> = { normal: "Normal", low: "Low", high: "High", critical: "Critical" };

export function FlagBadge({ flag }: { flag?: Flag }) {
  return flag ? <Badge tone={FLAG_TONE[flag]}>{FLAG_LABEL[flag]}</Badge> : null;
}

const value = (p: Point) => `${formatNumber(p.value)} ${formatUnit({ unit: p.unit })}`.trim();

function TrendText({ series }: { series: Series }) {
  const t = trend(series);
  if (!t) return <span className={styles.trend}>1 reading</span>;
  const arrow = t.direction === "up" ? "↑" : t.direction === "down" ? "↓" : "→";
  const label = t.direction === "flat" ? "stable" : `${t.direction} ${formatNumber(Math.abs(t.delta))}`;
  return (
    <span className={styles.trend}>
      <span aria-hidden>{arrow}</span> {label}
    </span>
  );
}

export function LabsTab() {
  const { id = "" } = useParams();
  return <QueryView query={useObservations(id)} label="labs and vitals">{({ resources, truncated }) => <Labs observations={resources} truncated={truncated} />}</QueryView>;
}

function Labs({ observations, truncated }: { observations: Parameters<typeof toSeries>[0]; truncated: boolean }) {
  const all = useMemo(() => toSeries(observations), [observations]);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("all");
  const [text, setText] = useState("");

  const visible = all.filter((s) => (filter === "all" || s.category === filter) && s.name.toLowerCase().includes(text.trim().toLowerCase()));
  // The selected test is in the URL (?test=...) so it can be linked to directly.
  const selected = all.find((s) => s.key === params.get("test")) ?? visible[0];

  if (all.length === 0) return <Empty>No numeric lab results or vital signs recorded.</Empty>;

  const select = (s: Series) =>
    setParams(
      (p) => {
        p.set("test", s.key);
        return p;
      },
      { replace: true },
    );

  return (
    <>
      <TruncatedNote truncated={truncated} what="results" />
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className={styles.search}
          placeholder="Filter tests…"
          aria-label="Filter tests by name"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className={styles.layout}>
        {visible.length ? (
          <ul className={styles.list} aria-label="Tests">
            {visible.map((s) => (
              <li key={s.key}>
                <button type="button" className={styles.item} aria-current={s.key === selected?.key} onClick={() => select(s)}>
                  <span className={styles.itemName}>{s.name}</span>
                  <span className={styles.itemValue}>{value(s.latest)}</span>
                  <span className={styles.itemMeta}>
                    {formatDate(s.latest.date)} <FlagBadge flag={s.latest.flag === "normal" ? undefined : s.latest.flag} />
                  </span>
                  <TrendText series={s} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No tests match.</Empty>
        )}

        {selected && (
          <section className={styles.panel} aria-labelledby="test-title">
            <h2 id="test-title" className={styles.panelTitle}>
              {selected.name}
            </h2>
            <p className={styles.panelMeta}>
              {selected.points.length} {selected.points.length === 1 ? "reading" : "readings"}
              {selected.range && (
                <>
                  {" "}
                  · normal range {selected.range.low !== undefined ? formatNumber(selected.range.low) : "–"} to{" "}
                  {selected.range.high !== undefined ? formatNumber(selected.range.high) : "–"} {formatUnit({ unit: selected.unit })}
                </>
              )}
            </p>
            {selected.points.length > 1 && (
              <div className={styles.chart} role="img" aria-label={`Chart of ${selected.name} over time; values are listed in the table below`}>
                <TrendChart series={selected} />
              </div>
            )}
            <DataTable
              rows={[...selected.points].reverse()}
              rowKey={(p, i) => `${p.date}-${i}`}
              columns={[
                { header: "Date", cell: (p) => formatDate(p.date, { withTime: true }), nowrap: true },
                { header: "Value", cell: value, nowrap: true },
                { header: "Flag", cell: (p) => <FlagBadge flag={p.flag} /> },
              ]}
            />
          </section>
        )}
      </div>
    </>
  );
}
