import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { ErrorState, Loading } from "../components/States";
import { useCapabilities } from "../data/queries";
import { useServer } from "../data/server-context";
import { PRESETS, validateServerUrl } from "../data/servers";
import { summarizeCapabilities } from "../fhir/capabilities";
import { createClient, normalizeBaseUrl } from "../fhir/client";
import { useDocumentTitle } from "../hooks";
import search from "./SearchPage.module.css";
import styles from "./ServerPage.module.css";

export function ServerPage() {
  useDocumentTitle("FHIR server");
  const { client, setServer } = useServer();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const metadata = useCapabilities();
  const [custom, setCustom] = useState("");
  const [problem, setProblem] = useState<string>();
  const [checking, setChecking] = useState(false);

  /** Checks that the URL answers as a FHIR server before switching to it. */
  const connect = async (url: string) => {
    const invalid = validateServerUrl(url);
    if (invalid) return setProblem(invalid);
    setProblem(undefined);
    setChecking(true);
    try {
      const candidate = createClient(url);
      const statement = await candidate.capabilities();
      if (statement.resourceType !== "CapabilityStatement") throw new Error("That URL didn't return a FHIR CapabilityStatement");
      queryClient.setQueryData([candidate.baseUrl, "metadata"], statement);
      setServer(url);
      navigate("/");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not connect");
    } finally {
      setChecking(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void connect(custom);
  };

  return (
    <>
      <h1 className={search.title}>FHIR server</h1>
      <p className={search.lead}>
        Pick a public test server or connect to your own. The server must speak FHIR R4 and allow requests from browsers (CORS).
      </p>

      <div className={styles.presets}>
        {PRESETS.map((p) => (
          <button
            key={p.url}
            type="button"
            className={styles.preset}
            aria-pressed={normalizeBaseUrl(p.url) === client.baseUrl}
            disabled={checking}
            onClick={() => void connect(p.url)}
          >
            <strong>{p.name}</strong>
            <span className={styles.presetUrl}>{p.url}</span>
            <span className={styles.presetNote}>{p.note}</span>
          </button>
        ))}
      </div>

      <form className={styles.custom} onSubmit={onSubmit}>
        <label htmlFor="server-url" className="visually-hidden">
          FHIR base URL
        </label>
        <input
          id="server-url"
          type="url"
          placeholder="https://example.org/fhir"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? "server-problem" : "server-hint"}
        />
        <button type="submit" className={search.primary} disabled={checking || !custom.trim()}>
          {checking ? "Checking…" : "Connect"}
        </button>
        {problem ? (
          <p id="server-problem" className={styles.problem} role="alert">
            {problem}
          </p>
        ) : (
          <p id="server-hint" className={styles.hint}>
            The base URL, the part before /Patient.
          </p>
        )}
      </form>

      <h2 className={styles.subtitle}>
        Current server
      </h2>
      <p className={search.lead}>{client.baseUrl}</p>
      {metadata.isPending ? (
        <Loading label="Reading server capabilities" lines={3} />
      ) : metadata.isError ? (
        <ErrorState error={metadata.error} onRetry={() => void metadata.refetch()} />
      ) : (
        (() => {
          const s = summarizeCapabilities(metadata.data);
          return (
            <>
              <dl className={styles.facts}>
                <dt>FHIR version</dt>
                <dd>{s.fhirVersion}</dd>
                <dt>Software</dt>
                <dd>{s.software ?? "Not stated"}</dd>
                <dt>Resource types</dt>
                <dd>{s.resourceCount}</dd>
                <dt>Patient search</dt>
                <dd>{s.patientSearchParams.length ? s.patientSearchParams.join(", ") : "Not stated"}</dd>
              </dl>
              {!s.isR4 && <p className={styles.warning}>This server reports FHIR {s.fhirVersion}. The explorer is built for R4, so some views may be empty.</p>}
              {s.missing.length > 0 && (
                <p className={styles.warning}>This server doesn't list {s.missing.join(", ")}, so those sections may be empty.</p>
              )}
            </>
          );
        })()
      )}
    </>
  );
}
