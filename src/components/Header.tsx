import { Show } from "solid-js";
import { daysBetween } from "../domain/dates";
import { dayDate, shortDate, signedPercent } from "../lib/dates";
import { progressNow, scheduleNow, state, today } from "../lib/store";

function treatmentLabel(): string {
  const { start, today: now } = progressNow();
  if (!start) return "Not started";
  if (start > today()) return `Starts ${shortDate(start)}`;
  return now ? `Wk ${now.week}, day ${now.day}` : "—";
}

function nextDose(): { text: string; tone: string } {
  const { nextDue, status } = scheduleNow();
  const start = progressNow().start;
  if (status === "none") {
    return start && start >= today()
      ? { text: start === today() ? "Today" : shortDate(start), tone: "text-dose" }
      : { text: "None logged", tone: "text-muted" };
  }
  if (status === "due") return { text: "Due today", tone: "text-dose" };
  const days = daysBetween(today(), nextDue!);
  if (status === "overdue") return { text: `Overdue ${-days}d`, tone: "text-bad" };
  return { text: days === 1 ? "Tomorrow" : dayDate(nextDue!), tone: "text-dose" };
}

function Glance(props: { label: string; value: string; class?: string }) {
  return (
    <div class="min-w-0">
      <div class="text-[0.7rem] tracking-[0.06em] text-muted uppercase">{props.label}</div>
      <div class={`truncate font-display text-lg font-semibold tabular-nums ${props.class ?? ""}`}>
        {props.value}
      </div>
    </div>
  );
}

export function Header() {
  const change = () => progressNow().last7Change;

  return (
    <div class="grid gap-2.5 pt-3 pb-3 md:pb-0">
      <h1 class="text-xl">
        {state.settings ? `${state.settings.patientName}'s EoE log` : "EoE log"}
      </h1>
      <div class="grid grid-cols-3 gap-2">
        <Glance label="Treatment" value={treatmentLabel()} />
        <Glance label="Next dose" value={nextDose().text} class={nextDose().tone} />
        <Show when={change()} fallback={<Glance label="Vs baseline" value="—" />}>
          {(c) => (
            <Glance
              label="Vs baseline"
              value={signedPercent(c().percent)}
              class={c().trend === "better" ? "text-good" : c().trend === "worse" ? "text-bad" : ""}
            />
          )}
        </Show>
      </div>
    </div>
  );
}
