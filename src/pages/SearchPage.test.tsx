import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Bundle, Patient } from "fhir/r4";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { renderRoutes } from "../test/render";
import { FHIR_BASE, server } from "../test/server";
import { SearchPage } from "./SearchPage";

const patient = (id: string, family: string, given: string): Patient => ({
  resourceType: "Patient",
  id,
  name: [{ use: "official", family, given: [given] }],
  gender: "female",
  birthDate: "1990-04-02",
  address: [{ city: "Boston", state: "MA" }],
});

const routes = [
  { path: "/", element: <SearchPage /> },
  { path: "/patients/:id", element: <p>Patient page</p> },
];

describe("SearchPage", () => {
  it("searches with the form values and lists matching patients", async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(`${FHIR_BASE}/Patient`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        const results = params.get("name") === "lee" ? [patient("p2", "Lee", "Ann")] : [patient("p1", "Smith", "Jane")];
        return HttpResponse.json({ resourceType: "Bundle", type: "searchset", total: results.length, entry: results.map((resource) => ({ resource })) } satisfies Bundle);
      }),
    );
    const router = renderRoutes(routes, "/");

    expect(await screen.findByRole("link", { name: "Smith, Jane" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "lee");
    await userEvent.selectOptions(screen.getByLabelText("Gender"), "female");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    const row = (await screen.findByRole("link", { name: "Lee, Ann" })).closest("tr")!;
    expect(within(row).getByText("Boston, MA")).toBeInTheDocument();
    expect(router.state.location.search).toBe("?name=lee&gender=female");
    expect(requests.at(-1)?.get("gender")).toBe("female");
    expect(requests.at(-1)?.get("_count")).toBe("20");
    expect(screen.getByText(/1 patients · page 1/)).toBeInTheDocument();
  });

  it("pages through results with the server's next links", async () => {
    server.use(
      http.get(`${FHIR_BASE}/Patient`, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page");
        const bundle: Bundle = page
          ? { resourceType: "Bundle", type: "searchset", entry: [{ resource: patient("p2", "Page", "Two") }] }
          : {
              resourceType: "Bundle",
              type: "searchset",
              entry: [{ resource: patient("p1", "Page", "One") }],
              link: [{ relation: "next", url: `${FHIR_BASE}/Patient?page=2` }],
            };
        return HttpResponse.json(bundle);
      }),
    );
    renderRoutes(routes, "/");

    await screen.findByRole("link", { name: "Page, One" });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("link", { name: "Page, Two" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByRole("link", { name: "Page, One" })).toBeInTheDocument();
  });

  it("shows the server's error message", async () => {
    server.use(
      http.get(`${FHIR_BASE}/Patient`, () =>
        HttpResponse.json({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "invalid", diagnostics: "Unknown search parameter" }] }, { status: 400 }),
      ),
    );
    renderRoutes(routes, "/?identifier=x");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown search parameter");
  });
});
