import { createSignal, For, Show } from "solid-js";
import { biopsyLabel } from "../domain/biopsy";
import { validateScope } from "../domain/validate";
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
import { longDate } from "../lib/dates";
import { BIOPSY_LABELS } from "../lib/labels";
import { addScope, deleteScope, state, today } from "../lib/store";

/** An empty input means "not reported", so it's sent as null. */
const countOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

export function Endoscopy() {
  const [date, setDate] = createSignal(today());
  const [peak, setPeak] = createSignal("");
  const [proximal, setProximal] = createSignal("");
  const [mid, setMid] = createSignal("");
  const [distal, setDistal] = createSignal("");
  const [findings, setFindings] = createSignal("");
  const [localErrors, setLocalErrors] = createSignal<Record<string, string>>({});
  const save = createSave();
  const remove = createSave();
  const errors = () => ({ ...save.fields(), ...localErrors() });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const result = validateScope({
      date: date(),
      peakEosHpf: countOrNull(peak()) ?? undefined,
      proximalEosHpf: countOrNull(proximal()),
      midEosHpf: countOrNull(mid()),
      distalEosHpf: countOrNull(distal()),
      findings: findings().trim(),
    });
    if (!result.ok) return setLocalErrors(result.errors);
    setLocalErrors({});
    const ok = await save.run(() => addScope(result.value), "Result saved.");
    if (ok) {
      for (const set of [setPeak, setProximal, setMid, setDistal, setFindings]) set("");
    }
  }

  async function removeScope(id: number, date: string) {
    if (!confirmDelete(`the biopsy result from ${longDate(date)}`)) return;
    await remove.run(() => deleteScope(id), "Result deleted.");
  }

  const count = (label: string, value: () => string, set: (v: string) => void, key: string) => (
    <Field label={label} error={errors()[key]}>
      <input
        type="number"
        inputmode="numeric"
        min="0"
        step="1"
        value={value()}
        onInput={(e) => set(e.currentTarget.value)}
      />
    </Field>
  );

  return (
    <div class="grid gap-4 md:grid-cols-2 md:items-start">
      <form class="contents" onSubmit={submit} autocomplete="off">
        <Panel>
          <h2 class="text-lg">Endoscopy and biopsy results</h2>
          <Hint>
            The peak eosinophil count (eos/hpf) from the pathology report is the main measure of
            whether the inflammation is controlled. Under 15 is the usual response threshold; 6 or
            fewer was the remission target in the Dupixent trials.
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
            <Field label="Peak eos/hpf" error={errors().peakEosHpf}>
              <input
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                value={peak()}
                onInput={(e) => setPeak(e.currentTarget.value)}
                required
              />
            </Field>
          </div>
          <details class="grid gap-3">
            <summary class="cursor-pointer text-[0.9rem] font-medium text-accent">
              Counts by site (optional)
            </summary>
            <div class="mt-3 grid grid-cols-3 gap-3">
              {count("Proximal", proximal, setProximal, "proximalEosHpf")}
              {count("Mid", mid, setMid, "midEosHpf")}
              {count("Distal", distal, setDistal, "distalEosHpf")}
            </div>
          </details>
          <Field label="What the doctor saw" error={errors().findings}>
            <input
              value={findings()}
              onInput={(e) => setFindings(e.currentTarget.value)}
              placeholder="Furrows, rings, exudates, narrowing…"
            />
          </Field>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <Status message={save.message()} error={save.failed()} />
            <Button type="submit" busy={save.busy()}>
              {save.busy() ? "Saving…" : "Save result"}
            </Button>
          </div>
        </Panel>
      </form>

      <Panel>
        <h3 class="text-[0.95rem]">Results</h3>
        <Status message={remove.failed() ? remove.message() : null} error />
        <Show
          when={state.scopes.length > 0}
          fallback={
            <Empty>
              Add the pre-treatment biopsy result first, then each follow-up scope. Follow-up
              endoscopy is often around 3 to 6 months after starting.
            </Empty>
          }
        >
          <ul class="grid">
            <For each={[...state.scopes].reverse()}>
              {(s) => {
                const label = () => BIOPSY_LABELS[biopsyLabel(s.peakEosHpf)];
                const sites = () =>
                  [
                    s.proximalEosHpf !== null && `proximal ${s.proximalEosHpf}`,
                    s.midEosHpf !== null && `mid ${s.midEosHpf}`,
                    s.distalEosHpf !== null && `distal ${s.distalEosHpf}`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                return (
                  <li class="flex items-center justify-between gap-3 border-t border-line py-2.5 first:border-t-0">
                    <div class="min-w-0">
                      <b>{longDate(s.date)}</b> <Pill tone={label().tone}>{label().text}</Pill>
                      <div>
                        <Hint>{[sites(), s.findings].filter(Boolean).join(" — ")}</Hint>
                      </div>
                    </div>
                    <div class="flex flex-none items-center gap-1">
                      <span class="tabular-nums">
                        <b>{s.peakEosHpf}</b> <Hint>eos/hpf</Hint>
                      </span>
                      <Button variant="danger" onClick={() => removeScope(s.id, s.date)}>
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
