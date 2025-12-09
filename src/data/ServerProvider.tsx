import { useMemo, useState, type ReactNode } from "react";

import { createClient, normalizeBaseUrl } from "../fhir/client";
import { ServerContext, type ServerContextValue } from "./server-context";
import { saveServer, savedServer } from "./servers";

/** Holds the FHIR server everything talks to, remembered across visits. */
export function ServerProvider({ children, initialUrl }: { children: ReactNode; initialUrl?: string }) {
  const [url, setUrl] = useState(() => initialUrl ?? savedServer());
  const value = useMemo<ServerContextValue>(
    () => ({
      client: createClient(url),
      setServer(next) {
        const normalized = normalizeBaseUrl(next);
        setUrl(normalized);
        saveServer(normalized);
      },
    }),
    [url],
  );
  return <ServerContext value={value}>{children}</ServerContext>;
}
