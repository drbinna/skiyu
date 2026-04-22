import { RouterProvider } from "react-router";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { router } from "./routes";
import { AuthProvider } from "@/lib/auth";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <SpeedInsights />
    </AuthProvider>
  );
}
