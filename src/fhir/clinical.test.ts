import type { Condition, Encounter, MedicationRequest, Patient, Procedure } from "fhir/r4";
import { describe, expect, it } from "vitest";

import {
  activeAllergies,
  encounterClass,
  exportBundle,
  groupPrescriptions,
  medicationName,
  sortConditions,
  sortMedications,
  visitTimeline,
} from "./clinical";

const condition = (id: string, status: string, onset: string, verification?: string): Condition => ({
  resourceType: "Condition",
  id,
  subject: { reference: "Patient/p" },
  clinicalStatus: { coding: [{ code: status }] },
  ...(verification ? { verificationStatus: { coding: [{ code: verification }] } } : {}),
  onsetDateTime: onset,
});

describe("conditions", () => {
  it("splits active from past, newest first, and drops refuted entries", () => {
    const { active, past } = sortConditions([
      condition("old-active", "active", "2001-01-01"),
      condition("resolved", "resolved", "2020-01-01"),
      condition("new-active", "recurrence", "2019-01-01"),
      condition("wrong", "active", "2022-01-01", "refuted"),
    ]);
    expect(active.map((c) => c.id)).toEqual(["new-active", "old-active"]);
    expect(past.map((c) => c.id)).toEqual(["resolved"]);
  });
});

describe("medications", () => {
  const med = (id: string, status: MedicationRequest["status"], authoredOn: string, extra: Partial<MedicationRequest> = {}): MedicationRequest => ({
    resourceType: "MedicationRequest",
    id,
    status,
    intent: "order",
    subject: { reference: "Patient/p" },
    authoredOn,
    ...extra,
  });

  it("names medications from a code or a reference", () => {
    expect(medicationName(med("a", "active", "2020", { medicationCodeableConcept: { text: "Lisinopril 10 MG" } }))).toBe("Lisinopril 10 MG");
    expect(medicationName(med("b", "active", "2020", { medicationReference: { display: "Metformin" } }))).toBe("Metformin");
    expect(medicationName(med("c", "active", "2020"))).toBe("Unknown medication");
  });

  it("groups repeat prescriptions of the same medication", () => {
    const statin = { medicationCodeableConcept: { text: "Simvastatin 10 MG" } };
    const groups = groupPrescriptions([
      med("s1", "stopped", "2019-01-01", statin),
      med("a1", "stopped", "2015-06-01", { medicationCodeableConcept: { text: "Amoxicillin" } }),
      med("s2", "stopped", "2021-01-01", statin),
      med("s3", "stopped", "2017-01-01", statin),
    ]);
    expect(groups.map((g) => [g.name, g.count, g.first, g.last, g.latest.id])).toEqual([
      ["Simvastatin 10 MG", 3, "2017-01-01", "2021-01-01", "s2"],
      ["Amoxicillin", 1, "2015-06-01", "2015-06-01", "a1"],
    ]);
  });

  it("puts active and on-hold prescriptions first", () => {
    const { active, past } = sortMedications([
      med("stopped", "stopped", "2023-01-01"),
      med("hold", "on-hold", "2021-01-01"),
      med("active", "active", "2022-01-01"),
      med("error", "entered-in-error", "2024-01-01"),
    ]);
    expect(active.map((m) => m.id)).toEqual(["active", "hold"]);
    expect(past.map((m) => m.id)).toEqual(["stopped"]);
  });
});

describe("allergies", () => {
  it("keeps allergies that are not inactive or entered in error", () => {
    const allergy = (id: string, status?: string) => ({
      resourceType: "AllergyIntolerance" as const,
      id,
      patient: { reference: "Patient/p" },
      ...(status ? { clinicalStatus: { coding: [{ code: status }] } } : {}),
    });
    expect(activeAllergies([allergy("a", "active"), allergy("b", "inactive"), allergy("c")]).map((a) => a.id)).toEqual(["a", "c"]);
  });
});

describe("visitTimeline", () => {
  it("merges encounters and procedures by year, newest first", () => {
    const encounter = (id: string, start: string, status: Encounter["status"] = "finished"): Encounter => ({
      resourceType: "Encounter",
      id,
      status,
      class: { code: "AMB" },
      period: { start },
    });
    const procedure: Procedure = { resourceType: "Procedure", id: "proc", status: "completed", subject: { reference: "Patient/p" }, performedPeriod: { start: "2023-05-01" } };

    const timeline = visitTimeline(
      [encounter("e1", "2023-01-10"), encounter("e2", "2024-02-01"), encounter("cancelled", "2024-03-01", "cancelled")],
      [procedure],
    );
    expect(timeline.map((y) => [y.year, y.items.map((i) => i.resource.id)])).toEqual([
      ["2024", ["e2"]],
      ["2023", ["proc", "e1"]],
    ]);
  });

  it("names encounter classes", () => {
    expect(encounterClass({ resourceType: "Encounter", status: "finished", class: { code: "EMER" } })).toBe("Emergency");
    expect(encounterClass({ resourceType: "Encounter", status: "finished", class: { code: "XYZ", display: "Custom" } })).toBe("Custom");
  });
});

describe("exportBundle", () => {
  it("builds a collection bundle without duplicates", () => {
    const patient: Patient = { resourceType: "Patient", id: "p" };
    const bundle = exportBundle("https://fhir.test/r4", [patient, patient, { resourceType: "Patient" }], new Date("2026-01-01T00:00:00Z"));
    expect(bundle).toEqual({
      resourceType: "Bundle",
      type: "collection",
      timestamp: "2026-01-01T00:00:00.000Z",
      entry: [{ fullUrl: "https://fhir.test/r4/Patient/p", resource: patient }],
    });
  });
});
