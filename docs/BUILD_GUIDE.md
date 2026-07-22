# Build Guide: Rubik's Cube Timer in 3 Days

This guide walks through building the CubeTimer app end-to-end in three focused days, following the architecture below.

```
┌────────────────────────────────────────────────────────┐
│                   BROWSER / PWA LAYER                   │
│  [ React + Tailwind ] <───> [ Zustand State ]            │
│          │                          │                    │
│          ▼                          ▼                    │
│   [ cubing.js ]              [ Dexie.js ]                │
└────────────────────────────────────────────────────────┘
                              │
                    (Optional Offline Sync)
                              ▼
                       [ Supabase Cloud ]
```

**Pace guide:**
- Day 1 — Project setup + core timer logic (local only, no persistence yet)
- Day 2 — Scrambles, 3D preview, and local persistence with Dexie
- Day 3 — Stats, Supabase sync, PWA polish, and deploy

---

## Day 1 — Project Setup & Core Timer

### 1. Scaffold the project

```bash
npm create vite@latest cube-timer -- --template react-ts
cd cube-timer
npm install
```

### 2. Install Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configure `tailwind.config.js` content paths:

```js
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

Add the Tailwind directives to `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 3. Install core dependencies

```bash
npm install zustand dexie cubing
```

### 4. Set up the Zustand timer store

Create `src/store/timerStore.ts`. This store owns the timer's phase (`idle → inspecting → running → stopped`), the elapsed time, and the current scramble string. Keep it framework-agnostic — no DOM logic here, just state and actions like `startInspection()`, `startSolve()`, `stopSolve()`, and `reset()`.

### 5. Build the Timer component

Create `src/components/Timer.tsx`:
- Listen for `keydown`/`keyup` on the spacebar (and add touch/hold support for mobile).
- Holding spacebar while idle transitions into "inspection" (optionally with a 15-second WCA-style countdown).
- Releasing starts the solve; the timer runs on `requestAnimationFrame` or a `setInterval` at ~30ms resolution for smooth display.
- Pressing spacebar again stops the timer and records the time.
- Display large, centered digits using Tailwind's typography utilities; change color while inspecting vs. running for clear visual feedback.

### 6. Wire it together

Render `<Timer />` in `App.tsx`. At this point you should be able to time a solve end-to-end, with the value living only in memory (nothing persisted yet).

**End of Day 1 checkpoint:** Spacebar-driven timer works, shows a running clock, and displays the final time on stop.

---

## Day 2 — Scrambles, 3D Preview, and Local Storage

### 1. Generate scrambles with cubing.js

Create `src/lib/scramble.ts` using `cubing`'s scramble generation (e.g. `randomScrambleForEvent`) to produce a WCA-legal scramble for the selected event (start with 3x3x3).

Call this whenever the timer resets to idle, so a fresh scramble is ready for the next solve.

### 2. Add the 3D scramble preview

Create `src/components/ScramblePreview.tsx` using `cubing/twisty` (the `TwistyPlayer` web component) to render the scrambled cube state in 3D above the timer. Feed it the scramble string generated in step 1.

### 3. Define the Dexie schema

Create `src/db/db.ts`:

```ts
import Dexie, { type Table } from "dexie";

export interface Solve {
  id?: number;
  time: number;        // milliseconds
  scramble: string;
  event: string;        // e.g. "333"
  date: number;          // timestamp
  penalty?: "+2" | "DNF" | null;
  synced?: boolean;      // for Supabase sync tracking
}

export class CubeTimerDB extends Dexie {
  solves!: Table<Solve, number>;

  constructor() {
    super("CubeTimerDB");
    this.version(1).stores({
      solves: "++id, event, date, synced",
    });
  }
}

export const db = new CubeTimerDB();
```

### 4. Persist solves on stop

In the timer store's `stopSolve()` action, write the completed solve to Dexie (`db.solves.add(...)`) along with the scramble that was used. Trigger a new scramble generation immediately after.

### 5. Build the solve history list

Create `src/components/SolveList.tsx` using Dexie's `useLiveQuery` (from `dexie-react-hooks`) to reactively display recent solves, most recent first. Support deleting a solve and toggling +2/DNF penalties, updating the record in Dexie.

**End of Day 2 checkpoint:** Every solve generates a fresh scramble, shows a 3D preview, and is saved to IndexedDB. Solve history persists across page reloads with no backend required.

---

## Day 3 — Stats, Cloud Sync, PWA, and Deploy

### 1. Compute stats

Create `src/lib/stats.ts` with pure functions for `average(n)` (ao5, ao12, ao100 — dropping best/worst per WCA trimming rules), `best()`, and `worst()`. Build `src/components/Stats.tsx` to display these, recomputing reactively as new solves come in via `useLiveQuery`.

### 2. Set up Supabase (optional cloud sync)

```bash
npm install @supabase/supabase-js
```

Create a Supabase project, then a `solves` table mirroring the Dexie schema plus a `user_id` column. Enable Row Level Security so users can only read/write their own rows.

Create `src/lib/supabase.ts` to initialize the client using the environment variables from the README.

### 3. Add authentication

Use Supabase Auth (magic link or OAuth) for sign-in. Keep the app fully usable while signed out — sync is additive, not required.

### 4. Implement sync logic

In `src/lib/sync.ts`, write a function that:
- Queries Dexie for solves where `synced` is falsy.
- Upserts them to Supabase.
- Marks them as `synced: true` locally on success.
- Runs on an interval and on `window.addEventListener("online", ...)`, so it catches up automatically when connectivity returns.

Call this sync function after login and periodically in the background (e.g. every 30 seconds while online).

### 5. Make it a PWA

```bash
npm install -D vite-plugin-pwa
```

Configure `vite.config.ts` with `VitePWA` to generate a manifest and service worker, enabling install-to-home-screen and offline asset caching. Since the timer's core loop already only depends on Dexie (not the network), the app remains fully functional offline.

### 6. Polish pass

- Add a settings panel for event selection (2x2–7x7, OH, etc.).
- Add keyboard/touch affordances and a brief onboarding hint for first-time users.
- Handle edge cases: DNF, +2, deleting the last solve, empty history state.
- Responsive layout check for mobile.

### 7. Deploy

```bash
npm run build
```

Deploy the `dist/` folder to a static host (Vercel, Netlify, or Cloudflare Pages all work well with Vite). Set the Supabase environment variables in the host's dashboard.

**End of Day 3 checkpoint:** Full timer with stats, offline-first local history, optional authenticated cloud sync, installable as a PWA, and live on a public URL.

---

## Stretch Goals (post-launch)

- Multi-event sessions and per-event stats
- Solve annotations/comments
- CSV import/export for solve history
- Shareable public session links
- Custom themes and cube color schemes