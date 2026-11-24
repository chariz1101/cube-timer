# Developer Guide

This guide describes the implemented CubeTimer architecture and the details developers need to preserve its behavior. The shorter [README](../README.md) gives a project overview; [BUILD_GUIDE.md](./BUILD_GUIDE.md) provides the original three-day build plan.

## Application State

CubeTimer is a small, offline-first React app. Components render state and handle user input, while the Zustand store owns the timer lifecycle and writes completed solves to IndexedDB.

```text
React components
  | keyboard / touch / live queries
  v
Zustand timer store
  | performance.now() timestamps
  v
Dexie / IndexedDB
```

The store in [src/store/timerStore.ts](../src/store/timerStore.ts) intentionally contains no DOM listeners or animation-loop code. This keeps timing state framework-independent and lets the components drive the store through actions.

### Timer lifecycle

The timer moves through these phases:

```text
idle -> inspecting -> running -> stopped -> idle
```

| Phase | Meaning |
|---|---|
| `idle` | A scramble is ready and no timing action is active |
| `inspecting` | The inspection hold is active |
| `running` | The solve clock is running |
| `stopped` | The final solve time is shown and has been queued for persistence |

- `performance.now()` is used for elapsed time because it is monotonic and is not affected by system clock changes.
- The solve store records elapsed time in milliseconds.
- [src/lib/format.ts](../src/lib/format.ts) rounds display values down to centiseconds. It does not mutate the underlying millisecond value.
- UI clock refreshes use `requestAnimationFrame`.
- React may render on a separate schedule, so the displayed time is an approximation of the store snapshot, not the persistence source of truth.

## Inspection and Penalties

Inspection follows WCA-style limits:

- `0–15 seconds`: no inspection penalty
- `over 15 seconds through 17 seconds`: `+2`
- `over 17 seconds`: `DNF`

The exact threshold logic is in `inspectionPenalty()` in [src/store/timerStore.ts](../src/store/timerStore.ts). The store fixes the penalty when a solve starts, so a later animation-frame update cannot change the result.

On a stopped solve:

- `+2` displays the solve result with two additional seconds.
- `DNF` displays `DNF` in the timer and retains the raw solve time in solve history.
- No penalty displays the normal formatted time.

Pressing space or touching the timer can start a solve directly from `idle`. This is useful on devices that intentionally skip WCA inspection.

## Keyboard and Touch Input

[src/components/Timer.tsx](../src/components/Timer.tsx) owns input handling:

- **Hold Space**: enter inspection.
- **Release Space**: start the solve.
- **Press Space while running**: stop the solve.
- **Touch press**: enter or stop a solve, mirroring the spacebar flow.
- **Stopped press**: reset to `idle`, then immediately begin inspection on the held press.

Press key-repeat and duplicate touch events are guarded with a local pressed-state ref. Spacebar events are ignored while focus is in an input, textarea, or content-editable element.

Keep input guards and phase transitions in the timer component unless timer behavior is also moved into another state-driven abstraction. Browser-only behavior should not be added directly to the Zustand store.

## Scrambles and Preview

The scramble module in [src/lib/scramble.ts](../src/lib/scramble.ts) uses `randomScrambleForEvent()` from `cubing/scramble`.

- The only configured event is `333` (standard 3x3x3).
- Scramble generation is asynchronous.
- Scramble tables load lazily on first use.
- A fresh scramble is cleared while generation is in progress.
- Concurrent calls share the store's `pendingScramble` promise.
- Generation failures leave the retry state visible in the timer and log the error to the console.

[src/components/ScramblePreview.tsx](../src/components/ScramblePreview.tsx) creates one `TwistyPlayer` on mount and updates only `experimentalSetupAlg` when the scramble changes. The player is not recreated with every solve, avoiding an unnecessary WebGL context teardown and camera reset.

The preview is kept mounted while hidden during a running solve. This also prevents the cube preview from being used for memorization while the solve is active.

## Local Data Model

Dexie wraps IndexedDB in [src/db/db.ts](../src/db/db.ts). The current database name is `CubeTimerDB`, and schema version 1 stores solves in the `solves` table.

```ts
interface Solve {
  id?: number;
  time: number;
  scramble: string;
  event: string;
  date: number;
  penalty?: "+2" | "DNF" | null;
  synced?: boolean;
}
```

| Field | Purpose |
|---|---|
| `id` | Auto-increment primary key |
| `time` | Raw elapsed time in milliseconds |
| `scramble` | Scramble used for the solve |
| `event` | Cubing event ID, currently `333` |
| `date` | Client timestamp for ordering |
| `penalty` | Optional WCA penalty |
| `synced` | Reserved field for future cloud synchronization |

Indexed fields are `event`, `date`, and `synced`. Adding fields or changing existing schema semantics requires a new Dexie version and a tested migration.

`stopSolve()` adds the solve asynchronously and immediately begins generating the next scramble. A save failure is logged, but it does not discard or reset the stopped UI state.

The solve list in [src/components/SolveList.tsx](../src/components/SolveList.tsx) uses `useLiveQuery`, so successful writes, penalty edits, and deletions refresh the UI automatically.

## Data Safety and Browser Storage

- Solve history is stored in the browser's IndexedDB partition for the origin.
- Clearing site data removes solve history.
- Private browsing or browser storage policies may make IndexedDB unavailable or temporary.
- There is currently no import, export, backup, or cloud synchronization implementation.
- The `synced` field is reserved for future sync and does not currently trigger network behavior.

When adding browser storage features, maintain the local-first rule: a solve should be saved locally before it depends on any remote operation.

## Running and Validation

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Before committing code, run the available checks:

```bash
npm run lint
npm run build
```

There is no test runner configured in `package.json` at present. Small behavior changes should include an appropriate test setup or a clearly documented manual verification step.

## Manual Verification Checklist

For timer or solve-list changes, verify:

1. A scramble is displayed after the first page load.
2. Holding and releasing Space starts and stops the timer.
3. The inspection countdown changes to red/yellow at the expected penalty thresholds.
4. A solve is saved once with the scramble used for it.
5. A new scramble appears after stopping.
6. Reloading the page retains the solve history.
7. `+2` and `DNF` controls are mutually exclusive and update the displayed result.
8. Delete confirmation prevents accidental deletion.
9. A scramble generation failure can be retried.
10. Touch behavior works without duplicate key/touch transitions.

## Troubleshooting

### The scramble never appears

- Check the browser console for `cubing/scramble` errors.
- Confirm the page has network access for worker or package resources on its first load.
- Press Space to trigger the store's scramble retry when `scrambleFailed` is true.

### The 3D preview is blank

- Ensure WebGL is available and hardware acceleration is enabled.
- Check for browser console errors from the custom `<twisty-player>` element.
- Reload the page after updating or clearing a blocked site-storage policy.

### Solves disappear after a reload

- Confirm the app is running on the same origin and port.
- Check whether browser data or private-browsing settings clear IndexedDB.
- Open browser developer tools and inspect the `CubeTimerDB` IndexedDB database under Application/Storage tools.

### Timer input appears to do nothing

- Verify the page is focused and that Space is not being entered into an input or content-editable element.
- Check that a scramble has finished loading.
- Reload if an old React Fast Refresh session is holding stale component state.

## Implementation Conventions

- Keep timing math in milliseconds until formatting is required.
- Use the existing `formatTime()` and `formatSolveTime()` helpers for display values.
- Keep persistence in Dexie and reactive UI in `useLiveQuery`.
- Log recoverable browser or IndexedDB failures with enough context for debugging.
- Avoid adding network or authentication behavior to components unless the feature has an explicit service module and offline fallback.
