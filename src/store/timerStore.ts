import { create } from "zustand";
import { db, type Penalty } from "../db/db";
import { generateScramble, DEFAULT_EVENT_ID } from "../lib/scramble";

/**
 * Timer lifecycle:
 *   idle → inspecting → running → stopped → (reset) → idle
 *
 * This store is intentionally framework-agnostic: it holds no timers,
 * intervals, or DOM/keyboard listeners. Components are responsible for
 * driving the clock (e.g. via requestAnimationFrame) and calling the
 * actions below in response to user input. The store just answers:
 * "what phase are we in, and what time should be displayed right now?"
 *
 * All durations are measured with performance.now(), which is monotonic —
 * unlike Date.now(), it can't jump if the system clock is adjusted mid-solve.
 */

/** WCA inspection window. Starting after this adds a +2 penalty. */
export const INSPECTION_MS = 15_000;

/** Starting the solve after this much inspection is a DNF (WCA A3d1). */
export const INSPECTION_DNF_MS = 17_000;

/** The penalty incurred by starting a solve after `inspectionMs` of inspection. */
export function inspectionPenalty(inspectionMs: number): Penalty | null {
  if (inspectionMs > INSPECTION_DNF_MS) return "DNF";
  if (inspectionMs > INSPECTION_MS) return "+2";
  return null;
}

export type TimerPhase = "idle" | "inspecting" | "running" | "stopped";

interface TimerState {
  /** Current phase in the timer lifecycle. */
  phase: TimerPhase;

  /**
   * The scramble the current/next solve is being timed against. Empty
   * while a new one is being generated — no solve can start until it's set,
   * so a solve is never timed (or saved) against a stale scramble.
   */
  scramble: string;

  /** True if the most recent scramble generation failed. */
  scrambleFailed: boolean;

  /** performance.now() timestamp when inspection began, or null. */
  inspectionStartedAt: number | null;

  /** performance.now() timestamp when the solve began, or null. */
  solveStartedAt: number | null;

  /**
   * Elapsed solve time in milliseconds.
   * - While "running", this is a snapshot the UI can refresh via tick().
   * - Once "stopped", this is the final, authoritative solve time.
   */
  elapsedMs: number;

  /** Inspection penalty for the current solve, fixed when the solve starts. */
  penalty: Penalty | null;

  /**
   * Clear the current scramble and generate a new one. Concurrent calls
   * share a single in-flight generation.
   */
  loadScramble: () => Promise<void>;

  /** idle → inspecting. No-ops unless phase is "idle" and a scramble is ready. */
  startInspection: () => void;

  /**
   * (idle | inspecting) → running. Applies a +2 / DNF penalty if
   * inspection ran over. Starting a solve directly from "idle" is allowed
   * for apps that skip WCA-style inspection entirely.
   */
  startSolve: () => void;

  /**
   * running → stopped. Freezes elapsedMs at the final solve time, saves
   * the completed solve to Dexie (with the scramble and penalty), and
   * kicks off generation of the next scramble.
   */
  stopSolve: () => void;

  /**
   * While running, components can call this on every animation frame /
   * interval tick to refresh elapsedMs for live display. No-ops unless
   * phase is "running".
   */
  tick: () => void;

  /** stopped (or any phase) → idle. Clears timing state, keeps scramble
   *  untouched — stopSolve() has already started loading the next one. */
  reset: () => void;
}

let pendingScramble: Promise<void> | null = null;

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: "idle",
  scramble: "",
  scrambleFailed: false,
  inspectionStartedAt: null,
  solveStartedAt: null,
  elapsedMs: 0,
  penalty: null,

  loadScramble: () => {
    if (pendingScramble) return pendingScramble;
    set({ scramble: "", scrambleFailed: false });
    pendingScramble = generateScramble(DEFAULT_EVENT_ID)
      .then(
        (scramble) => set({ scramble }),
        (err) => {
          console.error("Failed to generate scramble:", err);
          set({ scrambleFailed: true });
        },
      )
      .finally(() => {
        pendingScramble = null;
      });
    return pendingScramble;
  },

  startInspection: () => {
    const { phase, scramble } = get();
    if (phase !== "idle" || !scramble) return;
    set({
      phase: "inspecting",
      inspectionStartedAt: performance.now(),
      solveStartedAt: null,
      elapsedMs: 0,
      penalty: null,
    });
  },

  startSolve: () => {
    const { phase, scramble, inspectionStartedAt } = get();
    if (phase !== "idle" && phase !== "inspecting") return;
    if (!scramble) return;
    const now = performance.now();
    set({
      phase: "running",
      solveStartedAt: now,
      elapsedMs: 0,
      penalty:
        phase === "inspecting" && inspectionStartedAt !== null
          ? inspectionPenalty(now - inspectionStartedAt)
          : null,
    });
  },

  stopSolve: () => {
    const { phase, solveStartedAt, scramble, penalty } = get();
    if (phase !== "running" || solveStartedAt === null) return;

    const elapsedMs = Math.round(performance.now() - solveStartedAt);
    set({ phase: "stopped", elapsedMs });

    // Neither needs to block the UI. loadScramble() clears the scramble
    // synchronously, so the next solve can't start until a fresh one lands.
    db.solves
      .add({
        time: elapsedMs,
        scramble,
        event: DEFAULT_EVENT_ID,
        date: Date.now(),
        penalty,
        synced: false,
      })
      .catch((err) => console.error("Failed to save solve:", err));
    void get().loadScramble();
  },

  tick: () => {
    const { phase, solveStartedAt } = get();
    if (phase !== "running" || solveStartedAt === null) return;
    set({ elapsedMs: performance.now() - solveStartedAt });
  },

  reset: () => {
    set({
      phase: "idle",
      inspectionStartedAt: null,
      solveStartedAt: null,
      elapsedMs: 0,
      penalty: null,
    });
  },
}));
