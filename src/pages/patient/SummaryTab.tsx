import type { UseQueryResult } from "@tanstack/react-query";
import { useId, type ReactNode } from "react";
import { Link, useParams } from "react-router";

import { Loading } from "../../components/States";
import { useAllergies, useConditions, useEncounters, useMedications, useObservations } from "../../data/queries";
import { activeAllergies, conditionOnset, encounterClass, medicationName, sortConditions, sortMedications } from "../../fhir/clinical";
import { codeableText, formatDate, formatNumber, formatPeriod, formatUnit } from "../../fhir/format";
import { latestVitals, socialHistory, toSeries } from "../../fhir/observations";
import { FlagBadge } from "./LabsTab";
import styles from "./Patient.module.css";
import s from "./Summary.module.css";

const LIMIT = 6;

/** A summary card that loads independently, so one slow resource doesn't hold up the rest. */
function Card<T>({ title, query, link, children }: { title: string; query: UseQueryResult<T>; link?: string; children: (data: T) => ReactNode }) {
  const headingId = useId();
  return (
    <section className={s.card} aria-labelledby={headingId}>
      <h2 id={headingId} className={s.cardTitle}>
        {title}
        {link && <Link to={link}>View all</Link>}
      </h2>
      {query.isPending ? (
        <Loading label={`Loading ${title.toLowerCase()}`} lines={3} />
      ) : query.isError ? (
        <p className={s.none}>Couldn't load: {query.error.message}</p>
      ) : (
        children(query.data)
      )}
    </section>
  );
}

const None = ({ children }: { children: ReactNode }) => <p className={s.none}>{children}</p>;

export function SummaryTab() {
  const { id = "" } = useParams();
  const observations = useObservations(id);

  return (
    <>
      <section className={styles.section} aria-labelledby="vitals-title">
        <h2 id="vitals-title" className={styles.sectionTitle}>
          Latest vitals
        </h2>
        {observations.isPending ? (
          <Loading label="Loading vitals" lines={2} />
        ) : observations.isError ? (
          <None>Couldn't load vitals: {observations.error.message}</None>
        ) : (
          (() => {
            const tiles = latestVitals(toSeries(observations.data.resources), formatNumber);
            if (!tiles.length) return <None>No vital signs recorded.</None>;
            return (
              <div className={s.vitals}>
                {tiles.map((t) => (
                  <div key={t.label} className={s.vital}>
                    <div className={s.vitalLabel}>{t.label}</div>
                    <div className={s.vitalValue}>
                      {t.value}
                      <span className={s.vitalUnit}>{formatUnit({ unit: t.unit })}</span>
                    </div>
                    <div className={s.sub}>
                      {formatDate(t.date)} <FlagBadge flag={t.flag === "normal" ? undefined : t.flag} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </section>

      <div className={styles.grid}>
        <Card title="Active conditions" query={useConditions(id)} link="conditions">
          {({ resources }) => {
            const { active } = sortConditions(resources);
            if (!active.length) return <None>None recorded.</None>;
            return (
              <ul className={s.list}>
                {active.slice(0, LIMIT).map((c) => (
                  <li key={c.id}>
                    <span>{codeableText(c.code)}</span>
                    <span className={s.sub}>since {formatDate(conditionOnset(c))}</span>
                  </li>
                ))}
                {active.length > LIMIT && <li className={s.sub}>and {active.length - LIMIT} more</li>}
              </ul>
            );
          }}
        </Card>

        <Card title="Current medications" query={useMedications(id)} link="medications">
          {({ resources }) => {
            const { active } = sortMedications(resources);
            if (!active.length) return <None>None recorded.</None>;
            return (
              <ul className={s.list}>
                {active.slice(0, LIMIT).map((m) => (
                  <li key={m.id}>
                    <span>{medicationName(m)}</span>
                  </li>
                ))}
                {active.length > LIMIT && <li className={s.sub}>and {active.length - LIMIT} more</li>}
              </ul>
            );
          }}
        </Card>

        <Card title="Allergies" query={useAllergies(id)}>
          {({ resources }) => {
            const allergies = activeAllergies(resources);
            // "No known allergies" is a clinical statement; here we only know none are recorded.
            if (!allergies.length) return <None>None recorded.</None>;
            return (
              <ul className={s.list}>
                {allergies.map((a) => (
                  <li key={a.id}>
                    <span>{codeableText(a.code)}</span>
                    <span className={s.sub}>{a.criticality === "high" ? "High risk" : (a.reaction?.[0]?.manifestation?.[0] && codeableText(a.reaction[0].manifestation[0]))}</span>
                  </li>
                ))}
              </ul>
            );
          }}
        </Card>

        <Card title="Recent visits" query={useEncounters(id)} link="visits">
          {({ resources }) => {
            const recent = [...resources].sort((a, b) => Date.parse(b.period?.start ?? "0") - Date.parse(a.period?.start ?? "0")).slice(0, 4);
            if (!recent.length) return <None>None recorded.</None>;
            return (
              <ul className={s.list}>
                {recent.map((e) => (
                  <li key={e.id}>
                    <span>{e.type?.[0] ? codeableText(e.type[0]) : encounterClass(e)}</span>
                    <span className={s.sub}>{formatPeriod(e.period)}</span>
                  </li>
                ))}
              </ul>
            );
          }}
        </Card>

        <Card title="Social history" query={observations}>
          {({ resources }) => {
            const social = socialHistory(resources);
            if (!social.length) return <None>None recorded.</None>;
            return (
              <ul className={s.list}>
                {social.map((o) => (
                  <li key={o.name}>
                    <span>
                      {o.name}: <strong>{o.value}</strong>
                    </span>
                    <span className={s.sub}>{formatDate(o.date)}</span>
                  </li>
                ))}
              </ul>
            );
          }}
        </Card>
      </div>
    </>
  );
}
