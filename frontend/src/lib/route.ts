import { useEffect, useState } from "react";
import type { TextKey } from "./i18n";

export interface RouteDef {
  path: string;
  label: TextKey;
}

export const ROUTES: RouteDef[] = [
  { path: "/", label: "nav_dashboard" },
  { path: "/earnings", label: "nav_earnings" },
  { path: "/assistant", label: "nav_assistant" },
  { path: "/safety", label: "nav_safety" },
  { path: "/documents", label: "nav_documents" },
  { path: "/grievance", label: "nav_grievance" },
  { path: "/settings", label: "nav_settings" },
];

/** Current route from the URL hash, e.g. "#/earnings" -> "/earnings". Unknown paths go home. */
export function parseHash(hash: string): string {
  const path = hash.replace(/^#/, "") || "/";
  return ROUTES.some((r) => r.path === path) ? path : "/";
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function useRoute(): string {
  const [path, setPath] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setPath(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return path;
}
