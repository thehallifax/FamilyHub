import { type PointerEvent, type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 56;
const HORIZONTAL_DOMINANCE_RATIO = 1.25;
const EDGE_ZONE = 20;
const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "[contenteditable='true']",
  "[draggable='true']",
  "[role='button']",
  "[role='link']",
  "[role='dialog']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='listbox']",
  "[role='option']",
  "[role='combobox']",
  "[data-calendar-interactive='true']",
].join(",");
const SWIPE_CANVAS_SELECTOR = "[data-calendar-swipe-canvas='true']";

interface SwipeContainerProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: ReactNode;
  className?: string;
}

interface SwipeNavigationOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  enabled?: boolean;
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
}: SwipeNavigationOptions) {
  const pointerStart = useRef<{
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    // Touch is the enhancement target. Mouse drags keep their normal desktop
    // selection/interaction behaviour, and secondary touch points are ignored.
    if (e.pointerType !== "touch" || !e.isPrimary) return;
    if (e.target instanceof Element) {
      const interactiveTarget = e.target.closest(INTERACTIVE_SELECTOR);
      const swipeCanvas = e.target.closest(SWIPE_CANVAS_SELECTOR);
      if (interactiveTarget && interactiveTarget !== swipeCanvas) return;
    }

    // Edge-zone exclusion: ignore swipes near screen edges
    if (e.clientX < EDGE_ZONE || e.clientX > window.innerWidth - EDGE_ZONE) {
      pointerStart.current = null;
      return;
    }

    pointerStart.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function clearPointer(e: PointerEvent<HTMLDivElement>) {
    if (pointerStart.current?.pointerId !== e.pointerId) return;
    pointerStart.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!enabled) return;
    const start = pointerStart.current;
    if (!start || start.pointerId !== e.pointerId) return;

    // Clear before invoking navigation so a repeated/lost pointer-up can never
    // advance more than one period.
    clearPointer(e);
    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (horizontalDistance < SWIPE_THRESHOLD) return;
    if (horizontalDistance < verticalDistance * HORIZONTAL_DOMINANCE_RATIO)
      return;

    // Suppress the synthetic click a browser may otherwise emit after a valid
    // swipe across a non-button day cell.
    e.preventDefault();
    if (deltaX < 0) {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
  }

  return {
    "data-testid": enabled ? "calendar-swipe-surface" : undefined,
    style: enabled ? { touchAction: "pan-y" as const } : undefined,
    onPointerDown: enabled ? handlePointerDown : undefined,
    onPointerUp: enabled ? handlePointerUp : undefined,
    onPointerCancel: enabled ? clearPointer : undefined,
  };
}

export function SwipeContainer({
  onSwipeLeft,
  onSwipeRight,
  children,
  className,
}: SwipeContainerProps) {
  const swipeNavigation = useSwipeNavigation({ onSwipeLeft, onSwipeRight });

  return (
    <div
      {...swipeNavigation}
      className={cn("flex-1 overflow-hidden", className)}
    >
      {children}
    </div>
  );
}
