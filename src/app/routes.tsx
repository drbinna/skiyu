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

const importExplore = () => import("./components/explore");
const importPublish = () => import("./components/publish");
const importDocs = () => import("./components/docs");
const importAdminStaged = () => import("./components/admin-staged");
const importSkillDetail = () => import("./components/skill-detail");
const importAuthor = () => import("./components/author");

export const preloadRoute = {
  "/explore": importExplore,
  "/publish": importPublish,
  "/docs": importDocs,
  "/admin/staged": importAdminStaged,
  "/author": importAuthor,
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
]);