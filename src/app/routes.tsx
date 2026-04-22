import { createBrowserRouter } from "react-router";
import Home from "./components/home";
import Explore from "./components/explore";
import Publish from "./components/publish";
import Docs from "./components/docs";
import AdminStaged from "./components/admin-staged";

export const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/explore", Component: Explore },
  { path: "/publish", Component: Publish },
  { path: "/docs", Component: Docs },
  { path: "/admin/staged", Component: AdminStaged },
]);