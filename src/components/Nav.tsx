import { For } from "solid-js";
import { go, route, type Route } from "../lib/route";

const ALL: { to: Route; label: string }[] = [
  { to: "log", label: "Daily log" },
  { to: "progress", label: "Progress" },
  { to: "doses", label: "Doses" },
  { to: "endoscopy", label: "Endoscopy" },
  { to: "setup", label: "Setup" },
];

const PHONE: { to: Route; label: string; also?: Route[] }[] = [
  { to: "log", label: "Log" },
  { to: "progress", label: "Progress" },
  { to: "doses", label: "Doses" },
  { to: "more", label: "More", also: ["endoscopy", "setup"] },
];

/** Top tabs from 768px up. */
export function TopNav() {
  return (
    <nav class="-mb-px hidden gap-0.5 md:flex" aria-label="Screens">
      <For each={ALL}>
        {(item) => (
          <a
            href={`#${item.to}`}
            onClick={(e) => {
              e.preventDefault();
              go(item.to);
            }}
            aria-current={route() === item.to ? "page" : undefined}
            class={`border-b-3 px-3 py-2 text-[0.9rem] font-semibold ${
              route() === item.to ? "border-accent text-accent" : "border-transparent text-muted"
            }`}
          >
            {item.label}
          </a>
        )}
      </For>
    </nav>
  );
}

/** Bottom tab bar on phones. */
export function BottomNav() {
  const active = (item: (typeof PHONE)[number]) =>
    route() === item.to || (item.also ?? []).includes(route());

  return (
    <nav
      class="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Screens"
    >
      <For each={PHONE}>
        {(item) => (
          <a
            href={`#${item.to}`}
            onClick={(e) => {
              e.preventDefault();
              go(item.to);
            }}
            aria-current={active(item) ? "page" : undefined}
            class={`flex min-h-14 items-center justify-center border-t-3 text-[0.85rem] font-semibold ${
              active(item) ? "border-accent text-accent" : "border-transparent text-muted"
            }`}
          >
            {item.label}
          </a>
        )}
      </For>
    </nav>
  );
}
