import { useParams } from "react-router";

import { Badge } from "../../components/DataTable";
import { ErrorState, Empty, Loading } from "../../components/States";
import { useEncounters, useProcedures } from "../../data/queries";
import { encounterClass, visitTimeline, type TimelineItem } from "../../fhir/clinical";
import { codeableText, formatDate, formatPeriod } from "../../fhir/format";
import styles from "./Visits.module.css";

function Entry({ item }: { item: TimelineItem }) {
  if (item.kind === "procedure") {
    const p = item.resource;
    return (
      <li className={styles.entry} data-kind="procedure">
        <div className={styles.head}>
          <span className={styles.title}>{codeableText(p.code)}</span>
          <Badge tone="warn">Procedure</Badge>
          <span className={styles.date}>{formatDate(item.date)}</span>
        </div>
        {p.reasonCode?.[0] && <p className={styles.detail}>Reason: {codeableText(p.reasonCode[0])}</p>}
      </li>
    );
  }
  const e = item.resource;
  const kind = encounterClass(e);
  return (
    <li className={styles.entry} data-kind="encounter" data-class={kind}>
      <div className={styles.head}>
        <span className={styles.title}>{e.type?.[0] ? codeableText(e.type[0]) : "Encounter"}</span>
        <Badge tone={kind === "Emergency" || kind === "Inpatient" ? "danger" : "accent"}>{kind}</Badge>
        <span className={styles.date}>{formatPeriod(e.period)}</span>
      </div>
      {(e.reasonCode?.[0] || e.serviceProvider?.display) && (
        <p className={styles.detail}>
          {e.reasonCode?.[0] && <>Reason: {codeableText(e.reasonCode[0])}</>}
          {e.reasonCode?.[0] && e.serviceProvider?.display && " · "}
          {e.serviceProvider?.display}
        </p>
      )}
    </li>
  );
}

export function VisitsTab() {
  const { id = "" } = useParams();
  const encounters = useEncounters(id);
  const procedures = useProcedures(id);

  if (encounters.isPending || procedures.isPending) return <Loading label="Loading visits" />;
  const failed = encounters.error ?? procedures.error;
  if (failed) return <ErrorState error={failed} onRetry={() => void Promise.all([encounters.refetch(), procedures.refetch()])} />;

  const years = visitTimeline(encounters.data!.resources, procedures.data!.resources);
  if (!years.length) return <Empty>No visits or procedures recorded.</Empty>;

  return (
    <>
      <div className={styles.legend} aria-hidden>
        <span>
          <span className={styles.swatch} style={{ background: "var(--accent)" }} />
          Visit
        </span>
        <span>
          <span className={styles.swatch} style={{ background: "var(--danger)" }} />
          Emergency or inpatient
        </span>
        <span>
          <span className={styles.swatch} style={{ background: "var(--warn)" }} />
          Procedure
        </span>
      </div>
      {years.map(({ year, items }) => (
        <section key={year} aria-labelledby={`year-${year}`}>
          <h2 id={`year-${year}`} className={styles.year}>
            {year}
          </h2>
          <ol className={styles.timeline}>
            {items.map((item) => (
              <Entry key={`${item.kind}-${item.resource.id}`} item={item} />
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
