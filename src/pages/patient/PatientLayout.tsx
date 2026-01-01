import { Link, NavLink, Outlet, useParams } from "react-router";

import { ErrorState, Loading } from "../../components/States";
import { usePatient } from "../../data/queries";
import {
  capitalize,
  formatAddress,
  formatDate,
  formatName,
  formatTelecom,
  medicalRecordNumber,
  patientAge,
} from "../../fhir/format";
import { lastSearch, useDocumentTitle } from "../../hooks";
import styles from "./Patient.module.css";

const TABS = [
  { to: "", label: "Summary", end: true },
  { to: "labs", label: "Labs & vitals" },
  { to: "conditions", label: "Conditions" },
  { to: "medications", label: "Medications" },
  { to: "visits", label: "Visits" },
  { to: "immunizations", label: "Immunizations" },
  { to: "data", label: "Raw data" },
];

/** Patient banner and tab navigation; each tab is a nested route. */
export function PatientLayout() {
  const { id = "" } = useParams();
  const { data: patient, error, isPending, refetch } = usePatient(id);
  const name = patient ? formatName(patient.name) : undefined;
  useDocumentTitle(name);

  return (
    <>
      <Link to={`/${lastSearch()}`} className={styles.back}>
        ← Back to search
      </Link>

      {isPending ? (
        <Loading label="Loading patient" lines={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <section className={styles.banner} aria-label="Patient details">
            <div className={styles.avatar} aria-hidden>
              {name!
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </div>
            <div>
              <h1 className={styles.name}>{name}</h1>
              <ul className={styles.facts}>
                <li>
                  <strong>{capitalize(patient.gender)}</strong>
                </li>
                <li>
                  Born <strong>{formatDate(patient.birthDate)}</strong>
                  {patientAge(patient) && <> · age {patientAge(patient)}</>}
                </li>
                {medicalRecordNumber(patient.identifier) && (
                  <li>
                    MRN <strong>{medicalRecordNumber(patient.identifier)}</strong>
                  </li>
                )}
                {formatTelecom(patient.telecom, "phone") && <li>{formatTelecom(patient.telecom, "phone")}</li>}
                {formatAddress(patient.address) && <li>{formatAddress(patient.address)}</li>}
              </ul>
            </div>
          </section>

          <nav className={styles.tabs} aria-label="Patient record">
            {TABS.map((tab) => (
              <NavLink key={tab.label} to={tab.to} end={tab.end} className={styles.tab}>
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <Outlet context={patient} />
        </>
      )}
    </>
  );
}
