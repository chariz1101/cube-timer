import { useCallback, useEffect, useRef, useState } from "react";
import { useTimerStore } from "../store/timerStore";
import { formatTime } from "../lib/format.ts";

/** WCA-style inspection window. Set to 0 to disable the countdown UI. */
const INSPECTION_DURATION_MS = 15_000;

export default function Timer() {
  const phase = useTimerStore((s) => s.phase);
  const elapsedMs = useTimerStore((s) => s.elapsedMs);
  const inspectionStartedAt = useTimerStore((s) => s.inspectionStartedAt);
  const startInspection = useTimerStore((s) => s.startInspection);
  const startSolve = useTimerStore((s) => s.startSolve);
  const stopSolve = useTimerStore((s) => s.stopSolve);
  const tick = useTimerStore((s) => s.tick);
  const reset = useTimerStore((s) => s.reset);

  // Local display-only countdown; the store doesn't need to know about it.
  const [inspectionMsLeft, setInspectionMsLeft] = useState(INSPECTION_DURATION_MS);

  const rafRef = useRef<number | null>(null);
  // Guards against keydown auto-repeat and duplicate touch events firing
  // startInspection()/stopSolve() more than once per physical press.
  const isPressedRef = useRef(false);

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
        setInspectionMsLeft(INSPECTION_DURATION_MS - (Date.now() - inspectionStartedAt));
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

    if (phase === "idle") {
      startInspection();
      setInspectionMsLeft(INSPECTION_DURATION_MS);
    } else if (phase === "running") {
      stopSolve();
    } else if (phase === "stopped") {
      // One press both clears the last result and re-arms inspection, so
      // a single press/hold is enough to kick off the next solve.
      reset();
      startInspection();
      setInspectionMsLeft(INSPECTION_DURATION_MS);
    }
  }, [phase, startInspection, stopSolve, reset]);

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

  const isOvertime = phase === "inspecting" && inspectionMsLeft <= 0;
  const displayMs = phase === "inspecting" ? Math.max(inspectionMsLeft, 0) : elapsedMs;

  const colorClass =
    phase === "inspecting"
      ? isOvertime
        ? "text-red-500"
        : "text-amber-500"
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
        {phase === "inspecting" ? formatInspectionCountdown(displayMs) : formatTime(displayMs)}
      </div>

      <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        {phase === "idle" && "Hold space (or touch) to start inspection"}
        {phase === "inspecting" &&
          (isOvertime ? "Inspection overtime — release to start" : "Release to start solving")}
        {phase === "running" && "Press space to stop"}
        {phase === "stopped" && "Press space to start the next solve"}
      </p>
    </div>
  );
}

function formatInspectionCountdown(msLeft: number): string {
  return String(Math.ceil(msLeft / 1000));
}