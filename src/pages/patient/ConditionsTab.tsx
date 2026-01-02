import type { Condition } from "fhir/r4";
import { useParams } from "react-router";

import { Badge, DataTable, type Column, type Tone } from "../../components/DataTable";
import { QueryView, TruncatedNote } from "../../components/QueryView";
import { Empty } from "../../components/States";
import { useConditions } from "../../data/queries";
import { conditionOnset, conditionStatus, sortConditions } from "../../fhir/clinical";
import { capitalize, codeableText, formatDate } from "../../fhir/format";
import styles from "./Patient.module.css";

const TONE: Record<string, Tone> = { active: "warn", recurrence: "warn", relapse: "warn", resolved: "ok", remission: "ok", inactive: "neutral" };

const columns: Column<Condition>[] = [
  { header: "Condition", cell: (c) => codeableText(c.code) },
  { header: "Status", cell: (c) => <Badge tone={TONE[conditionStatus(c)]}>{capitalize(conditionStatus(c))}</Badge> },
  { header: "Onset", cell: (c) => formatDate(conditionOnset(c)), nowrap: true },
  { header: "Resolved", cell: (c) => formatDate(c.abatementDateTime ?? c.abatementPeriod?.start), nowrap: true },
];

export function ConditionsTab() {
  const { id = "" } = useParams();
  return (
    <QueryView query={useConditions(id)} label="conditions">
      {({ resources, truncated }) => {
        const { active, past } = sortConditions(resources);
        if (!active.length && !past.length) return <Empty>No conditions recorded.</Empty>;
        return (
          <>
            <TruncatedNote truncated={truncated} what="conditions" />
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Active ({active.length})</h2>
              {active.length ? <DataTable rows={active} columns={columns} rowKey={(c) => c.id!} /> : <Empty>No active conditions.</Empty>}
            </section>
            {past.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Past ({past.length})</h2>
                <DataTable rows={past} columns={columns} rowKey={(c) => c.id!} />
              </section>
            )}
          </>
        );
      }}
    </QueryView>
  );
}
