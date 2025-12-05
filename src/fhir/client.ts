import type { Bundle, CapabilityStatement, FhirResource, OperationOutcome, Resource } from "fhir/r4";

const TIMEOUT_MS = 20_000;

/** A failed FHIR request, with the server's OperationOutcome message when it sent one. */
export class FhirError extends Error {
  readonly status: number;
  readonly outcome?: OperationOutcome;

  constructor(message: string, status: number, outcome?: OperationOutcome) {
    super(message);
    this.name = "FhirError";
    this.status = status;
    this.outcome = outcome;
  }
}

export type SearchParams = Record<string, string | number | undefined>;

export interface FhirClient {
  readonly baseUrl: string;
  capabilities(signal?: AbortSignal): Promise<CapabilityStatement>;
  read<T extends Resource>(type: T["resourceType"], id: string, signal?: AbortSignal): Promise<T>;
  search(type: string, params?: SearchParams, signal?: AbortSignal): Promise<Bundle>;
  /** Follows a paging link (Bundle.link next/previous) returned by this server. */
  page(url: string, signal?: AbortSignal): Promise<Bundle>;
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function describeOutcome(outcome: OperationOutcome | undefined): string | undefined {
  const issue = outcome?.issue?.find((i) => i.diagnostics || i.details?.text);
  return issue?.diagnostics ?? issue?.details?.text;
}

const isOutcome = (value: unknown): value is OperationOutcome =>
  typeof value === "object" && value !== null && (value as Resource).resourceType === "OperationOutcome";

export function createClient(baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args)): FhirClient {
  const base = normalizeBaseUrl(baseUrl);
  const origin = new URL(base).origin;

  async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/fhir+json" },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timeout.aborted) throw new FhirError(`The server took longer than ${TIMEOUT_MS / 1000}s to respond`, 0);
      // fetch rejects with a TypeError for network and CORS failures.
      throw new FhirError("Could not reach the server. Check the URL, your connection, and that it allows browser (CORS) requests.", 0);
    }

    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const outcome = isOutcome(body) ? body : undefined;
      throw new FhirError(describeOutcome(outcome) ?? `Request failed with HTTP ${response.status}`, response.status, outcome);
    }
    if (body === undefined) throw new FhirError("The server returned something that isn't FHIR JSON", response.status);
    return body as T;
  }

  const query = (params: SearchParams = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.append(key, String(value));
    }
    const text = search.toString();
    return text ? `?${text}` : "";
  };

  return {
    baseUrl: base,
    capabilities: (signal) => get<CapabilityStatement>(`${base}/metadata`, signal),
    read: <T extends Resource>(type: string, id: string, signal?: AbortSignal) =>
      get<T>(`${base}/${type}/${encodeURIComponent(id)}`, signal),
    search: (type, params, signal) => get<Bundle>(`${base}/${type}${query(params)}`, signal),
    page(url, signal) {
      // Paging links come from the server, but never follow one to a different host.
      if (new URL(url, base).origin !== origin) {
        return Promise.reject(new FhirError("Refusing to follow a paging link to another server", 0));
      }
      return get<Bundle>(new URL(url, base).href, signal);
    },
  };
}

/** Resources of one type from a search bundle, skipping included resources and OperationOutcomes. */
export function resourcesOf<T extends FhirResource>(bundle: Bundle | undefined, type: T["resourceType"]): T[] {
  return (bundle?.entry ?? []).flatMap((e) => (e.resource?.resourceType === type ? [e.resource as T] : []));
}

export function linkOf(bundle: Bundle | undefined, relation: "next" | "previous" | "prev" | "self"): string | undefined {
  return bundle?.link?.find((l) => l.relation === relation)?.url;
}

/**
 * Runs a search and follows `next` links until there are no more pages or
 * `max` resources have been collected (to keep huge records bounded).
 */
export async function searchAll<T extends FhirResource>(
  client: FhirClient,
  type: T["resourceType"],
  params: SearchParams,
  { max = 1000, signal }: { max?: number; signal?: AbortSignal } = {},
): Promise<{ resources: T[]; truncated: boolean }> {
  let bundle = await client.search(type, params, signal);
  const resources = resourcesOf<T>(bundle, type);
  let next = linkOf(bundle, "next");
  while (next && resources.length < max) {
    bundle = await client.page(next, signal);
    resources.push(...resourcesOf<T>(bundle, type));
    next = linkOf(bundle, "next");
  }
  return { resources: resources.slice(0, max), truncated: Boolean(next) || resources.length > max };
}
