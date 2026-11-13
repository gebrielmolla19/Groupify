import { useEffect, useRef, useState } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../../lib/utils';
import { formatTrackTime as formatPlaybackTime } from '../../../lib/formatTime';

const TICK_MS = 250;
// After a seek, ignore position updates for a moment: a poll that was
// already in flight would otherwise snap the thumb back to the old spot.
const SEEK_SETTLE_MS = 1500;

interface PlaybackScrubberProps {
  /** Last known position (ms) reported by the player. */
  position: number;
  /** Track length (ms). The scrubber renders nothing until this is known. */
  duration: number;
  isPlaying: boolean;
  /** Track identity — resets the scrubber when the track changes. */
  trackKey?: string | null;
  onSeek: (positionMs: number) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

/**
 * Seekable progress bar for the player card.
 *
 * Player state only arrives about once a second (SDK polling) or every few
 * seconds (remote device polling), so between updates the position is
 * interpolated locally while playing to keep the bar moving smoothly.
 * While the user drags, the thumb follows their finger and nothing is sent
 * until they let go.
 */
export default function PlaybackScrubber({
  position,
  duration,
  isPlaying,
  trackKey,
  onSeek,
  disabled,
  className,
}: PlaybackScrubberProps) {
  // Position anchor: a known position and the time we learned it.
  const anchorRef = useRef({ position, at: Date.now() });
  const ignoreUpdatesUntilRef = useRef(0);
  // Only a pointer drag holds a "drag value". Keyboard steps commit
  // straight away — and Radix can deliver onValueChange *after*
  // onValueCommit, which would otherwise leave the bar frozen.
  const pointerDraggingRef = useRef(false);
  const [displayPosition, setDisplayPosition] = useState(position);
  const [dragValue, setDragValue] = useState<number | null>(null);

  // A new track always resets, even mid-settle.
  useEffect(() => {
    ignoreUpdatesUntilRef.current = 0;
  }, [trackKey]);

  // Re-anchor whenever the player reports a new position.
  useEffect(() => {
    if (Date.now() < ignoreUpdatesUntilRef.current) return;
    anchorRef.current = { position, at: Date.now() };
    setDisplayPosition(position);
  }, [position, trackKey]);

  // Interpolate between updates while playing.
  useEffect(() => {
    if (!isPlaying || dragValue !== null || duration <= 0) return;
    const id = setInterval(() => {
      const { position: p, at } = anchorRef.current;
      setDisplayPosition(Math.min(duration, p + (Date.now() - at)));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isPlaying, dragValue, duration]);

  // When paused, freeze the anchor at the shown position so resuming
  // continues from there rather than jumping ahead.
  useEffect(() => {
    if (!isPlaying) {
      anchorRef.current = { position: displayPosition, at: Date.now() };
    }
    // Only on play-state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  if (duration <= 0) return null;

  const shown = Math.min(duration, Math.max(0, dragValue ?? displayPosition));

  const commit = (value: number) => {
    const target = Math.min(duration, Math.max(0, Math.round(value)));
    anchorRef.current = { position: target, at: Date.now() };
    ignoreUpdatesUntilRef.current = Date.now() + SEEK_SETTLE_MS;
    setDisplayPosition(target);
    setDragValue(null);
    void onSeek(target);
  };

  return (
    <div className={cn('flex items-center gap-2 w-full', className)}>
      <span className="w-9 shrink-0 text-right font-mono text-[10px] md:text-[11px] tabular-nums text-soft">
        {formatPlaybackTime(shown)}
      </span>
      <SliderPrimitive.Root
        // Taller invisible hit area on touch screens (negative margin keeps
        // the visual row height unchanged).
        className="group relative flex h-8 -my-1.5 md:h-5 md:my-0 w-full touch-none select-none items-center cursor-pointer data-[disabled]:cursor-default data-[disabled]:opacity-50"
        min={0}
        max={duration}
        step={1000}
        value={[shown]}
        onPointerDown={() => {
          pointerDraggingRef.current = true;
        }}
        onPointerUp={() => {
          // Radix commits right after this (same event), so React batches
          // the reset with the committed position — no flicker.
          pointerDraggingRef.current = false;
          setDragValue(null);
        }}
        onPointerCancel={() => {
          pointerDraggingRef.current = false;
          setDragValue(null);
        }}
        onValueChange={([v]) => {
          if (pointerDraggingRef.current) setDragValue(v);
        }}
        onValueCommit={([v]) => commit(v)}
        disabled={disabled}
        aria-label="Seek"
      >
        <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-hair transition-[height] group-hover:h-1.5">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-iris" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-valuetext={`${formatPlaybackTime(shown)} of ${formatPlaybackTime(duration)}`}
          className={cn(
            'block size-3 rounded-full bg-foreground shadow transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            // Always visible on touch screens; on desktop show on hover/focus/drag.
            'opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100',
            dragValue !== null && 'md:opacity-100',
          )}
        />
      </SliderPrimitive.Root>
      <span className="w-9 shrink-0 font-mono text-[10px] md:text-[11px] tabular-nums text-soft">
        {formatPlaybackTime(duration)}
      </span>
    </div>
  );
}
