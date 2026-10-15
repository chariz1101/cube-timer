import { useCallback, useEffect, useRef, useState } from "react";
import {
  useTimerStore,
  INSPECTION_MS,
  INSPECTION_DNF_MS,
  inspectionPenalty,
} from "../store/timerStore";
import { formatSolveTime, formatTime } from "../lib/format";

export default function Timer() {
  const phase = useTimerStore((s) => s.phase);
  const elapsedMs = useTimerStore((s) => s.elapsedMs);
  const penalty = useTimerStore((s) => s.penalty);
  const inspectionStartedAt = useTimerStore((s) => s.inspectionStartedAt);
  const startInspection = useTimerStore((s) => s.startInspection);
  const startSolve = useTimerStore((s) => s.startSolve);
  const stopSolve = useTimerStore((s) => s.stopSolve);
  const tick = useTimerStore((s) => s.tick);
  const reset = useTimerStore((s) => s.reset);
  const scramble = useTimerStore((s) => s.scramble);
  const scrambleFailed = useTimerStore((s) => s.scrambleFailed);
  const loadScramble = useTimerStore((s) => s.loadScramble);

  // Local display-only inspection clock; the store only needs the start
  // timestamp, and works out the penalty itself when the solve starts.
  const [inspectionElapsedMs, setInspectionElapsedMs] = useState(0);

  const rafRef = useRef<number | null>(null);
  // Guards against keydown auto-repeat and duplicate touch events firing
  // startInspection()/stopSolve() more than once per physical press.
  const isPressedRef = useRef(false);

  // Seed the very first scramble on mount (cold start — the store starts
  // with an empty scramble). After that, the store itself generates each
  // subsequent scramble as part of stopSolve(). loadScramble() dedupes
  // concurrent calls, so StrictMode's double mount is harmless.
  useEffect(() => {
    if (!useTimerStore.getState().scramble) {
      void loadScramble();
    }
  }, [loadScramble]);

  // Drive the visible clock. requestAnimationFrame gives smoother output
  // than the ~30ms the spec calls for, at negligible cost.
  useEffect(() => {
    if (phase !== "running" && phase !== "inspecting") {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const loop = () => {
      if (phase === "running") {
        tick();
      } else if (phase === "inspecting" && inspectionStartedAt !== null) {
        setInspectionElapsedMs(performance.now() - inspectionStartedAt);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, inspectionStartedAt, tick]);

  const handlePress = useCallback(() => {
    if (isPressedRef.current) return;
    isPressedRef.current = true;

    if (phase === "running") {
      stopSolve();
      return;
    }

    // No new solve until the next scramble is ready; if generating it
    // failed, a press retries instead.
    if (phase === "idle" || phase === "stopped") {
      if (!scramble) {
        if (scrambleFailed) void loadScramble();
        return;
      }
      // From "stopped", one press both clears the last result and re-arms
      // inspection, so a single press/hold is enough to kick off the next solve.
      if (phase === "stopped") reset();
      startInspection();
      setInspectionElapsedMs(0);
    }
  }, [phase, scramble, scrambleFailed, loadScramble, startInspection, stopSolve, reset]);

  const handleRelease = useCallback(() => {
    isPressedRef.current = false;
    if (phase === "inspecting") {
      startSolve();
    }
  }, [phase, startSolve]);

  // Keyboard: spacebar only, and ignore it while the user is typing
  // somewhere else on the page (e.g. a settings field).
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      handlePress();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault();
      handleRelease();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handlePress, handleRelease]);

  // Touch: press-and-hold anywhere on the timer surface mirrors spacebar.
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handlePress();
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleRelease();
  };

  // What starting the solve right now would cost.
  const pendingPenalty = phase === "inspecting" ? inspectionPenalty(inspectionElapsedMs) : null;

  let display: string;
  if (phase === "inspecting") {
    display = pendingPenalty ?? String(Math.ceil((INSPECTION_MS - inspectionElapsedMs) / 1000));
  } else if (phase === "stopped") {
    // Plain "DNF" here; the raw time would overflow at this font size and
    // is still shown in the solve list.
    display = penalty === "DNF" ? "DNF" : formatSolveTime(elapsedMs, penalty);
  } else {
    display = formatTime(elapsedMs);
  }

  let hint: string;
  if (phase === "inspecting") {
    hint =
      pendingPenalty === "DNF"
        ? `Inspection over ${INSPECTION_DNF_MS / 1000}s — this solve is a DNF`
        : pendingPenalty === "+2"
          ? "Inspection overtime (+2) — release to start"
          : "Release to start solving";
  } else if (phase === "running") {
    hint = "Press space to stop";
  } else if (!scramble) {
    hint = scrambleFailed
      ? "Couldn't generate a scramble — press space to retry"
      : "Generating scramble…";
  } else {
    hint =
      phase === "idle"
        ? "Hold space (or touch) to start inspection"
        : "Press space to start the next solve";
  }

  const colorClass =
    phase === "inspecting"
      ? pendingPenalty
        ? "text-red-500"
        : "text-amber-500"
      : phase === "stopped" && penalty === "DNF"
      ? "text-red-500"
      : phase === "running"
      ? "text-green-500"
      : phase === "stopped"
      ? "text-gray-900 dark:text-gray-100"
      : "text-gray-400 dark:text-gray-500";

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className="flex flex-col items-center justify-center select-none touch-none py-16"
    >
      <div
        className={`font-mono font-bold text-7xl sm:text-8xl md:text-9xl tabular-nums transition-colors duration-150 ${colorClass}`}
      >
        {display}
      </div>

      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}