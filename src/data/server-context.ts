import { createContext, useContext } from "react";

import type { FhirClient } from "../fhir/client";

export type ServerContextValue = { client: FhirClient; setServer: (url: string) => void };

export const ServerContext = createContext<ServerContextValue | null>(null);

export function useServer(): ServerContextValue {
  const value = useContext(ServerContext);
  if (!value) throw new Error("useServer must be used inside <ServerProvider>");
  return value;
}
