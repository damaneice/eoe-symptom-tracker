import { createSignal } from "solid-js";

export const ROUTES = ["log", "progress", "doses", "endoscopy", "setup", "more"] as const;
export type Route = (typeof ROUTES)[number];

const parse = (): Route => {
  const name = location.hash.slice(1).split("?")[0];
  return (ROUTES as readonly string[]).includes(name ?? "") ? (name as Route) : "log";
};

/** The current screen, from the URL hash, so the back button and bookmarks work. */
export const [route, setRoute] = createSignal<Route>(parse());

window.addEventListener("hashchange", () => setRoute(parse()));

export function go(to: Route): void {
  if (location.hash !== `#${to}`) location.hash = to;
  setRoute(to);
  window.scrollTo({ top: 0 });
}
