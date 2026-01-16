import type { FhirResource, Patient } from "fhir/r4";
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";

import { JsonView } from "../../components/JsonView";
import { Loading } from "../../components/States";
import {
  useAllergies,
  useConditions,
  useEncounters,
  useImmunizations,
  useMedications,
  useObservations,
  useProcedures,
} from "../../data/queries";
import { useServer } from "../../data/server-context";
import { exportBundle } from "../../fhir/clinical";
import { formatName } from "../../fhir/format";
import labs from "./Labs.module.css";
import styles from "./Patient.module.css";

/** Every resource type the explorer loads, exactly as the server returned it. */
export function RawDataTab() {
  const { id = "" } = useParams();
  const patient = useOutletContext<Patient>();
  const { client } = useServer();
  const queries = {
    Condition: useConditions(id),
    MedicationRequest: useMedications(id),
    AllergyIntolerance: useAllergies(id),
    Encounter: useEncounters(id),
    Procedure: useProcedures(id),
    Immunization: useImmunizations(id),
    Observation: useObservations(id),
  };
  const [type, setType] = useState<"Patient" | keyof typeof queries>("Patient");

  const loading = Object.values(queries).some((q) => q.isPending);
  const loaded: FhirResource[] = [patient, ...Object.values(queries).flatMap((q): FhirResource[] => q.data?.resources ?? [])];

  const download = () => {
    const bundle = exportBundle(client.baseUrl, loaded);
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${formatName(patient.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-bundle.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selected = type === "Patient" ? patient : queries[type].data?.resources;

  return (
    <>
      <div className={labs.toolbar}>
        <div className={labs.filters} role="group" aria-label="Resource type">
          {(["Patient", ...Object.keys(queries)] as const).map((t) => {
            const count = t === "Patient" ? 1 : queries[t as keyof typeof queries].data?.resources.length;
            return (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t as typeof type)}>
                {t}
                {count !== undefined && <span className={styles.muted}> {count}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className={styles.action} onClick={download} disabled={loading}>
          {loading ? "Loading record…" : `Download FHIR Bundle (${loaded.length} resources)`}
        </button>
      </div>
      {selected === undefined ? <Loading label={`Loading ${type}`} /> : <JsonView value={selected} label={`${type} JSON`} />}
    </>
  );
}
