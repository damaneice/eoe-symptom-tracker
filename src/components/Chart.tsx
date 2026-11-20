import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { StoredDose, StoredEvent, StoredLog, StoredScope } from "../domain/api";
import { daysBetween } from "../domain/dates";
import type { Progress } from "../domain/progress";
import { score } from "../domain/score";
import type { IsoDate } from "../domain/types";
import { EVENT_COLORS, EVENT_LABELS } from "../lib/labels";
import { oneDecimal, shortDate } from "../lib/dates";

export type Range = "12w" | "6m" | "all";

const RANGE_WEEKS: Record<Exclude<Range, "all">, number> = { "12w": 12, "6m": 26 };

const HEIGHT = 260;
const PAD = { left: 30, right: 12, top: 30, bottom: 34 };

/**
 * Weekly average line, daily dots, the dashed baseline, dose ticks, event markers and biopsy
 * markers. Weeks run along the x axis; days before treatment sit in a shaded band before week 0.
 */
export function Chart(props: {
  progress: Progress;
  logs: StoredLog[];
  doses: StoredDose[];
  scopes: StoredScope[];
  events: StoredEvent[];
  today: IsoDate;
  range: Range;
}) {
  let box!: HTMLDivElement;
  const [width, setWidth] = createSignal(300);
  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(300, Math.round(entry.contentRect.width)));
    });
    observer.observe(box);
    onCleanup(() => observer.disconnect());
  });

  /** Week 1 starts here: the treatment start, or the first logged day. */
  const anchor = () =>
    props.progress.start ?? props.progress.weeks.find((w) => w.week >= 1)?.from ?? props.today;

  /** Weeks since the anchor. Days before it are squeezed into the band from -1 to 0. */
  const pos = (date: IsoDate) => Math.max(-0.85, daysBetween(anchor(), date) / 7);

  const hasPre = () => props.progress.weeks.some((w) => w.week === 0);
  const end = () =>
    Math.max(props.range === "all" ? 4 : RANGE_WEEKS[props.range], Math.ceil(pos(props.today)));
  const startPos = () => {
    const min = hasPre() ? -1 : 0;
    if (props.range === "all") return min;
    // Early in treatment the whole range fits, so keep the pre-treatment band in view.
    const from = end() - RANGE_WEEKS[props.range];
    return from <= 0 ? min : from;
  };

  const inView = (date: IsoDate) => {
    const p = pos(date);
    return p >= startPos() && p <= end();
  };

  const visibleLogs = () => props.logs.filter((l) => inView(l.date));
  const maxY = () => Math.max(6, Math.ceil(Math.max(0, ...visibleLogs().map(score)) / 2) * 2);

  const x = (week: number) =>
    PAD.left + ((week - startPos()) / (end() - startPos())) * (width() - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - value / maxY()) * (HEIGHT - PAD.top - PAD.bottom);
  const xDate = (date: IsoDate) => x(pos(date));

  const gridValues = () => Array.from({ length: maxY() / 2 + 1 }, (_, i) => i * 2);
  const weekTicks = () => {
    const span = end() - Math.max(0, startPos());
    const step = span > 40 ? 8 : span > 20 ? 4 : 2;
    const ticks: number[] = [];
    for (let w = Math.ceil(Math.max(0, startPos()) / step) * step; w <= end(); w += step) {
      ticks.push(w);
    }
    return ticks;
  };

  const treatmentWeeks = () =>
    props.progress.weeks.filter((w) => w.week >= 1 && w.week - 0.5 >= startPos());
  const preWeek = () => props.progress.weeks.find((w) => w.week === 0);
  const linePoints = () =>
    treatmentWeeks()
      .map((w) => `${x(w.week - 0.5)},${y(w.averageScore)}`)
      .join(" ");

  return (
    <div ref={box} class="w-full min-w-0 overflow-hidden">
      <svg
        width={width()}
        height={HEIGHT}
        viewBox={`0 0 ${width()} ${HEIGHT}`}
        role="img"
        aria-label="Symptom score by week since the first dose"
        class="block text-[11px]"
      >
        <Show when={startPos() < 0}>
          <rect
            x={x(-1)}
            y={PAD.top}
            width={x(0) - x(-1)}
            height={HEIGHT - PAD.top - PAD.bottom}
            class="fill-accent-soft"
            opacity="0.6"
          />
        </Show>

        <For each={gridValues()}>
          {(v) => (
            <>
              <line
                x1={PAD.left}
                x2={width() - PAD.right}
                y1={y(v)}
                y2={y(v)}
                class="stroke-line"
              />
              <text x={4} y={y(v) + 4} class="fill-muted">
                {v}
              </text>
            </>
          )}
        </For>

        <For each={weekTicks()}>
          {(w) => (
            <text
              x={x(w)}
              y={HEIGHT - PAD.bottom + 16}
              text-anchor={w === end() ? "end" : w === 0 && startPos() === 0 ? "start" : "middle"}
              class="fill-muted"
            >
              {w === 0 ? "start" : `wk ${w}`}
            </text>
          )}
        </For>

        {/* Today */}
        <line
          x1={xDate(props.today)}
          x2={xDate(props.today)}
          y1={PAD.top}
          y2={HEIGHT - PAD.bottom}
          class="stroke-muted"
          stroke-dasharray="2 3"
          opacity="0.6"
        />

        <For each={props.doses.filter((d) => inView(d.date))}>
          {(d) => (
            <line
              x1={xDate(d.date)}
              x2={xDate(d.date)}
              y1={HEIGHT - PAD.bottom - 8}
              y2={HEIGHT - PAD.bottom}
              class="stroke-dose"
              stroke-width="2.5"
            >
              <title>
                Dose {shortDate(d.date)}, {d.mg} mg
              </title>
            </line>
          )}
        </For>

        <Show when={props.progress.baseline}>
          {(b) => (
            <line
              x1={PAD.left}
              x2={width() - PAD.right}
              y1={y(b().value)}
              y2={y(b().value)}
              class="stroke-muted"
              stroke-width="1.5"
              stroke-dasharray="6 4"
            />
          )}
        </Show>

        {/* Daily dots are hidden on "all", where they'd be too dense to read. */}
        <Show when={props.range !== "all"}>
          <For each={visibleLogs()}>
            {(l) => (
              <circle
                cx={xDate(l.date)}
                cy={y(score(l))}
                r="2.5"
                class="fill-muted"
                opacity="0.45"
              />
            )}
          </For>
        </Show>

        <Show when={treatmentWeeks().length > 0}>
          <polyline
            points={linePoints()}
            fill="none"
            class="stroke-accent"
            stroke-width="2.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />
          <For each={treatmentWeeks()}>
            {(w, i) => (
              <circle
                cx={x(w.week - 0.5)}
                cy={y(w.averageScore)}
                r={i() === treatmentWeeks().length - 1 ? 5 : 3.5}
                class="fill-accent stroke-surface"
                stroke-width="1.5"
              >
                <title>
                  Week {w.week}: {oneDecimal(w.averageScore)} average over {w.daysLogged} day
                  {w.daysLogged === 1 ? "" : "s"}
                </title>
              </circle>
            )}
          </For>
        </Show>

        <Show when={startPos() < 0 && preWeek()}>
          {(pre) => (
            <circle cx={(x(-1) + x(0)) / 2} cy={y(pre().averageScore)} r="4" class="fill-muted">
              <title>Before treatment: {oneDecimal(pre().averageScore)} average</title>
            </circle>
          )}
        </Show>

        <For each={props.events.filter((e) => inView(e.date))}>
          {(e) => (
            <circle cx={xDate(e.date)} cy={PAD.top - 6} r="4" class={EVENT_COLORS[e.type].fill}>
              <title>
                {EVENT_LABELS[e.type]} {shortDate(e.date)}: {e.text}
              </title>
            </circle>
          )}
        </For>

        <For each={props.scopes.filter((s) => inView(s.date))}>
          {(s) => (
            <g>
              <path d={`M${xDate(s.date)} ${PAD.top - 28} l5 5 -5 5 -5 -5z`} class="fill-bad" />
              <text x={xDate(s.date) + 8} y={PAD.top - 19} class="fill-bad">
                {s.peakEosHpf}
              </text>
              <title>
                Biopsy {shortDate(s.date)}: {s.peakEosHpf} eos/hpf
              </title>
            </g>
          )}
        </For>
      </svg>
    </div>
  );
}
