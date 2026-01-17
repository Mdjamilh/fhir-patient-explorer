import type { CapabilityStatement } from "fhir/r4";

export type ServerSummary = {
  software?: string;
  fhirVersion: string;
  isR4: boolean;
  resourceCount: number;
  patientSearchParams: string[];
  /** Resource types this explorer reads that the server doesn't list. */
  missing: string[];
};

const USED = ["Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Encounter", "Procedure", "Immunization"];

/** What a CapabilityStatement says about whether this explorer will work. */
export function summarizeCapabilities(cs: CapabilityStatement): ServerSummary {
  const resources = cs.rest?.find((r) => r.mode === "server")?.resource ?? [];
  const types = new Set(resources.map((r) => r.type));
  const patient = resources.find((r) => r.type === "Patient");
  return {
    software: cs.software ? [cs.software.name, cs.software.version].filter(Boolean).join(" ") : undefined,
    fhirVersion: cs.fhirVersion,
    isR4: cs.fhirVersion.startsWith("4.0"),
    resourceCount: types.size,
    patientSearchParams: (patient?.searchParam ?? []).map((p) => p.name).sort(),
    missing: USED.filter((t) => !types.has(t)),
  };
}
