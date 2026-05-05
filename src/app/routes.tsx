import { createBrowserRouter } from "react-router";
import Home from "./components/home";

// Home is the landing page — keeping it in the main bundle minimizes the
// LCP of the first paint. Every other route is split into its own chunk
// and only fetched when the user navigates to it. React Router's `lazy`
// property integrates with the router's own pending-navigation state, so
// we don't need Suspense boundaries.
//
// Each route's dynamic import is factored into a named function so nav
// links can call it on mouseenter/focus to preload the chunk before the
// user actually clicks. Vite dedupes identical dynamic imports.
//
// lazyRetry handles stale chunks after a new deploy — if the old
// chunk filename is gone, reload the page once to get the new HTML.

function lazyRetry<T>(importFn: () => Promise<T>): () => Promise<T> {
  return () =>
    importFn().catch((err: Error) => {
      // Only retry once per session to avoid infinite reload loops
      const retried = sessionStorage.getItem("skiyu-chunk-retry");
      if (!retried) {
        sessionStorage.setItem("skiyu-chunk-retry", "1");
        window.location.reload();
      }
      throw err;
    });
}

const importExplore = lazyRetry(() => import("./components/explore"));
const importPublish = lazyRetry(() => import("./components/publish"));
const importDocs = lazyRetry(() => import("./components/docs"));
const importAdminStaged = lazyRetry(() => import("./components/admin-staged"));
const importSkillDetail = lazyRetry(() => import("./components/skill-detail"));
const importAuthor = lazyRetry(() => import("./components/author"));
const importRun = lazyRetry(() => import("./components/run"));

export const preloadRoute = {
  "/explore": importExplore,
  "/publish": importPublish,
  "/docs": importDocs,
  "/admin/staged": importAdminStaged,
  "/author": importAuthor,
  "/run": importRun,
} as const;

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  {
    path: "/explore",
    lazy: async () => {
      const { default: Explore } = await importExplore();
      return { Component: Explore };
    },
  },
  {
    path: "/publish",
    lazy: async () => {
      const { default: Publish } = await importPublish();
      return { Component: Publish };
    },
  },
  {
    path: "/docs",
    lazy: async () => {
      const { default: Docs } = await importDocs();
      return { Component: Docs };
    },
  },
  {
    path: "/admin/staged",
    lazy: async () => {
      const { default: AdminStaged } = await importAdminStaged();
      return { Component: AdminStaged };
    },
  },
  {
    path: "/skills/:slug",
    lazy: async () => {
      const { default: SkillDetail } = await importSkillDetail();
      return { Component: SkillDetail };
    },
  },
  {
    path: "/author",
    lazy: async () => {
      const { default: Author } = await importAuthor();
      return { Component: Author };
    },
  },
  {
    path: "/run",
    lazy: async () => {
      const { default: Run } = await importRun();
      return { Component: Run };
    },
  },
]);