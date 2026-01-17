import type { CapabilityStatement } from "fhir/r4";
import { describe, expect, it } from "vitest";

import { summarizeCapabilities } from "./capabilities";

const statement = (fhirVersion: CapabilityStatement["fhirVersion"], types: string[]): CapabilityStatement => ({
  resourceType: "CapabilityStatement",
  status: "active",
  date: "2024-01-01",
  kind: "instance",
  format: ["json"],
  fhirVersion,
  software: { name: "HAPI FHIR Server", version: "7.4.0" },
  rest: [
    {
      mode: "server",
      resource: types.map((type) => ({
        type,
        searchParam: type === "Patient" ? [{ name: "name", type: "string" }, { name: "birthdate", type: "date" }] : [],
      })),
    },
  ],
});

describe("summarizeCapabilities", () => {
  it("reports version, software and search support", () => {
    const summary = summarizeCapabilities(
      statement("4.0.1", ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Encounter", "Procedure", "Immunization", "Group"]),
    );
    expect(summary).toEqual({
      software: "HAPI FHIR Server 7.4.0",
      fhirVersion: "4.0.1",
      isR4: true,
      resourceCount: 9,
      patientSearchParams: ["birthdate", "name"],
      missing: [],
    });
  });

  it("flags non-R4 servers and missing resource types", () => {
    const summary = summarizeCapabilities(statement("5.0.0", ["Patient", "Observation"]));
    expect(summary.isR4).toBe(false);
    expect(summary.missing).toEqual(["Condition", "MedicationRequest", "AllergyIntolerance", "Encounter", "Procedure", "Immunization"]);
  });
});
