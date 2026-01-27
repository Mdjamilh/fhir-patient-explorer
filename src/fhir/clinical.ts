import type {
  AllergyIntolerance,
  Bundle,
  Condition,
  Encounter,
  FhirResource,
  Immunization,
  MedicationRequest,
  Procedure,
} from "fhir/r4";

import { codeableText } from "./format";

const time = (value: string | undefined) => (value ? Date.parse(value) : 0);
const newestFirst = <T>(date: (x: T) => string | undefined) => (a: T, b: T) => time(date(b)) - time(date(a));

/** "active", "resolved", etc. Conditions without a clinical status count as unknown. */
export function conditionStatus(c: Condition): string {
  return c.clinicalStatus?.coding?.[0]?.code ?? "unknown";
}

const ACTIVE_CONDITION = new Set(["active", "recurrence", "relapse"]);

export const conditionOnset = (c: Condition) => c.onsetDateTime ?? c.onsetPeriod?.start ?? c.recordedDate;

/** Active problems first, each group newest first; refuted and entered-in-error are dropped. */
export function sortConditions(conditions: Condition[]): { active: Condition[]; past: Condition[] } {
  const usable = conditions.filter((c) => {
    const verification = c.verificationStatus?.coding?.[0]?.code;
    return verification !== "refuted" && verification !== "entered-in-error";
  });
  const sorted = [...usable].sort(newestFirst(conditionOnset));
  return {
    active: sorted.filter((c) => ACTIVE_CONDITION.has(conditionStatus(c))),
    past: sorted.filter((c) => !ACTIVE_CONDITION.has(conditionStatus(c))),
  };
}

export function medicationName(m: MedicationRequest): string {
  return m.medicationCodeableConcept ? codeableText(m.medicationCodeableConcept) : (m.medicationReference?.display ?? "Unknown medication");
}

export function sortMedications(meds: MedicationRequest[]): { active: MedicationRequest[]; past: MedicationRequest[] } {
  const usable = meds.filter((m) => m.status !== "entered-in-error");
  const sorted = [...usable].sort(newestFirst((m) => m.authoredOn));
  return { active: sorted.filter((m) => m.status === "active" || m.status === "on-hold"), past: sorted.filter((m) => m.status !== "active" && m.status !== "on-hold") };
}

export function activeAllergies(allergies: AllergyIntolerance[]): AllergyIntolerance[] {
  return allergies.filter((a) => {
    const status = a.clinicalStatus?.coding?.[0]?.code;
    return status !== "inactive" && status !== "resolved" && a.verificationStatus?.coding?.[0]?.code !== "entered-in-error";
  });
}

export const immunizationDate = (i: Immunization) => i.occurrenceDateTime ?? i.recorded;

export function sortImmunizations(items: Immunization[]): Immunization[] {
  return items.filter((i) => i.status !== "entered-in-error").sort(newestFirst(immunizationDate));
}

export type TimelineItem =
  | { kind: "encounter"; date: string; resource: Encounter }
  | { kind: "procedure"; date: string; resource: Procedure };

/** Encounters and procedures merged into one newest-first timeline, grouped by year. */
export function visitTimeline(encounters: Encounter[], procedures: Procedure[]): { year: string; items: TimelineItem[] }[] {
  const items: TimelineItem[] = [];
  for (const e of encounters) {
    const date = e.period?.start;
    if (date && e.status !== "entered-in-error" && e.status !== "cancelled") items.push({ kind: "encounter", date, resource: e });
  }
  for (const p of procedures) {
    const date = p.performedDateTime ?? p.performedPeriod?.start;
    if (date && p.status !== "entered-in-error" && p.status !== "not-done") items.push({ kind: "procedure", date, resource: p });
  }
  items.sort(newestFirst((i) => i.date));

  const years: { year: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const year = item.date.slice(0, 4);
    if (years.at(-1)?.year !== year) years.push({ year, items: [] });
    years.at(-1)!.items.push(item);
  }
  return years;
}

const ENCOUNTER_CLASS: Record<string, string> = {
  AMB: "Outpatient",
  EMER: "Emergency",
  IMP: "Inpatient",
  ACUTE: "Inpatient",
  HH: "Home health",
  VR: "Virtual",
  OBSENC: "Observation",
};

export function encounterClass(e: Encounter): string {
  const code = e.class?.code;
  return (code && ENCOUNTER_CLASS[code]) ?? e.class?.display ?? code ?? "Visit";
}

/**
 * A collection Bundle of everything loaded for the patient, for download.
 * fullUrl uses the server's base so references stay resolvable.
 */
export function exportBundle(baseUrl: string, resources: FhirResource[], now = new Date()): Bundle {
  const seen = new Set<string>();
  const entry = resources.flatMap((resource) => {
    const key = `${resource.resourceType}/${resource.id}`;
    if (!resource.id || seen.has(key)) return [];
    seen.add(key);
    return [{ fullUrl: `${baseUrl}/${key}`, resource }];
  });
  return { resourceType: "Bundle", type: "collection", timestamp: now.toISOString(), entry };
}

export type PrescriptionGroup = { name: string; count: number; first?: string; last?: string; latest: MedicationRequest };

/**
 * Repeat prescriptions of the same medication collapsed into one row, so a
 * statin renewed every year reads as one line rather than twenty.
 */
export function groupPrescriptions(meds: MedicationRequest[]): PrescriptionGroup[] {
  const groups = new Map<string, MedicationRequest[]>();
  for (const m of meds) {
    const name = medicationName(m);
    groups.set(name, [...(groups.get(name) ?? []), m]);
  }
  return [...groups.entries()]
    .map(([name, items]) => {
      const sorted = [...items].sort(newestFirst((m) => m.authoredOn));
      return { name, count: items.length, first: sorted.at(-1)?.authoredOn, last: sorted[0]?.authoredOn, latest: sorted[0]! };
    })
    .sort(newestFirst((g) => g.last));
}
