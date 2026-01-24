import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { routes } from "../routes";
import { renderRoutes } from "../test/render";
import { FHIR_BASE, server } from "../test/server";

describe("unknown pages", () => {
  it("show a not-found page inside the app shell", async () => {
    server.use(http.get(`${FHIR_BASE}/metadata`, () => HttpResponse.json({ resourceType: "CapabilityStatement", fhirVersion: "4.0.1" })));
    renderRoutes(routes, "/nope/nothing");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /FHIR Patient Explorer/ })).toBeInTheDocument();
  });
});
