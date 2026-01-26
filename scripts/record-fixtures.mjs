// Records real responses from the SMART Health IT sandbox for the browser
// tests, so they run offline and don't depend on a public server being up.
// Usage: node scripts/record-fixtures.mjs
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://r4.smarthealthit.org";
const PATIENT = "618b2992-eec7-45c9-8544-12c9f586b78c";
const OUT = new URL("../e2e/fixtures/", import.meta.url);
const TYPES = ["Observation", "Condition", "MedicationRequest", "AllergyIntolerance", "Encounter", "Procedure", "Immunization"];

async function get(path) {
  const response = await fetch(`${BASE}/${path}`, { headers: { Accept: "application/fhir+json" } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

/** Drops generated narrative HTML and server paging links to keep fixtures small and self-contained. */
function slim(resource) {
  if (resource.resourceType === "Bundle") {
    return {
      resourceType: "Bundle",
      type: resource.type,
      total: resource.total,
      entry: (resource.entry ?? []).map((e) => ({ fullUrl: e.fullUrl, resource: slim(e.resource) })),
    };
  }
  const { text: _text, ...rest } = resource;
  return rest;
}

async function save(name, data) {
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(data, null, 1) + "\n");
  console.log(`saved ${name}.json`);
}

await mkdir(OUT, { recursive: true });

const metadata = await get("metadata");
await save("metadata", {
  resourceType: "CapabilityStatement",
  status: metadata.status,
  date: metadata.date,
  kind: metadata.kind,
  fhirVersion: metadata.fhirVersion,
  format: metadata.format,
  software: metadata.software,
  rest: metadata.rest.map((r) => ({
    mode: r.mode,
    resource: r.resource.map((x) => ({ type: x.type, searchParam: x.searchParam?.map(({ name, type }) => ({ name, type })) })),
  })),
});
await save("patient-search", slim(await get("Patient?name=smith&_count=20&_total=accurate")));
await save("patient", slim(await get(`Patient/${PATIENT}`)));
for (const type of TYPES) {
  const sort = type === "Observation" ? "&_sort=-date" : "";
  await save(type, slim(await get(`${type}?patient=${PATIENT}&_count=250${sort}`)));
}
