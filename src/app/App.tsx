import { RouterProvider } from "react-router";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./routes";
import { AuthProvider } from "@/lib/auth";

// One client per app. 30s staleTime means typing in the search box
// won't refetch queries we just saw; 5min gc keeps the cache around
// long enough for back-nav to feel instant. No auto-refetch on focus
// since the skills catalog doesn't change by the second.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <SpeedInsights />
      </AuthProvider>
    </QueryClientProvider>
  );
}
