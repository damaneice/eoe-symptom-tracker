import { For } from "solid-js";
import { Panel } from "../components/ui";
import { go, type Route } from "../lib/route";

const ITEMS: { to: Route; label: string; hint: string }[] = [
  { to: "endoscopy", label: "Endoscopy", hint: "Biopsy results (eos/hpf)" },
  { to: "events", label: "Events", hint: "Diet, medication and illness changes" },
  { to: "setup", label: "Setup", hint: "Name, schedule and usual dose" },
];

/** The phone's "More" tab: the screens that don't fit in the bottom bar. */
export function More() {
  return (
    <Panel class="gap-0 p-0">
      <For each={ITEMS}>
        {(item) => (
          <a
            href={`#${item.to}`}
            onClick={(e) => {
              e.preventDefault();
              go(item.to);
            }}
            class="flex min-h-14 items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0"
          >
            <span>
              <b class="font-semibold">{item.label}</b>
              <br />
              <span class="text-[0.8rem] text-muted">{item.hint}</span>
            </span>
            <span class="text-muted" aria-hidden="true">
              ›
            </span>
          </a>
        )}
      </For>
    </Panel>
  );
}
