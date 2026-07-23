import { useLiveQuery } from "dexie-react-hooks";
import { db, type Solve } from "../db/db";
import { formatTime } from "../lib/format";

interface SolveListProps {
  /** Max number of recent solves to show. */
  limit?: number;
  className?: string;
}

/**
 * Reactive list of recent solves, most recent first. Backed directly by
 * Dexie via useLiveQuery — no local state, no manual refetching. Any
 * change to the `solves` table (a new solve, a penalty toggle, a delete)
 * re-runs the query and re-renders automatically, including changes made
 * elsewhere (e.g. the timer store's stopSolve()).
 */
export default function SolveList({ limit = 50, className }: SolveListProps) {
  const solves = useLiveQuery(
    () => db.solves.orderBy("date").reverse().limit(limit).toArray(),
    [limit],
  );

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this solve? This can't be undone.")) return;
    try {
      await db.solves.delete(id);
    } catch (err) {
      console.error("Failed to delete solve:", err);
    }
  };

  const handleTogglePenalty = async (solve: Solve, penalty: "+2" | "DNF") => {
    if (solve.id === undefined) return;
    // Clicking an already-active penalty clears it; the two penalty
    // types are mutually exclusive, matching standard WCA scorecards.
    const nextPenalty = solve.penalty === penalty ? null : penalty;
    try {
      await db.solves.update(solve.id, { penalty: nextPenalty });
    } catch (err) {
      console.error("Failed to update penalty:", err);
    }
  };

  // useLiveQuery returns undefined until the first query resolves.
  if (solves === undefined) {
    return (
      <p className={`text-sm text-gray-500 dark:text-gray-400 ${className ?? ""}`}>
        Loading solves…
      </p>
    );
  }

  if (solves.length === 0) {
    return (
      <p className={`text-sm text-gray-500 dark:text-gray-400 ${className ?? ""}`}>
        No solves yet — your first one will show up here.
      </p>
    );
  }

  return (
    <ul className={`divide-y divide-gray-200 dark:divide-gray-800 ${className ?? ""}`}>
      {solves.map((solve, index) => (
        <li key={solve.id} className="flex items-center justify-between gap-3 px-1 py-2">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-gray-400">
              {solves.length - index}
            </span>
            <span
              className={`font-mono text-base tabular-nums ${
                solve.penalty === "DNF"
                  ? "text-red-500"
                  : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {getDisplayTime(solve)}
            </span>
            <span
              className="truncate text-xs text-gray-400 dark:text-gray-500"
              title={solve.scramble}
            >
              {solve.scramble}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => handleTogglePenalty(solve, "+2")}
              aria-pressed={solve.penalty === "+2"}
              aria-label="Toggle +2 penalty"
              className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                solve.penalty === "+2"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              +2
            </button>
            <button
              type="button"
              onClick={() => handleTogglePenalty(solve, "DNF")}
              aria-pressed={solve.penalty === "DNF"}
              aria-label="Toggle DNF penalty"
              className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                solve.penalty === "DNF"
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              DNF
            </button>
            <button
              type="button"
              onClick={() => solve.id !== undefined && handleDelete(solve.id)}
              aria-label="Delete solve"
              className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Formats a solve's displayed time per standard WCA-style convention:
 * - DNF shows "DNF (raw time)" so the underlying time isn't lost.
 * - +2 shows the adjusted time with a trailing "+".
 * - No penalty shows the plain time.
 */
function getDisplayTime(solve: Solve): string {
  if (solve.penalty === "DNF") return `DNF (${formatTime(solve.time)})`;
  if (solve.penalty === "+2") return `${formatTime(solve.time + 2000)}+`;
  return formatTime(solve.time);
}