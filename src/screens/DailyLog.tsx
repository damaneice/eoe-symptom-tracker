import { createEffect, createSignal, For, on, Show, type ParentProps } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { score } from "../domain/score";
import type { DailyLog as Day, IsoDate } from "../domain/types";
import type { LogPatch } from "../domain/validate";
import {
  Button,
  confirmDelete,
  createSave,
  Empty,
  Hint,
  Panel,
  Pill,
  Segmented,
  Status,
  Stepper,
  Toggle,
} from "../components/ui";
import { dayDate, timeOf } from "../lib/dates";
import {
  addNote,
  deleteLog,
  deleteNote,
  logFor,
  progressNow,
  saveLog,
  state,
  today,
} from "../lib/store";

type Fields = Omit<Day, "date">;

const BLANK: Fields = {
  swallow: 0,
  chest: 0,
  abdo: 0,
  vomit: 0,
  impaction: false,
  eating: false,
  sleep: false,
  overall: null,
};

const FIELD_KEYS = Object.keys(BLANK) as (keyof Fields)[];

const SEVERITY = ["None", "Mild", "Mod.", "Severe"].map((label, value) => ({ value, label }));
const RATING = Array.from({ length: 11 }, (_, value) => ({ value, label: String(value) }));

const fieldsOf = (day: Day | undefined): Fields =>
  day ? (Object.fromEntries(FIELD_KEYS.map((k) => [k, day[k]])) as Fields) : { ...BLANK };

/** The part of an email before the @, to show who wrote something. */
const who = (email: string) => email.split("@")[0];

export function DailyLog() {
  const [date, setDate] = createSignal<IsoDate>(today());
  const [form, setForm] = createStore<Fields>({ ...BLANK });
  /** The values as last loaded or saved, so only changed fields are sent. */
  const [loaded, setLoaded] = createSignal<Fields>({ ...BLANK });
  const save = createSave();
  const remove = createSave();

  const existing = () => logFor(date());

  // Load the day when the date changes. Reloads of the store don't overwrite unsaved edits.
  createEffect(
    on(date, (d) => {
      const values = fieldsOf(logFor(d));
      setForm(reconcile(values));
      setLoaded(values);
    }),
  );

  const changes = (): LogPatch => {
    const base = loaded();
    return Object.fromEntries(
      FIELD_KEYS.filter((k) => form[k] !== base[k]).map((k) => [k, form[k]]),
    ) as LogPatch;
  };

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    let patch = changes();
    if (Object.keys(patch).length === 0) {
      // Saving an untouched new day still records it, as a day with no symptoms.
      if (existing()) return;
      patch = { ...form };
    }
    // Capture the date: the picker could change while the save is in flight.
    const day = date();
    const ok = await save.run(() => saveLog(day, patch), `Saved ${dayDate(day)}.`);
    if (ok && date() === day) {
      // The server merged in anything another caregiver saved, so show the combined day.
      const merged = fieldsOf(logFor(day));
      setForm(reconcile(merged));
      setLoaded(merged);
    }
  }

  async function removeDay() {
    const day = date();
    if (!confirmDelete(`the log for ${dayDate(day)}`)) return;
    const ok = await remove.run(() => deleteLog(day), `Deleted ${dayDate(day)}.`);
    if (ok && date() === day) {
      setForm(reconcile({ ...BLANK }));
      setLoaded({ ...BLANK });
    }
  }

  const unchanged = () => existing() !== undefined && Object.keys(changes()).length === 0;

  return (
    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
      <form class="contents" onSubmit={submit} autocomplete="off">
        <Panel>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg">Symptoms</h2>
            <input
              type="date"
              class="w-auto"
              aria-label="Date"
              value={date()}
              max={today()}
              onInput={(e) => e.currentTarget.value && setDate(e.currentTarget.value)}
            />
          </div>
          <Show when={existing()}>
            {(day) => (
              <Hint>
                Editing the entry saved for this day. Last saved by {who(day().updatedBy)} at{" "}
                {timeOf(day().updatedAt)}.
              </Hint>
            )}
          </Show>

          <Question title="Trouble swallowing">
            <Segmented
              label="Trouble swallowing"
              options={SEVERITY}
              value={form.swallow}
              onChange={(v) => setForm("swallow", v ?? 0)}
            />
            <Hint>
              0 none · 1 slow or careful eating · 2 needed a drink to get food down · 3 food got
              stuck
            </Hint>
          </Question>
          <Question title="Chest pain or heartburn">
            <Segmented
              label="Chest pain or heartburn"
              options={SEVERITY}
              value={form.chest}
              onChange={(v) => setForm("chest", v ?? 0)}
            />
          </Question>
          <Question title="Stomach pain">
            <Segmented
              label="Stomach pain"
              options={SEVERITY}
              value={form.abdo}
              onChange={(v) => setForm("abdo", v ?? 0)}
            />
          </Question>
          <Question title="Vomiting or food coming back up" aside="times today">
            <Stepper
              label="Times vomited"
              value={form.vomit}
              onChange={(v) => setForm("vomit", v)}
            />
          </Question>

          <Toggle
            title="Food impaction"
            hint="Food stuck and wouldn't pass"
            checked={form.impaction}
            onChange={(v) => setForm("impaction", v)}
          />
          <Toggle
            title="Eating trouble"
            hint="Avoided foods, ate very slowly or refused food"
            checked={form.eating}
            onChange={(v) => setForm("eating", v)}
          />
          <Toggle
            title="Sleep disrupted"
            hint="Woke from reflux, pain or coughing"
            checked={form.sleep}
            onChange={(v) => setForm("sleep", v)}
          />

          <Question title="How was the day overall?" aside="0 awful · 10 great">
            <Segmented
              label="Overall day rating"
              options={RATING}
              value={form.overall}
              onChange={(v) => setForm("overall", v)}
              allowClear
              dense
            />
          </Question>

          <div class="flex items-center justify-between gap-3 rounded-[10px] bg-accent-soft p-3">
            <span>
              Symptom score <Hint>(0–17, lower is better)</Hint>
            </span>
            <b class="font-display text-2xl font-bold tabular-nums">
              {score({ date: date(), ...form })}
            </b>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <Status
              message={save.message() ?? remove.message()}
              error={save.message() ? save.failed() : remove.failed()}
            />
            <div class="flex gap-2">
              <Show when={existing()}>
                <Button variant="danger" busy={remove.busy()} onClick={removeDay}>
                  Delete
                </Button>
              </Show>
              <Button type="submit" busy={save.busy()} disabled={unchanged()}>
                {save.busy() ? "Saving…" : existing() ? "Update day" : "Save day"}
              </Button>
            </div>
          </div>
        </Panel>
      </form>

      <div class="grid gap-4">
        <Notes date={date()} />
        <RecentDays onEdit={setDate} />
      </div>
    </div>
  );
}

function Question(props: ParentProps<{ title: string; aside?: string }>) {
  return (
    <div class="grid gap-1.5">
      <div class="flex items-baseline justify-between gap-2">
        <span class="font-semibold">{props.title}</span>
        <Show when={props.aside}>
          <Hint>{props.aside}</Hint>
        </Show>
      </div>
      {props.children}
    </div>
  );
}

/** Each caregiver's notes for the day. Notes never overwrite each other. */
function Notes(props: { date: IsoDate }) {
  const [text, setText] = createSignal("");
  const save = createSave();
  const notes = () => state.notes.filter((n) => n.date === props.date);

  async function add() {
    const note = { date: props.date, text: text().trim() };
    if (!note.text) return;
    const ok = await save.run(() => addNote(note), "Note added.");
    if (ok) setText("");
  }

  async function remove(id: number, preview: string) {
    if (!confirmDelete(`the note "${preview.slice(0, 40)}"`)) return;
    await save.run(() => deleteNote(id), "Note deleted.");
  }

  return (
    <Panel>
      <h3 class="text-[0.95rem]">Notes for {dayDate(props.date)}</h3>
      <Show when={notes().length > 0}>
        <ul class="grid">
          <For each={notes()}>
            {(note) => (
              <li class="flex items-start justify-between gap-3 border-t border-line py-2 first:border-t-0">
                <div class="min-w-0">
                  <div class="[overflow-wrap:anywhere]">{note.text}</div>
                  <Hint>
                    {who(note.author)} · {timeOf(note.createdAt)}
                  </Hint>
                </div>
                <Button variant="danger" onClick={() => remove(note.id, note.text)}>
                  Delete
                </Button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <textarea
        class="min-h-16 resize-y"
        aria-label="New note"
        placeholder="New foods, illness, missed meds, anything unusual"
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
      />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Status message={save.message()} error={save.failed()} />
        <Button variant="secondary" busy={save.busy()} disabled={!text().trim()} onClick={add}>
          {save.busy() ? "Saving…" : "Add note"}
        </Button>
      </div>
    </Panel>
  );
}

function RecentDays(props: { onEdit: (date: IsoDate) => void }) {
  const recent = () => [...state.logs].reverse().slice(0, 10);
  const weekOf = (date: IsoDate) =>
    progressNow().weeks.find((w) => w.from <= date && date <= w.to)?.week;

  return (
    <Panel>
      <h3 class="text-[0.95rem]">Recent days</h3>
      <Show
        when={recent().length > 0}
        fallback={
          <Empty>
            No days logged yet. Fill in today. A minute a day is enough to show a trend after a few
            weeks.
          </Empty>
        }
      >
        <ul class="grid">
          <For each={recent()}>
            {(day) => {
              const dayScore = () => score(day);
              const flags = () =>
                [
                  day.impaction && "impaction",
                  day.vomit > 0 && `vomited ×${day.vomit}`,
                  day.sleep && "poor sleep",
                  day.eating && "eating trouble",
                ]
                  .filter(Boolean)
                  .join(" · ");
              const noteCount = () => state.notes.filter((n) => n.date === day.date).length;
              return (
                <li class="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
                  <div class="min-w-0">
                    <b>{dayDate(day.date)}</b>{" "}
                    <Hint>
                      {weekOf(day.date) === 0 ? "before treatment" : `wk ${weekOf(day.date)}`}
                    </Hint>
                    <div>
                      <Hint>
                        {flags() || "No flags"}
                        {noteCount() > 0
                          ? ` · ${noteCount()} note${noteCount() > 1 ? "s" : ""}`
                          : ""}
                      </Hint>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <Pill tone={dayScore() >= 6 ? "bad" : dayScore() <= 2 ? "good" : "neutral"}>
                      {dayScore()}
                    </Pill>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        props.onEdit(day.date);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </li>
              );
            }}
          </For>
        </ul>
      </Show>
    </Panel>
  );
}
