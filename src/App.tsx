import { useTimerStore } from "./store/timerStore";
import ScramblePreview from "./components/ScramblePreview";
import Timer from "./components/Timer";
import SolveList from "./components/SolveList";

function App() {
  const scramble = useTimerStore((s) => s.scramble);
  const phase = useTimerStore((s) => s.phase);

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 lg:flex-row lg:items-start">
        <main className="flex-1">
          {/*
            Kept mounted (not conditionally rendered) even while hidden, so
            the underlying <twisty-player> WebGL context isn't torn down
            and recreated every time a solve starts/stops. Opacity swap
            keeps layout stable and hides the scramble mid-solve so there's
            nothing to keep memorizing once you've started.
          */}
          <div
            className={`mb-4 transition-opacity duration-150 ${
              phase === "running" ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <ScramblePreview scramble={scramble} />
          </div>

          <Timer />
        </main>

        <aside className="w-full shrink-0 lg:w-80">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Solve History
          </h2>
          <SolveList
            limit={50}
            className="max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800"
          />
        </aside>
      </div>
    </div>
  );
}

export default App;