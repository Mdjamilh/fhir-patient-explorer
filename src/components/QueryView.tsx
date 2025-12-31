import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ErrorState, Loading } from "./States";

/** Loading, error and success states for a query, so tabs only describe the success case. */
export function QueryView<T>({ query, label, children }: { query: UseQueryResult<T>; label: string; children: (data: T) => ReactNode }) {
  if (query.isPending) return <Loading label={`Loading ${label}`} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data)}</>;
}

/** Shown when a search hit the page limit, so the list isn't mistaken for the full record. */
export function TruncatedNote({ truncated, what }: { truncated: boolean; what: string }) {
  if (!truncated) return null;
  return <p role="note">Showing the most recent {what} only; this record has more than the explorer loads at once.</p>;
}
