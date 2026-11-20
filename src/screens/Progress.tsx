import { createSignal, For, Show } from "solid-js";
import { biopsyLabel } from "../domain/biopsy";
import { Chart, type Range } from "../components/Chart";
import { Empty, Hint, Panel, Segmented } from "../components/ui";
import { BIOPSY_LABELS } from "../lib/labels";
import { longDate, oneDecimal, shortDate, signedPercent } from "../lib/dates";
import { progressNow, state, today } from "../lib/store";

const RANGES: { value: number; label: string; range: Range }[] = [
  { value: 0, label: "12 weeks", range: "12w" },
  { value: 1, label: "6 months", range: "6m" },
  { value: 2, label: "All", range: "all" },
];

function readRange(): number {
  try {
    return Number(localStorage.getItem("progress-range") ?? 0) || 0;
  } catch {
    return 0;
  }
}

function Stat(props: { label: string; value: string; hint?: string }) {
  return (
    <div class="min-w-0 rounded-[10px] bg-bg px-3 py-2.5">
      <div class="text-xs text-muted">{props.label}</div>
      <div class="font-display text-xl font-semibold tabular-nums">
        {props.value}{" "}
        <Show when={props.hint}>
          <Hint>{props.hint}</Hint>
        </Show>
      </div>
    </div>
  );
}

export function Progress() {
  const [rangeIndex, setRangeIndex] = createSignal(readRange());
  const range = () => RANGES[rangeIndex()]?.range ?? "12w";
  const p = progressNow;

  const since = () =>
    p().baseline?.since === "treatment" ? "since treatment started" : "since tracking started";
  const latestScope = () => state.scopes.at(-1);
  const impactionsOnTreatment = () =>
    p()
      .weeks.filter((w) => w.week >= 1)
      .reduce((total, w) => total + w.impactions, 0);
  const vsBaseline = (average: number) => {
    const base = p().baseline?.value;
    return base ? ((average - base) * 100) / base : null;
  };

  return (
    <Show
      when={state.logs.length > 0}
      fallback={
        <Empty>
          Log a few days and the chart, baseline and week-by-week table will appear here.
        </Empty>
      }
    >
      <div class="grid gap-4">
        <Panel>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg">Weekly symptom score</h2>
            <Show when={p().start}>
              {(start) => <Hint>Week 1 started {longDate(start())}</Hint>}
            </Show>
          </div>
          <div class="max-w-xs">
            <Segmented
              label="Chart range"
              options={RANGES}
              value={rangeIndex()}
              onChange={(v) => {
                setRangeIndex(v ?? 0);
                try {
                  localStorage.setItem("progress-range", String(v ?? 0));
                } catch {
                  // Remembering the range is a convenience; ignore storage errors.
                }
              }}
            />
          </div>
          <Chart
            progress={p()}
            logs={state.logs}
            doses={state.doses}
            scopes={state.scopes}
            today={today()}
            range={range()}
          />
          <div class="flex flex-wrap gap-x-3.5 gap-y-1 text-[0.8rem] text-muted">
            <span>
              <i class="mr-1 inline-block h-[3px] w-3.5 rounded bg-accent align-middle" />
              Weekly average
            </span>
            <Show when={range() !== "all"}>
              <span>
                <i class="mr-1 inline-block size-2 rounded-full bg-muted/50 align-middle" />
                Daily score
              </span>
            </Show>
            <span>
              <i class="mr-1 inline-block w-3.5 border-t-2 border-dashed border-muted align-middle" />
              Baseline
            </span>
            <span>
              <i class="mr-1 inline-block h-2.5 w-[3px] bg-dose align-middle" />
              Dose
            </span>
            <span>
              <i class="mr-1 inline-block size-2 rotate-45 bg-bad align-middle" />
              Biopsy (eos/hpf)
            </span>
            <span>
              <i class="mr-1 inline-block h-2.5 w-3.5 bg-accent-soft align-middle" />
              Before treatment
            </span>
          </div>
        </Panel>

        <Panel>
          <h3 class="text-[0.95rem]">Where things stand</h3>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
            <Stat
              label="Baseline"
              value={oneDecimal(p().baseline?.value)}
              hint={
                p().baseline
                  ? p().baseline!.since === "treatment"
                    ? "pre-treatment"
                    : "first week"
                  : undefined
              }
            />
            <Stat label="Last 7 days" value={oneDecimal(p().last7Average)} />
            <Stat
              label="Best week"
              value={
                p().bestWeek === null
                  ? "—"
                  : oneDecimal(p().weeks.find((w) => w.week === p().bestWeek)?.averageScore)
              }
              hint={
                p().bestWeek === null
                  ? undefined
                  : p().bestWeek === 0
                    ? "pre"
                    : `wk ${p().bestWeek}`
              }
            />
            <Stat
              label="Halved from baseline"
              value={p().halvedWeek === null ? "Not yet" : `Week ${p().halvedWeek}`}
            />
            <Stat label="Impactions on treatment" value={String(impactionsOnTreatment())} />
            <Show when={latestScope()} fallback={<Stat label="Latest biopsy" value="—" />}>
              {(s) => (
                <Stat
                  label="Latest biopsy"
                  value={String(s().peakEosHpf)}
                  hint={`eos/hpf · ${BIOPSY_LABELS[biopsyLabel(s().peakEosHpf)].text.toLowerCase()}`}
                />
              )}
            </Show>
          </div>
          <Hint>
            <Show when={p().baseline} fallback="Log at least 3 days in a week to set a baseline.">
              The baseline is the average {since()}. "Halved" is the first week, with at least 3
              days logged, averaging half the baseline or less. Weeks with fewer than 3 days logged
              aren't used for the baseline, best week or halved.
            </Show>
          </Hint>
        </Panel>

        <Panel>
          <h3 class="text-[0.95rem]">Week by week</h3>
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-[0.85rem] tabular-nums">
              <thead>
                <tr class="text-left text-xs tracking-[0.04em] text-muted uppercase">
                  <For
                    each={[
                      "Week",
                      "Dates",
                      "Days",
                      "Avg score",
                      "Vs base",
                      "Day rating",
                      "Bad days",
                      "Impactions",
                    ]}
                  >
                    {(h) => (
                      <th class="border-b border-line px-2 py-1.5 font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={[...p().weeks].reverse()}>
                  {(w) => {
                    const change = () =>
                      w.week === p().baseline?.week ? null : vsBaseline(w.averageScore);
                    const cell = "border-b border-line px-2 py-1.5 whitespace-nowrap";
                    return (
                      <tr>
                        <td class={cell}>
                          {w.week === 0 ? "Before" : w.week}
                          <Show when={w.week === p().baseline?.week}>
                            {" "}
                            <Hint>baseline</Hint>
                          </Show>
                        </td>
                        <td class={cell}>
                          {shortDate(w.from)}–{shortDate(w.to)}
                        </td>
                        <td class={cell}>{w.daysLogged}</td>
                        <td class={cell}>{oneDecimal(w.averageScore)}</td>
                        <td
                          class={`${cell} ${
                            change() === null
                              ? "text-muted"
                              : change()! <= -10
                                ? "text-good"
                                : change()! >= 10
                                  ? "text-bad"
                                  : ""
                          }`}
                        >
                          {change() === null ? "—" : signedPercent(change()!)}
                        </td>
                        <td class={cell}>{oneDecimal(w.averageOverall)}</td>
                        <td class={cell}>{w.badDays}</td>
                        <td class={cell}>{w.impactions}</td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </Show>
  );
}
