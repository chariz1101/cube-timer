import { randomScrambleForEvent } from "cubing/scramble";

/** WCA event ID for standard 3x3x3 — the only event wired up for now. */
export const DEFAULT_EVENT_ID = "333";

/**
 * Generates a single random, WCA-legal scramble for the given event and
 * returns it as plain move notation (e.g. "R U R' U' F2 B D2 ...").
 *
 * cubing.js loads its scramble tables lazily on first use and does the
 * actual generation in a worker, so this is async — callers should await
 * it rather than treat scrambling as instantaneous.
 */
export async function generateScramble(eventId: string = DEFAULT_EVENT_ID): Promise<string> {
  const scramble = await randomScrambleForEvent(eventId);
  return scramble.toString();
}