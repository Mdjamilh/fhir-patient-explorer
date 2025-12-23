import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";

import { Layout } from "./components/Layout";
import { ServerProvider } from "./data/ServerProvider";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [{ index: true, element: <p>Search coming soon</p> }],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ServerProvider>
        <RouterProvider router={router} />
      </ServerProvider>
    </QueryClientProvider>
  );
}
