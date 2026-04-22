import { createBrowserRouter } from "react-router";
import Home from "./components/home";

// Home is the landing page — keeping it in the main bundle minimizes the
// LCP of the first paint. Every other route is split into its own chunk
// and only fetched when the user navigates to it. React Router's `lazy`
// property integrates with the router's own pending-navigation state, so
// we don't need Suspense boundaries.

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  {
    path: "/explore",
    lazy: async () => {
      const { default: Explore } = await import("./components/explore");
      return { Component: Explore };
    },
  },
  {
    path: "/publish",
    lazy: async () => {
      const { default: Publish } = await import("./components/publish");
      return { Component: Publish };
    },
  },
  {
    path: "/docs",
    lazy: async () => {
      const { default: Docs } = await import("./components/docs");
      return { Component: Docs };
    },
  },
  {
    path: "/admin/staged",
    lazy: async () => {
      const { default: AdminStaged } = await import("./components/admin-staged");
      return { Component: AdminStaged };
    },
  },
]);