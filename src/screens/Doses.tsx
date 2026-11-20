import { createSignal, For, Show } from "solid-js";
import { SIDE_EFFECTS, SITES, type SideEffect, type Site } from "../domain/types";
import { validateDose } from "../domain/validate";
import {
  Button,
  confirmDelete,
  createSave,
  Empty,
  Field,
  Hint,
  Panel,
  Pill,
  Status,
} from "../components/ui";
import { dayDate } from "../lib/dates";
import { SIDE_EFFECT_LABELS, SITE_LABELS } from "../lib/labels";
import { addDose, deleteDose, progressNow, scheduleNow, state, today } from "../lib/store";

export function Doses() {
  const [date, setDate] = createSignal(today());
  const [mg, setMg] = createSignal(String(state.settings?.doseMg ?? ""));
  const [site, setSite] = createSignal<Site>(scheduleNow().nextSite);
  const [sideEffect, setSideEffect] = createSignal<SideEffect>("none");
  const [note, setNote] = createSignal("");
  const [localErrors, setLocalErrors] = createSignal<Record<string, string>>({});
  const save = createSave();
  const remove = createSave();
  const errors = () => ({ ...save.fields(), ...localErrors() });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const result = validateDose({
      date: date(),
      mg: Number(mg()),
      site: site(),
      sideEffect: sideEffect(),
      note: note().trim(),
    });
    if (!result.ok) return setLocalErrors(result.errors);
    setLocalErrors({});
    const ok = await save.run(() => addDose(result.value), `Dose on ${dayDate(date())} saved.`);
    if (ok) {
      setNote("");
      setSideEffect("none");
      setSite(scheduleNow().nextSite);
    }
  }

  const history = () => [...state.doses].reverse();
  const gapBefore = (date: string) => scheduleNow().gaps.find((g) => g.to === date);
  const weekOf = (date: string) => {
    const start = progressNow().start;
    if (!start || date < start) return null;
    return progressNow().weeks.find((w) => w.from <= date && date <= w.to)?.week ?? null;
  };

  async function removeDose(id: number, label: string) {
    if (!confirmDelete(label)) return;
    await remove.run(() => deleteDose(id), "Dose deleted.");
  }

  return (
    <div class="grid gap-4 md:grid-cols-2 md:items-start">
      <form class="contents" onSubmit={submit} autocomplete="off">
        <Panel>
          <h2 class="text-lg">Log a dose</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Date" error={errors().date}>
              <input
                type="date"
                value={date()}
                max={today()}
                onInput={(e) => setDate(e.currentTarget.value)}
                required
              />
            </Field>
            <Field label="Dose (mg)" error={errors().mg}>
              <input
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                value={mg()}
                onInput={(e) => setMg(e.currentTarget.value)}
                required
              />
            </Field>
            <Field label="Injection site" error={errors().site}>
              <select value={site()} onChange={(e) => setSite(e.currentTarget.value as Site)}>
                <For each={SITES}>{(s) => <option value={s}>{SITE_LABELS[s]}</option>}</For>
              </select>
            </Field>
            <Field label="Side effects" error={errors().sideEffect}>
              <select
                value={sideEffect()}
                onChange={(e) => setSideEffect(e.currentTarget.value as SideEffect)}
              >
                <For each={SIDE_EFFECTS}>
                  {(s) => <option value={s}>{SIDE_EFFECT_LABELS[s]}</option>}
                </For>
              </select>
            </Field>
          </div>
          <Field label="Note" error={errors().note}>
            <input
              value={note()}
              onInput={(e) => setNote(e.currentTarget.value)}
              placeholder="Late, missed, who gave it…"
            />
          </Field>
          <Show when={!state.settings}>
            <Hint>Set up the dose schedule first, in Setup.</Hint>
          </Show>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <Status message={save.message()} error={save.failed()} />
            <Button type="submit" busy={save.busy()}>
              {save.busy() ? "Saving…" : "Save dose"}
            </Button>
          </div>
        </Panel>
      </form>

      <Panel>
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h3 class="text-[0.95rem]">Dose history</h3>
          <Show when={state.doses.at(-1)}>
            {(last) => <Hint>Last site: {SITE_LABELS[last().site]}</Hint>}
          </Show>
        </div>
        <Status message={remove.failed() ? remove.message() : null} error />
        <Show
          when={history().length > 0}
          fallback={
            <Empty>
              No doses logged yet. Each injection saved here shows on the progress chart and sets
              the next due date.
            </Empty>
          }
        >
          <ul class="grid">
            <For each={history()}>
              {(d, i) => {
                const gap = () => gapBefore(d.date);
                const label = () =>
                  `the dose on ${dayDate(d.date)} (${d.mg} mg, ${SITE_LABELS[d.site].toLowerCase()})`;
                return (
                  <li class="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                    <div class="min-w-0">
                      <b>{dayDate(d.date)}</b>{" "}
                      <Hint>
                        dose {history().length - i()}
                        {weekOf(d.date) ? `, wk ${weekOf(d.date)}` : ""}
                      </Hint>
                      <div>
                        <Hint>
                          {[
                            `${d.mg} mg`,
                            SITE_LABELS[d.site],
                            d.sideEffect === "none" ? null : SIDE_EFFECT_LABELS[d.sideEffect],
                            d.note || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Hint>
                      </div>
                    </div>
                    <div class="flex flex-none items-center gap-1">
                      <Show when={gap()}>{(g) => <Pill tone="bad">{g().days}d gap</Pill>}</Show>
                      <Show when={!gap() && d.sideEffect !== "none"}>
                        <Pill tone="dose">side effect</Pill>
                      </Show>
                      <Button variant="danger" onClick={() => removeDose(d.id, label())}>
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              }}
            </For>
          </ul>
        </Show>
      </Panel>
    </div>
  );
}
