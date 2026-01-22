import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bundle, FhirResource, Observation, Patient } from "fhir/r4";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { routes } from "../../routes";
import { renderRoutes } from "../../test/render";
import { FHIR_BASE, server } from "../../test/server";

const patient: Patient = {
  resourceType: "Patient",
  id: "p1",
  name: [{ use: "official", given: ["Maria365"], family: "Garcia512" }],
  gender: "female",
  birthDate: "1980-06-15",
  identifier: [{ type: { coding: [{ code: "MR" }] }, value: "MRN-1001" }],
};

const LOINC = "http://loinc.org";
const obs = (code: string, display: string, value: number, unit: string, date: string, extra: Partial<Observation> = {}): Observation => ({
  resourceType: "Observation",
  id: `${code}-${date}`,
  status: "final",
  category: [{ coding: [{ code: code === "2339-0" ? "laboratory" : "vital-signs" }] }],
  code: { coding: [{ system: LOINC, code, display }] },
  effectiveDateTime: date,
  valueQuantity: { value, unit },
  ...extra,
});

const records: Record<string, FhirResource[]> = {
  Observation: [
    obs("2339-0", "Glucose", 92, "mg/dL", "2023-01-10", { referenceRange: [{ low: { value: 70 }, high: { value: 99 } }] }),
    obs("2339-0", "Glucose", 126, "mg/dL", "2024-01-10", { referenceRange: [{ low: { value: 70 }, high: { value: 99 } }] }),
    obs("8867-4", "Heart rate", 71, "/min", "2024-01-10"),
  ],
  Condition: [
    {
      resourceType: "Condition",
      id: "c1",
      subject: { reference: "Patient/p1" },
      clinicalStatus: { coding: [{ code: "active" }] },
      code: { text: "Type 2 diabetes" },
      onsetDateTime: "2024-01-10",
    },
  ],
  MedicationRequest: [
    {
      resourceType: "MedicationRequest",
      id: "m1",
      status: "active",
      intent: "order",
      subject: { reference: "Patient/p1" },
      medicationCodeableConcept: { text: "Metformin 500 MG" },
    },
  ],
};

function mockRecord() {
  server.use(
    http.get(`${FHIR_BASE}/metadata`, () => HttpResponse.json({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1" })),
    http.get(`${FHIR_BASE}/Patient/p1`, () => HttpResponse.json(patient)),
    http.get(`${FHIR_BASE}/:type`, ({ params, request }) => {
      expect(new URL(request.url).searchParams.get("patient")).toBe("p1");
      const resources = records[String(params.type)] ?? [];
      return HttpResponse.json({ resourceType: "Bundle", type: "searchset", entry: resources.map((resource) => ({ resource })) } satisfies Bundle);
    }),
  );
}

describe("patient record", () => {
  it("shows the banner and a summary of the record", async () => {
    mockRecord();
    renderRoutes(routes, "/patients/p1");

    expect(await screen.findByRole("heading", { level: 1, name: "Maria Garcia" })).toBeInTheDocument();
    expect(screen.getByText("MRN-1001")).toBeInTheDocument();

    const conditions = await screen.findByRole("region", { name: /Active conditions/ });
    expect(await within(conditions).findByText("Type 2 diabetes")).toBeInTheDocument();
    const meds = screen.getByRole("region", { name: /Current medications/ });
    expect(await within(meds).findByText("Metformin 500 MG")).toBeInTheDocument();
    expect(await screen.findByText("Heart rate")).toBeInTheDocument();
  });

  it("charts a lab and flags results outside the reference range", async () => {
    mockRecord();
    const router = renderRoutes(routes, "/patients/p1/labs");

    const tests = await screen.findByRole("list", { name: "Tests" });
    await userEvent.click(within(tests).getByRole("button", { name: /Glucose/ }));
    expect(router.state.location.search).toBe(`?test=${encodeURIComponent(`${LOINC}|2339-0`)}`);

    const panel = screen.getByRole("region", { name: "Glucose" });
    expect(within(panel).getByText(/2 readings · normal range 70 to 99 mg\/dL/)).toBeInTheDocument();
    const rows = within(panel).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).queryByText(/High|Normal/)?.textContent)).toEqual(["High", "Normal"]);

    await userEvent.click(screen.getByRole("button", { name: "Vital signs" }));
    expect(within(tests).queryByRole("button", { name: /Glucose/ })).not.toBeInTheDocument();
  });

  it("explains when the patient doesn't exist", async () => {
    server.use(
      http.get(`${FHIR_BASE}/metadata`, () => HttpResponse.json({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1" })),
      http.get(`${FHIR_BASE}/Patient/nope`, () =>
        HttpResponse.json({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found", diagnostics: "Resource Patient/nope is not known" }] }, { status: 404 }),
      ),
    );
    renderRoutes(routes, "/patients/nope");
    expect(await screen.findByRole("alert")).toHaveTextContent("Resource Patient/nope is not known");
  });
});
