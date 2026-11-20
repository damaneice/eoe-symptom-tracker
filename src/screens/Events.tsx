import { createSignal, For, Show } from "solid-js";
import { EVENT_TYPES, type EventType } from "../domain/types";
import { validateEvent } from "../domain/validate";
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
import { EVENT_COLORS, EVENT_LABELS } from "../lib/labels";
import { addEvent, deleteEvent, state, today } from "../lib/store";

export function Events() {
  const [date, setDate] = createSignal(today());
  const [type, setType] = createSignal<EventType>("diet");
  const [text, setText] = createSignal("");
  const [localErrors, setLocalErrors] = createSignal<Record<string, string>>({});
  const save = createSave();
  const remove = createSave();
  const errors = () => ({ ...save.fields(), ...localErrors() });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const result = validateEvent({ date: date(), type: type(), text: text().trim() });
    if (!result.ok) return setLocalErrors(result.errors);
    setLocalErrors({});
    const ok = await save.run(() => addEvent(result.value), "Event saved.");
    if (ok) setText("");
  }

  async function removeEvent(id: number, text: string, date: string) {
    if (!confirmDelete(`the event "${text.slice(0, 40)}" on ${dayDate(date)}`)) return;
    await remove.run(() => deleteEvent(id), "Event deleted.");
  }

  return (
    <div class="grid gap-4 md:grid-cols-2 md:items-start">
      <form class="contents" onSubmit={submit} autocomplete="off">
        <Panel>
          <h2 class="text-lg">Log an event</h2>
          <Hint>
            Anything that might affect symptoms: adding or removing foods, starting or stopping a
            medicine, being ill. Events show on the chart for context and never change the scores.
          </Hint>
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
            <Field label="Type" error={errors().type}>
              <select value={type()} onChange={(e) => setType(e.currentTarget.value as EventType)}>
                <For each={EVENT_TYPES}>{(t) => <option value={t}>{EVENT_LABELS[t]}</option>}</For>
              </select>
            </Field>
          </div>
          <Field label="What happened" error={errors().text}>
            <input
              value={text()}
              onInput={(e) => setText(e.currentTarget.value)}
              placeholder="Added dairy back, started a swallowed steroid…"
              required
            />
          </Field>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <Status message={save.message()} error={save.failed()} />
            <Button type="submit" busy={save.busy()}>
              {save.busy() ? "Saving…" : "Save event"}
            </Button>
          </div>
        </Panel>
      </form>

      <Panel>
        <h3 class="text-[0.95rem]">Events</h3>
        <Status message={remove.failed() ? remove.message() : null} error />
        <Show when={state.events.length > 0} fallback={<Empty>No events logged yet.</Empty>}>
          <ul class="grid">
            <For each={[...state.events].reverse()}>
              {(ev) => (
                <li class="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                  <div class="min-w-0">
                    <b>{dayDate(ev.date)}</b>{" "}
                    <Pill class={EVENT_COLORS[ev.type].pill}>{EVENT_LABELS[ev.type]}</Pill>
                    <div class="[overflow-wrap:anywhere]">{ev.text}</div>
                  </div>
                  <Button variant="danger" onClick={() => removeEvent(ev.id, ev.text, ev.date)}>
                    Delete
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Panel>
    </div>
  );
}
