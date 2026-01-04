import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";

import { ServerProvider } from "./data/ServerProvider";
import { routes } from "./routes";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServerProvider>
        <RouterProvider router={router} />
      </ServerProvider>
    </QueryClientProvider>
  );
}
