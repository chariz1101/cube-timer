# CubeTimer

A fast, offline-first speedcubing timer for the browser. Generate WCA-legal scrambles, time your solves with a 3D cube preview, track your stats locally, and optionally sync your history to the cloud.

## Features

- ⏱️ **Precision timer** — spacebar-driven inspection + timing flow, familiar to any speedcuber
- 🔀 **Scramble generation** — WCA-legal scrambles for 2x2–7x7 and more, powered by `cubing.js`
- 🧊 **3D scramble preview** — see the scrambled cube before you solve
- 💾 **Offline-first storage** — every solve is saved locally via IndexedDB, so the app works with no connection
- ☁️ **Optional cloud sync** — sign in to back up and sync your solve history across devices via Supabase
- 📊 **Stats** — ao5, ao12, ao100, best/worst, and session history
- 📱 **Installable PWA** — add to your home screen and use it like a native app

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React + Tailwind CSS |
| State management | Zustand |
| Scrambles & 3D rendering | [cubing.js](https://github.com/cubing/cubing.js) |
| Local storage | Dexie.js (IndexedDB wrapper) |
| Cloud sync (optional) | Supabase |
| App shell | PWA (installable, offline-capable) |

### Architecture

```
┌────────────────────────────────────────────────────────┐
│                   BROWSER / PWA LAYER                   │
│                                                           │
│  [ React + Tailwind ] <───> [ Zustand State ]            │
│          │                          │                    │
│          ▼                          ▼                    │
│   [ cubing.js ]              [ Dexie.js ]                │
│ (Scrambles & 3D)          (IndexedDB Local Solves)       │
└────────────────────────────────────────────────────────┘
                              │
                    (Optional Offline Sync)
                              ▼
                       [ Supabase Cloud ]
```

All solves are written to IndexedDB first, so the timer is fully usable offline. When a user is signed in and online, solves are synced to Supabase in the background. React components stay dumb; Zustand holds the session/timer state and mediates between the UI, cubing.js, and the Dexie data layer.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- (Optional) A free [Supabase](https://supabase.com) project if you want cloud sync

### Installation

```bash
git clone https://github.com/chariz1101/cube-timer.git
cd cube-timer
npm install
```

### Environment variables

Create a `.env.local` file in the project root (only needed if you want Supabase sync):

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Run locally

```bash
npm run dev
```

Open `http://localhost:5173`.

### Build for production

```bash
npm run build
npm run preview
```

## Usage

1. Press **spacebar** and hold to start inspection, release to start the timer.
2. Press spacebar again to stop the timer.
3. Your time and the scramble used are saved automatically.
4. View your session stats (ao5, ao12, ao100) in the sidebar.
5. (Optional) Sign in to sync your solve history to the cloud and access it from other devices.

## Project Structure

```
cube-timer/
├── docs/
│   └── BUILD_GUIDE.md      # Step-by-step build guide (3-day plan)
├── src/
│   ├── components/         # React components (Timer, ScramblePreview, Stats, etc.)
│   ├── store/               # Zustand stores
│   ├── db/                  # Dexie schema & helpers
│   ├── lib/                  # cubing.js and Supabase clients
│   └── App.tsx
├── public/
├── index.html
└── package.json
```

## Roadmap

- [ ] Multi-event support (3x3, 4x4, OH, Pyraminx, etc.)
- [ ] Solve annotations (+2, DNF)
- [ ] Session import/export
- [ ] Shareable session links
- [ ] Theming

## Contributing

Issues and pull requests are welcome. Please open an issue before submitting large changes so we can discuss the approach first.

## License

MIT