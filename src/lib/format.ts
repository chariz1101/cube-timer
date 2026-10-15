import type { Penalty } from "../db/db";

/**
 * Formats a duration in milliseconds as a speedcubing-style time string:
 * "SS.CC" under a minute, "M:SS.CC" once it crosses 60 seconds.
 *
 * e.g. 8421 -> "8.42", 71230 -> "1:11.23"
 */
export function formatTime(ms: number): string {
  const totalCentiseconds = Math.floor(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const cs = centiseconds.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");

  return minutes > 0 ? `${minutes}:${ss}.${cs}` : `${seconds}.${cs}`;
}

/**
 * Formats a solve's displayed time per standard WCA-style convention:
 * - DNF shows "DNF (raw time)" so the underlying time isn't lost.
 * - +2 shows the adjusted time with a trailing "+".
 * - No penalty shows the plain time.
 */
export function formatSolveTime(ms: number, penalty?: Penalty | null): string {
  if (penalty === "DNF") return `DNF (${formatTime(ms)})`;
  if (penalty === "+2") return `${formatTime(ms + 2000)}+`;
  return formatTime(ms);
}
