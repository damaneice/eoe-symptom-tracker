import { createResource, Show } from "solid-js";

async function fetchHealth(): Promise<{ ok: boolean }> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export function App() {
  const [health] = createResource(fetchHealth);

  return (
    <main class="mx-auto max-w-240 p-4 pb-[env(safe-area-inset-bottom)]">
      <h1 class="text-2xl font-semibold">EoE Symptom Tracker</h1>
      <p class="mt-2 text-muted">
        API:{" "}
        <Show when={!health.loading} fallback="checking…">
          <Show when={health()?.ok} fallback={<span class="text-bad">unreachable</span>}>
            <span class="text-good">ok</span>
          </Show>
        </Show>
      </p>
    </main>
  );
}
