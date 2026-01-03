import type { MedicationRequest } from "fhir/r4";
import { useParams } from "react-router";

import { Badge, DataTable, type Column, type Tone } from "../../components/DataTable";
import { QueryView, TruncatedNote } from "../../components/QueryView";
import { Empty } from "../../components/States";
import { useMedications } from "../../data/queries";
import { medicationName, sortMedications } from "../../fhir/clinical";
import { capitalize, codeableText, formatDate } from "../../fhir/format";
import styles from "./Patient.module.css";

const TONE: Partial<Record<MedicationRequest["status"], Tone>> = { active: "accent", "on-hold": "warn", completed: "ok", stopped: "neutral" };

const columns: Column<MedicationRequest>[] = [
  { header: "Medication", cell: medicationName },
  { header: "Status", cell: (m) => <Badge tone={TONE[m.status]}>{capitalize(m.status)}</Badge> },
  { header: "Instructions", cell: (m) => m.dosageInstruction?.[0]?.text ?? <span className={styles.muted}>—</span> },
  { header: "Reason", cell: (m) => (m.reasonCode?.length ? codeableText(m.reasonCode[0]) : <span className={styles.muted}>—</span>) },
  { header: "Prescribed", cell: (m) => formatDate(m.authoredOn), nowrap: true },
];

export function MedicationsTab() {
  const { id = "" } = useParams();
  return (
    <QueryView query={useMedications(id)} label="medications">
      {({ resources, truncated }) => {
        const { active, past } = sortMedications(resources);
        if (!active.length && !past.length) return <Empty>No medications recorded.</Empty>;
        return (
          <>
            <TruncatedNote truncated={truncated} what="prescriptions" />
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Current ({active.length})</h2>
              {active.length ? <DataTable rows={active} columns={columns} rowKey={(m) => m.id!} /> : <Empty>No current medications.</Empty>}
            </section>
            {past.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Previous ({past.length})</h2>
                <DataTable rows={past} columns={columns} rowKey={(m) => m.id!} />
              </section>
            )}
          </>
        );
      }}
    </QueryView>
  );
}
