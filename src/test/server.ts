import { setupServer } from "msw/node";

/** Mock FHIR server for tests. Each test registers the handlers it needs. */
export const server = setupServer();

export const FHIR_BASE = "https://fhir.test/r4";
