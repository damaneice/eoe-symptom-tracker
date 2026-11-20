import { createSignal, For, Show, splitProps, type JSX, type ParentProps } from "solid-js";
import { ApiError } from "../lib/api";

export function Panel(props: ParentProps<{ class?: string }>) {
  return (
    <section
      class={`grid min-w-0 gap-3.5 rounded-xl border border-line bg-surface p-4 ${props.class ?? ""}`}
    >
      {props.children}
    </section>
  );
}

export function Empty(props: ParentProps) {
  return (
    <div class="rounded-lg border border-dashed border-line p-4 text-center text-muted">
      {props.children}
    </div>
  );
}

export function Hint(props: ParentProps<{ class?: string }>) {
  return <span class={`text-[0.8rem] text-muted ${props.class ?? ""}`}>{props.children}</span>;
}

type Tone = "good" | "bad" | "neutral" | "dose";

const PILL_TONES: Record<Tone, string> = {
  good: "bg-good/15 text-good",
  bad: "bg-bad/15 text-bad",
  neutral: "bg-accent-soft text-accent",
  dose: "bg-dose/15 text-dose",
};

export function Pill(props: ParentProps<{ tone?: Tone; class?: string }>) {
  return (
    <span
      class={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums ${
        props.class ?? PILL_TONES[props.tone ?? "neutral"]
      }`}
    >
      {props.children}
    </span>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-accent text-surface px-4",
  secondary: "bg-accent-soft text-accent px-4",
  ghost: "text-muted px-2 font-medium",
  danger: "text-bad px-2 font-medium",
};

export function Button(
  props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: keyof typeof BUTTON_VARIANTS;
    busy?: boolean;
  },
) {
  const [local, rest] = splitProps(props, ["variant", "busy", "class", "children", "disabled"]);
  return (
    <button
      type="button"
      {...rest}
      disabled={local.disabled || local.busy}
      class={`min-h-11 cursor-pointer rounded-[10px] text-[0.95rem] font-semibold transition-colors disabled:cursor-default disabled:opacity-50 ${
        BUTTON_VARIANTS[local.variant ?? "primary"]
      } ${local.class ?? ""}`}
    >
      {local.children}
    </button>
  );
}

/** A label above a control, with the field's error below it. */
export function Field(props: ParentProps<{ label: string; error?: string; class?: string }>) {
  return (
    <label class={`grid gap-1 text-[0.9rem] font-medium ${props.class ?? ""}`}>
      {props.label}
      {props.children}
      <Show when={props.error}>
        <span class="text-[0.8rem] font-normal text-bad">{props.error}</span>
      </Show>
    </label>
  );
}

/** A row of buttons that act like radio buttons. Tapping the selected one clears it if allowed. */
export function Segmented(props: {
  label: string;
  options: { value: number; label: string }[];
  value: number | null;
  onChange: (value: number | null) => void;
  allowClear?: boolean;
  dense?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={props.label}
      class={`grid auto-cols-fr grid-flow-col ${props.dense ? "gap-[3px]" : "gap-1"}`}
    >
      <For each={props.options}>
        {(option) => (
          <button
            type="button"
            aria-pressed={props.value === option.value}
            onClick={() =>
              props.onChange(props.allowClear && props.value === option.value ? null : option.value)
            }
            class={`min-h-11 min-w-0 cursor-pointer rounded-lg border text-[0.85rem] font-medium transition-colors ${
              props.dense ? "px-0" : "px-1"
            } ${
              props.value === option.value
                ? "border-accent bg-accent text-surface"
                : "border-line bg-bg text-text"
            }`}
          >
            {option.label}
          </button>
        )}
      </For>
    </div>
  );
}

export function Toggle(props: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label class="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-bg px-3 py-2.5">
      <span>
        <b class="font-semibold">{props.title}</b>
        <br />
        <Hint>{props.hint}</Hint>
      </span>
      <input
        type="checkbox"
        class="size-5 flex-none accent-accent"
        checked={props.checked}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
    </label>
  );
}

export function Stepper(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  const step = "size-11 cursor-pointer rounded-lg border border-line bg-bg text-xl text-text";
  return (
    <div class="flex items-center gap-2" role="group" aria-label={props.label}>
      <button
        type="button"
        class={step}
        aria-label="One fewer"
        onClick={() => props.onChange(Math.max(0, props.value - 1))}
      >
        −
      </button>
      <output class="min-w-[2ch] text-center font-display text-lg font-semibold tabular-nums">
        {props.value}
      </output>
      <button
        type="button"
        class={step}
        aria-label="One more"
        onClick={() => props.onChange(Math.min(props.max ?? 20, props.value + 1))}
      >
        +
      </button>
    </div>
  );
}

/** A short success or error message next to a form's button. */
export function Status(props: { message: string | null; error?: boolean }) {
  return (
    <span
      role="status"
      class={`min-h-[1.2em] text-[0.85rem] ${props.error ? "text-bad" : "text-good"}`}
    >
      {props.message}
    </span>
  );
}

/**
 * Runs a save and tracks its state for a form: busy while waiting, then a success message, or
 * the error and any per-field messages from the server. The form keeps its values on failure.
 */
export function createSave() {
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal<string | null>(null);
  const [failed, setFailed] = createSignal(false);
  const [fields, setFields] = createSignal<Record<string, string>>({});

  async function run(save: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    setFields({});
    try {
      await save();
      setFailed(false);
      setMessage(success);
      setTimeout(() => {
        if (message() === success) setMessage(null);
      }, 3000);
      return true;
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Something went wrong. Try again.");
      if (error instanceof ApiError) setFields(error.fields);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, message, failed, fields, run };
}

/** Asks before deleting, naming the record. Returns whether the user agreed. */
export const confirmDelete = (what: string) =>
  window.confirm(`Delete ${what}? This can't be undone.`);
