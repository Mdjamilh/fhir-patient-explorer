import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { useServer } from "../data/server-context";
import { renderRoutes } from "../test/render";
import { FHIR_BASE, server } from "../test/server";
import { ServerPage } from "./ServerPage";

const capability = (version: string) => ({
  resourceType: "CapabilityStatement",
  status: "active",
  kind: "instance",
  fhirVersion: version,
  software: { name: "Test FHIR", version: "1.0" },
  rest: [{ mode: "server", resource: [{ type: "Patient", searchParam: [{ name: "name", type: "string" }] }] }],
});

function CurrentServer() {
  return <p>Now using {useServer().client.baseUrl}</p>;
}

const routes = [
  { path: "/server", element: <ServerPage /> },
  { path: "/", element: <CurrentServer /> },
];

describe("ServerPage", () => {
  it("describes the current server and warns about missing resource types", async () => {
    server.use(http.get(`${FHIR_BASE}/metadata`, () => HttpResponse.json(capability("4.0.1"))));
    renderRoutes(routes, "/server");
    expect(await screen.findByText("Test FHIR 1.0")).toBeInTheDocument();
    expect(screen.getByText("4.0.1")).toBeInTheDocument();
    expect(screen.getByText(/doesn't list Observation, Condition/)).toBeInTheDocument();
  });

  it("checks a custom server before switching to it", async () => {
    server.use(
      http.get(`${FHIR_BASE}/metadata`, () => HttpResponse.json(capability("4.0.1"))),
      http.get("https://other.test/fhir/metadata", () => HttpResponse.json(capability("4.0.1"))),
    );
    renderRoutes(routes, "/server");
    await userEvent.type(screen.getByLabelText("FHIR base URL"), "https://other.test/fhir/");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Now using https://other.test/fhir")).toBeInTheDocument();
  });

  it("stays on the current server when the new one doesn't answer as FHIR", async () => {
    server.use(
      http.get(`${FHIR_BASE}/metadata`, () => HttpResponse.json(capability("4.0.1"))),
      http.get("https://not-fhir.test/metadata", () => HttpResponse.json({ hello: "world" })),
    );
    renderRoutes(routes, "/server");
    await userEvent.type(screen.getByLabelText("FHIR base URL"), "https://not-fhir.test");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("didn't return a FHIR CapabilityStatement");
    expect(screen.queryByText(/Now using/)).not.toBeInTheDocument();
  });
});
