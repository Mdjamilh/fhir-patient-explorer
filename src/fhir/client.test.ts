import type { Bundle, Patient } from "fhir/r4";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { FHIR_BASE, server } from "../test/server";
import { createClient, FhirError, linkOf, normalizeBaseUrl, resourcesOf, searchAll } from "./client";

const patient = (id: string): Patient => ({ resourceType: "Patient", id });

const bundle = (ids: string[], next?: string): Bundle => ({
  resourceType: "Bundle",
  type: "searchset",
  entry: ids.map((id) => ({ resource: patient(id) })),
  link: next ? [{ relation: "next", url: next }] : [],
});

describe("createClient", () => {
  it("normalizes the base URL and sends FHIR JSON accept headers", async () => {
    let accept: string | null = null;
    let url = "";
    server.use(
      http.get(`${FHIR_BASE}/Patient`, ({ request }) => {
        accept = request.headers.get("accept");
        url = request.url;
        return HttpResponse.json(bundle(["a"]));
      }),
    );
    const client = createClient(`${FHIR_BASE}//`);
    expect(client.baseUrl).toBe(FHIR_BASE);
    await client.search("Patient", { name: "smith", gender: undefined, birthdate: "", _count: 10 });
    expect(accept).toBe("application/fhir+json");
    expect(new URL(url).search).toBe("?name=smith&_count=10");
  });

  it("reads a resource by id, encoding the id", async () => {
    server.use(http.get(`${FHIR_BASE}/Patient/:id`, ({ params }) => HttpResponse.json(patient(String(params.id)))));
    expect((await createClient(FHIR_BASE).read<Patient>("Patient", "abc 1")).id).toBe("abc 1");
  });

  it("reports the OperationOutcome message on errors", async () => {
    server.use(
      http.get(`${FHIR_BASE}/Patient/missing`, () =>
        HttpResponse.json(
          { resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found", diagnostics: "Resource Patient/missing is not known" }] },
          { status: 404 },
        ),
      ),
    );
    const error = await createClient(FHIR_BASE).read("Patient", "missing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FhirError);
    expect(error).toMatchObject({ status: 404, message: "Resource Patient/missing is not known" });
  });

  it("falls back to the HTTP status and explains network failures", async () => {
    server.use(
      http.get(`${FHIR_BASE}/Patient`, () => new HttpResponse("oops", { status: 502 })),
      http.get(`${FHIR_BASE}/Observation`, () => HttpResponse.error()),
    );
    const client = createClient(FHIR_BASE);
    await expect(client.search("Patient")).rejects.toThrow("Request failed with HTTP 502");
    await expect(client.search("Observation")).rejects.toThrow(/CORS/);
  });

  it("refuses to follow paging links to another host", async () => {
    await expect(createClient(FHIR_BASE).page("https://evil.example/Patient?page=2")).rejects.toThrow(/another server/);
  });
});

describe("bundle helpers", () => {
  it("picks resources of one type and paging links", () => {
    const b: Bundle = {
      resourceType: "Bundle",
      type: "searchset",
      entry: [
        { resource: patient("a") },
        { resource: { resourceType: "OperationOutcome", issue: [] } },
        { resource: patient("b") },
      ],
      link: [{ relation: "next", url: "n" }],
    };
    expect(resourcesOf<Patient>(b, "Patient").map((p) => p.id)).toEqual(["a", "b"]);
    expect(linkOf(b, "next")).toBe("n");
    expect(linkOf(b, "previous")).toBeUndefined();
    expect(resourcesOf(undefined, "Patient")).toEqual([]);
  });

  it("normalizes base URLs", () => {
    expect(normalizeBaseUrl("  https://x.org/fhir/ ")).toBe("https://x.org/fhir");
  });
});

describe("searchAll", () => {
  it("follows next links and stops at the limit", async () => {
    server.use(
      http.get(`${FHIR_BASE}/Patient`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
        const next = page < 3 ? `${FHIR_BASE}/Patient?page=${page + 1}` : undefined;
        return HttpResponse.json(bundle([`p${page}a`, `p${page}b`], next));
      }),
    );
    const client = createClient(FHIR_BASE);

    const all = await searchAll<Patient>(client, "Patient", {});
    expect(all.resources.map((p) => p.id)).toEqual(["p1a", "p1b", "p2a", "p2b", "p3a", "p3b"]);
    expect(all.truncated).toBe(false);

    const some = await searchAll<Patient>(client, "Patient", {}, { max: 3 });
    expect(some.resources).toHaveLength(3);
    expect(some.truncated).toBe(true);
  });
});
