import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";

import { ServerProvider } from "../data/ServerProvider";
import { FHIR_BASE } from "./server";

/** Renders routes with fresh providers pointed at the mock FHIR server. */
export function renderRoutes(routes: RouteObject[], path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <ServerProvider initialUrl={FHIR_BASE}>
        <RouterProvider router={router} />
      </ServerProvider>
    </QueryClientProvider>,
  );
  return router;
}
