import { create } from "zustand";
import { db } from "../db/db";
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
 */

export type TimerPhase = "idle" | "inspecting" | "running" | "stopped";

interface TimerState {
  /** Current phase in the timer lifecycle. */
  phase: TimerPhase;

  /** The scramble the current/next solve is being timed against. */
  scramble: string;

  /** Timestamp (ms, from Date.now()) when inspection began, or null. */
  inspectionStartedAt: number | null;

  /** Timestamp (ms, from Date.now()) when the solve began, or null. */
  solveStartedAt: number | null;

  /**
   * Elapsed solve time in milliseconds.
   * - While "running", this is a snapshot the UI can refresh via tick().
   * - Once "stopped", this is the final, authoritative solve time.
   */
  elapsedMs: number;

  /** Set or replace the scramble for the upcoming solve. */
  setScramble: (scramble: string) => void;

  /** idle → inspecting. No-ops unless phase is currently "idle". */
  startInspection: () => void;

  /**
   * (idle | inspecting) → running.
   * Starting a solve directly from "idle" is allowed for apps that skip
   * WCA-style inspection entirely.
   */
  startSolve: () => void;

  /**
   * running → stopped. Freezes elapsedMs at the final solve time, saves
   * the completed solve to Dexie (with the scramble that was used), and
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
   *  untouched — callers typically assign a fresh scramble separately. */
  reset: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: "idle",
  scramble: "",
  inspectionStartedAt: null,
  solveStartedAt: null,
  elapsedMs: 0,

  setScramble: (scramble) => set({ scramble }),

  startInspection: () => {
    if (get().phase !== "idle") return;
    set({
      phase: "inspecting",
      inspectionStartedAt: Date.now(),
      solveStartedAt: null,
      elapsedMs: 0,
    });
  },

  startSolve: () => {
    const { phase } = get();
    if (phase !== "idle" && phase !== "inspecting") return;
    set({
      phase: "running",
      solveStartedAt: Date.now(),
      elapsedMs: 0,
    });
  },

  stopSolve: () => {
    const { phase, solveStartedAt, scramble } = get();
    if (phase !== "running" || solveStartedAt === null) return;

    const elapsedMs = Date.now() - solveStartedAt;
    set({ phase: "stopped", elapsedMs });

    // Save the completed solve and line up the next scramble. Neither
    // needs to block the UI, and a failure in one shouldn't stop the
    // other from completing.
    void (async () => {
      const [saveResult, scrambleResult] = await Promise.allSettled([
        db.solves.add({
          time: elapsedMs,
          scramble,
          event: DEFAULT_EVENT_ID,
          date: Date.now(),
          penalty: null,
          synced: false,
        }),
        generateScramble(DEFAULT_EVENT_ID),
      ]);

      if (saveResult.status === "rejected") {
        console.error("Failed to save solve:", saveResult.reason);
      }

      if (scrambleResult.status === "fulfilled") {
        set({ scramble: scrambleResult.value });
      } else {
        console.error("Failed to generate next scramble:", scrambleResult.reason);
      }
    })();
  },

  tick: () => {
    const { phase, solveStartedAt } = get();
    if (phase !== "running" || solveStartedAt === null) return;
    set({ elapsedMs: Date.now() - solveStartedAt });
  },

  reset: () => {
    set({
      phase: "idle",
      inspectionStartedAt: null,
      solveStartedAt: null,
      elapsedMs: 0,
    });
  },
}));