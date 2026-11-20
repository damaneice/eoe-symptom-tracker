import { Match, onMount, Show, Switch } from "solid-js";
import { Header } from "./components/Header";
import { BottomNav, TopNav } from "./components/Nav";
import { Button, Panel } from "./components/ui";
import { route } from "./lib/route";
import { load, loadError, loadStatus, reloadOnReturn, state } from "./lib/store";
import { DailyLog } from "./screens/DailyLog";
import { Doses } from "./screens/Doses";
import { Endoscopy } from "./screens/Endoscopy";
import { More } from "./screens/More";
import { Progress } from "./screens/Progress";
import { Setup } from "./screens/Setup";

export function App() {
  onMount(() => {
    void load();
    reloadOnReturn();
  });

  const firstUse = () => loadStatus() === "ready" && !state.settings;

  return (
    <>
      <header class="sticky top-0 z-10 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div class="mx-auto max-w-240 px-4">
          <Header />
          <Show when={!firstUse()}>
            <TopNav />
          </Show>
        </div>
      </header>

      <main class="mx-auto max-w-240 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12">
        <Switch>
          <Match when={loadStatus() === "loading"}>
            <p class="py-8 text-center text-muted">Loading…</p>
          </Match>
          <Match when={loadStatus() === "error"}>
            <Panel>
              <p class="text-bad">{loadError()}</p>
              <Button class="justify-self-start" onClick={() => void load()}>
                Try again
              </Button>
            </Panel>
          </Match>
          <Match when={firstUse()}>
            <Setup firstUse />
          </Match>
          <Match when={route() === "log"}>
            <DailyLog />
          </Match>
          <Match when={route() === "progress"}>
            <Progress />
          </Match>
          <Match when={route() === "doses"}>
            <Doses />
          </Match>
          <Match when={route() === "endoscopy"}>
            <Endoscopy />
          </Match>
          <Match when={route() === "setup"}>
            <Setup />
          </Match>
          <Match when={route() === "more"}>
            <More />
          </Match>
        </Switch>
      </main>

      <Show when={!firstUse() && loadStatus() === "ready"}>
        <BottomNav />
      </Show>
    </>
  );
}
