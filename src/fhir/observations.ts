import type { CodeableConcept, Observation, ObservationReferenceRange, Quantity } from "fhir/r4";

import { codeableText, codeKey } from "./format";

export type Flag = "low" | "high" | "critical" | "normal";

export type Point = {
  date: string;
  value: number;
  unit: string;
  flag?: Flag;
  observationId?: string;
};

/** One measured thing (e.g. "Glucose" or "Systolic blood pressure") over time. */
export type Series = {
  key: string;
  name: string;
  category: "vital-signs" | "laboratory" | "other";
  unit: string;
  points: Point[]; // oldest first
  latest: Point;
  range?: { low?: number; high?: number };
};

const effectiveDate = (o: Observation) => o.effectiveDateTime ?? o.effectivePeriod?.start ?? o.issued;

function category(o: Observation): Series["category"] {
  const codes = o.category?.flatMap((c) => c.coding?.map((x) => x.code) ?? []) ?? [];
  if (codes.includes("vital-signs")) return "vital-signs";
  if (codes.includes("laboratory")) return "laboratory";
  return "other";
}

function rangeOf(ranges: ObservationReferenceRange[] | undefined): Series["range"] {
  const r = ranges?.find((x) => x.low?.value !== undefined || x.high?.value !== undefined);
  return r ? { low: r.low?.value, high: r.high?.value } : undefined;
}

/**
 * The server's own interpretation wins (H, L, HH, LL…); otherwise compare
 * the value with the reference range, if there is one.
 */
export function flagFor(value: number, interpretation: CodeableConcept[] | undefined, range: Series["range"]): Flag | undefined {
  const code = interpretation?.flatMap((i) => i.coding ?? []).find((c) => c.code)?.code;
  if (code) {
    if (["HH", "LL", "AA"].includes(code)) return "critical";
    if (["H", "HU", ">"].includes(code)) return "high";
    if (["L", "LU", "<"].includes(code)) return "low";
    if (code === "N") return "normal";
  }
  if (!range) return undefined;
  if (range.low !== undefined && value < range.low) return "low";
  if (range.high !== undefined && value > range.high) return "high";
  return "normal";
}

type Measurement = {
  key: string;
  name: string;
  quantity: Quantity;
  range?: Series["range"];
  interpretation?: CodeableConcept[];
};

/** Plain observations have one value; panels such as blood pressure carry several components. */
function measurements(o: Observation): Measurement[] {
  if (o.valueQuantity?.value !== undefined) {
    return [{ key: codeKey(o.code), name: codeableText(o.code), quantity: o.valueQuantity, range: rangeOf(o.referenceRange), interpretation: o.interpretation }];
  }
  return (o.component ?? []).flatMap((c) =>
    c.valueQuantity?.value !== undefined
      ? [{ key: codeKey(c.code), name: codeableText(c.code), quantity: c.valueQuantity, range: rangeOf(c.referenceRange), interpretation: c.interpretation }]
      : [],
  );
}

type Pending = Point & { ownRange?: Series["range"]; interpretation?: CodeableConcept[] };

/** Groups numeric observations into series, newest-measured series first. */
export function toSeries(observations: Observation[]): Series[] {
  const byKey = new Map<string, Omit<Series, "latest" | "points"> & { points: Pending[] }>();
  for (const o of observations) {
    const date = effectiveDate(o);
    if (!date || o.status === "entered-in-error" || o.status === "cancelled") continue;
    for (const m of measurements(o)) {
      let series = byKey.get(m.key);
      if (!series) {
        series = { key: m.key, name: m.name, category: category(o), unit: m.quantity.unit ?? m.quantity.code ?? "", points: [], range: m.range };
        byKey.set(m.key, series);
      }
      series.range ??= m.range;
      series.points.push({
        date,
        value: m.quantity.value!,
        unit: m.quantity.unit ?? m.quantity.code ?? "",
        observationId: o.id,
        ownRange: m.range,
        interpretation: m.interpretation,
      });
    }
  }
  return [...byKey.values()]
    .map((s) => {
      // Flags are worked out once the series is complete, so readings without
      // their own range use the test's range regardless of arrival order.
      const points: Point[] = s.points
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
        .map(({ ownRange, interpretation, ...p }) => ({ ...p, flag: flagFor(p.value, interpretation, ownRange ?? s.range) }));
      return { ...s, points, latest: points.at(-1)! };
    })
    .sort((a, b) => Date.parse(b.latest.date) - Date.parse(a.latest.date) || a.name.localeCompare(b.name));
}

/** Change between the last two readings, as a direction and amount. */
export function trend(series: Series): { direction: "up" | "down" | "flat"; delta: number } | undefined {
  const [prev, last] = series.points.slice(-2);
  if (!prev || !last) return undefined;
  const delta = last.value - prev.value;
  const tolerance = Math.abs(prev.value) * 0.02; // under 2% counts as stable
  return { direction: Math.abs(delta) <= tolerance ? "flat" : delta > 0 ? "up" : "down", delta };
}

/** Observations that aren't numeric (e.g. smoking status), newest first, one per code. */
export function latestCoded(observations: Observation[]): { name: string; value: string; date?: string }[] {
  const seen = new Map<string, { name: string; value: string; date?: string }>();
  const sorted = [...observations].sort((a, b) => Date.parse(effectiveDate(b) ?? "0") - Date.parse(effectiveDate(a) ?? "0"));
  for (const o of sorted) {
    const value = o.valueCodeableConcept ? codeableText(o.valueCodeableConcept) : o.valueString;
    const key = codeKey(o.code);
    if (value && !seen.has(key)) seen.set(key, { name: codeableText(o.code), value, date: effectiveDate(o) });
  }
  return [...seen.values()];
}

const LOINC = "http://loinc.org";

/** Common vital signs by LOINC code, in the order a clinician scans them. */
const VITALS: { label: string; codes: string[] }[] = [
  { label: "Heart rate", codes: ["8867-4"] },
  { label: "Respiratory rate", codes: ["9279-1"] },
  { label: "Temperature", codes: ["8310-5", "8331-1"] },
  { label: "Oxygen saturation", codes: ["59408-5", "2708-6"] },
  { label: "Weight", codes: ["29463-7"] },
  { label: "BMI", codes: ["39156-5"] },
];

export type VitalTile = { label: string; value: string; unit: string; date: string; flag?: Flag };

/** The latest reading of each common vital sign; systolic and diastolic become one blood pressure tile. */
export function latestVitals(series: Series[], format: (n: number) => string = String): VitalTile[] {
  const byCode = new Map(series.map((s) => [s.key, s]));
  const find = (codes: string[]) => codes.map((c) => byCode.get(`${LOINC}|${c}`)).find(Boolean);
  const tiles: VitalTile[] = [];

  const sys = find(["8480-6"]);
  const dia = find(["8462-4"]);
  if (sys && dia) {
    const worst = [sys.latest.flag, dia.latest.flag].find((f) => f && f !== "normal");
    // Blood pressure is always read in whole mmHg.
    const bp = `${Math.round(sys.latest.value)}/${Math.round(dia.latest.value)}`;
    tiles.push({ label: "Blood pressure", value: bp, unit: "mmHg", date: sys.latest.date, flag: worst });
  }
  for (const vital of VITALS) {
    const s = find(vital.codes);
    if (s) tiles.push({ label: vital.label, value: format(s.latest.value), unit: s.latest.unit, date: s.latest.date, flag: s.latest.flag });
  }
  return tiles;
}

/** US Core smoking status codes; some servers file them under "survey" rather than "social-history". */
const SOCIAL_CODES = new Set([`${LOINC}|72166-2`, `${LOINC}|11367-0`]);

export function socialHistory(observations: Observation[]) {
  return latestCoded(
    observations.filter(
      (o) => SOCIAL_CODES.has(codeKey(o.code)) || o.category?.some((c) => c.coding?.some((x) => x.code === "social-history")),
    ),
  );
}
