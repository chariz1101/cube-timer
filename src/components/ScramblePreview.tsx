import { useEffect, useRef } from "react";
import { TwistyPlayer } from "cubing/twisty";

interface ScramblePreviewProps {
  /** Scramble in plain move notation, e.g. "R U R' U' F2 B D2 ...". */
  scramble: string;
  className?: string;
}

/**
 * Renders a 3D preview of a scrambled 3x3x3 cube using cubing.js's
 * `<twisty-player>` web component.
 *
 * The scramble is applied as a "setup" alg rather than the player's main
 * alg, with no further moves to play. That gives a cube that's already
 * sitting in the scrambled state — a still preview, not an animated
 * playback of the scramble being performed — with no play/pause controls
 * to manage.
 *
 * The player is a real DOM custom element, so it's created imperatively
 * once and mounted into a container ref; only its `experimentalSetupAlg`
 * property is updated on subsequent scramble changes. Recreating the
 * WebGL player on every scramble would be wasteful and would reset the
 * camera each time.
 */
export default function ScramblePreview({ scramble, className }: ScramblePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);

  // Create the player once and mount it into the container.
  useEffect(() => {
    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      background: "none",
      controlPanel: "none",
      hintFacelets: "none",
      experimentalSetupAnchor: "start",
      experimentalSetupAlg: scramble,
    });
    player.style.width = "100%";
    player.style.height = "100%";

    playerRef.current = player;
    containerRef.current?.appendChild(player);

    return () => {
      player.remove();
      playerRef.current = null;
    };
    // Only ever run on mount/unmount — scramble updates are pushed via the
    // effect below rather than recreated here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push scramble updates to the existing player instance.
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.experimentalSetupAlg = scramble;
    }
  }, [scramble]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={scramble ? `Scrambled cube preview for: ${scramble}` : "Scramble preview loading"}
      className={`mx-auto h-40 w-full max-w-xs sm:h-52 sm:max-w-sm ${className ?? ""}`}
    />
  );
}