import type { ReactNode } from "react";

import { FhirError } from "../fhir/client";
import styles from "./States.module.css";

export function Loading({ label = "Loading", lines = 4 }: { label?: string; lines?: number }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.bar} style={{ width: `${90 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const status = error instanceof FhirError && error.status ? ` (HTTP ${error.status})` : "";
  return (
    <div className={styles.error} role="alert">
      <strong>Something went wrong{status}</strong>
      <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className={styles.panel}>{children}</div>;
}
