import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type {
  AllergyIntolerance,
  Condition,
  Encounter,
  FhirResource,
  Immunization,
  MedicationRequest,
  Observation,
  Patient,
  Procedure,
} from "fhir/r4";

import { searchAll, type SearchParams } from "../fhir/client";
import { useServer } from "./server-context";

export type PatientQuery = { name?: string; birthdate?: string; gender?: string; identifier?: string };

export const PAGE_SIZE = 20;

export function useCapabilities() {
  const { client } = useServer();
  return useQuery({
    queryKey: [client.baseUrl, "metadata"],
    queryFn: ({ signal }) => client.capabilities(signal),
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * One page of patient search results. `pageUrl` is a paging link from a
 * previous result; when absent, the search starts from page one.
 */
export function usePatientSearch(query: PatientQuery, pageUrl?: string) {
  const { client } = useServer();
  return useQuery({
    queryKey: [client.baseUrl, "Patient", "search", query, pageUrl ?? null],
    queryFn: ({ signal }) =>
      pageUrl
        ? client.page(pageUrl, signal)
        : client.search("Patient", { ...query, _count: PAGE_SIZE, _total: "accurate" }, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePatient(id: string) {
  const { client } = useServer();
  return useQuery({
    queryKey: [client.baseUrl, "Patient", id],
    queryFn: ({ signal }) => client.read<Patient>("Patient", id, signal),
  });
}

/** Everything of one resource type for a patient, following pages up to a limit. */
function usePatientResources<T extends FhirResource>(type: T["resourceType"], patientId: string, params: SearchParams = {}, max = 500) {
  const { client } = useServer();
  return useQuery({
    queryKey: [client.baseUrl, type, "patient", patientId, params],
    queryFn: ({ signal }) => searchAll<T>(client, type, { patient: patientId, _count: 100, ...params }, { max, signal }),
    staleTime: 5 * 60_000,
  });
}

export const useConditions = (id: string) => usePatientResources<Condition>("Condition", id);
export const useMedications = (id: string) => usePatientResources<MedicationRequest>("MedicationRequest", id);
export const useAllergies = (id: string) => usePatientResources<AllergyIntolerance>("AllergyIntolerance", id);
export const useEncounters = (id: string) => usePatientResources<Encounter>("Encounter", id);
export const useImmunizations = (id: string) => usePatientResources<Immunization>("Immunization", id);
export const useProcedures = (id: string) => usePatientResources<Procedure>("Procedure", id);
/** Newest first, so the limit keeps recent results for patients with long histories. */
export const useObservations = (id: string) => usePatientResources<Observation>("Observation", id, { _sort: "-date" }, 1000);
