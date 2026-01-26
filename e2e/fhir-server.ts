import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

export const SERVER = "https://r4.smarthealthit.org";
export const PATIENT_ID = "618b2992-eec7-45c9-8544-12c9f586b78c";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8");

/**
 * Answers FHIR requests from recorded fixtures (see scripts/record-fixtures.mjs),
 * so the tests never touch the real sandbox.
 */
export async function mockFhirServer(page: Page) {
  await page.route(`${SERVER}/**`, (route) => {
    const url = new URL(route.request().url());
    const [type, id] = url.pathname.slice(1).split("/");
    let body: string | undefined;
    if (type === "metadata") body = fixture("metadata");
    else if (type === "Patient" && id) body = id === PATIENT_ID ? fixture("patient") : undefined;
    else if (type === "Patient") body = fixture("patient-search");
    else if (type && url.searchParams.get("patient") === PATIENT_ID) body = fixture(type);

    if (!body) {
      return route.fulfill({
        status: 404,
        contentType: "application/fhir+json",
        body: JSON.stringify({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found", diagnostics: `Resource ${url.pathname.slice(1)} is not known` }] }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/fhir+json", body });
  });
}
