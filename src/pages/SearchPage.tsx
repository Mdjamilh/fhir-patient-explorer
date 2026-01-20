import type { Patient } from "fhir/r4";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";

import { Empty, ErrorState, Loading } from "../components/States";
import { usePatientSearch, type PatientQuery } from "../data/queries";
import { useServer } from "../data/server-context";
import { linkOf, resourcesOf } from "../fhir/client";
import { capitalize, formatAddress, formatDate, formatNameSortable, medicalRecordNumber, patientAge } from "../fhir/format";
import { rememberSearch, useDocumentTitle } from "../hooks";
import styles from "./SearchPage.module.css";

const FIELDS = ["name", "birthdate", "gender", "identifier"] as const;

function queryFrom(params: URLSearchParams): PatientQuery {
  const query: PatientQuery = {};
  for (const field of FIELDS) {
    const value = params.get(field)?.trim();
    if (value) query[field] = value;
  }
  return query;
}

export function SearchPage() {
  useDocumentTitle("Find a patient");
  const [params, setParams] = useSearchParams();
  const query = queryFrom(params);
  // Paging links for the pages visited so far (the last one is the current
  // page), tied to the search they belong to so back/forward starts over.
  const [paging, setPaging] = useState<{ search: string; pages: string[] }>({ search: "", pages: [] });
  const { client } = useServer();
  const pagingKey = `${client.baseUrl}?${params}`;
  const pages = paging.search === pagingKey ? paging.pages : [];
  const setPages = (update: (pages: string[]) => string[]) => setPaging({ search: pagingKey, pages: update(pages) });
  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = usePatientSearch(query, pages.at(-1));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const field of FIELDS) {
      const value = String(form.get(field) ?? "").trim();
      if (value) next.set(field, value);
    }
    setParams(next);
  };

  useEffect(() => rememberSearch(params.size ? `?${params}` : ""), [params]);

  const patients = resourcesOf<Patient>(data, "Patient");
  const next = linkOf(data, "next");
  const pageNumber = pages.length + 1;

  return (
    <>
      <h1 className={styles.title}>Find a patient</h1>
      <p className={styles.lead}>Search by name, date of birth, gender or identifier. Leave everything blank to browse.</p>

      {/* key resets the uncontrolled inputs when the URL changes (back/forward). */}
      <form key={params.toString()} className={styles.form} onSubmit={onSubmit} role="search">
        <label className={styles.field}>
          Name
          <input name="name" defaultValue={query.name} placeholder="e.g. Smith" autoComplete="off" />
        </label>
        <label className={styles.field}>
          Date of birth
          <input name="birthdate" type="date" defaultValue={query.birthdate} />
        </label>
        <label className={styles.field}>
          Gender
          <select name="gender" defaultValue={query.gender ?? ""}>
            <option value="">Any</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label className={styles.field}>
          Identifier
          <input name="identifier" defaultValue={query.identifier} placeholder="MRN or other ID" autoComplete="off" />
        </label>
        <button type="submit" className={styles.primary}>
          Search
        </button>
      </form>

      {isPending ? (
        <Loading label="Searching patients" lines={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : patients.length === 0 ? (
        <Empty>No patients match this search.</Empty>
      ) : (
        <section aria-label="Search results" className={isPlaceholderData ? styles.fading : undefined} aria-busy={isFetching}>
          <div className={styles.meta}>
            <span>
              {data?.total !== undefined ? `${data.total.toLocaleString()} patients` : `${patients.length} shown`} · page {pageNumber}
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Gender</th>
                  <th scope="col">Date of birth</th>
                  <th scope="col">Age</th>
                  <th scope="col">Location</th>
                  <th scope="col">ID</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td className={styles.name}>
                      <Link to={`/patients/${encodeURIComponent(p.id!)}`}>{formatNameSortable(p.name)}</Link>
                    </td>
                    <td>{capitalize(p.gender)}</td>
                    <td>{formatDate(p.birthDate)}</td>
                    <td>{patientAge(p) ?? "—"}</td>
                    <td>{[p.address?.[0]?.city, p.address?.[0]?.state].filter(Boolean).join(", ") || formatAddress(p.address) || "—"}</td>
                    <td className={styles.mono}>{medicalRecordNumber(p.identifier) ?? p.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className={styles.pager} aria-label="Pagination">
            <button type="button" disabled={pages.length === 0} onClick={() => setPages((s) => s.slice(0, -1))}>
              Previous
            </button>
            <button type="button" disabled={!next} onClick={() => next && setPages((s) => [...s, next])}>
              Next
            </button>
          </nav>
        </section>
      )}
    </>
  );
}
