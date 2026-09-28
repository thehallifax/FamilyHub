import { createEvent, fireEvent } from "@testing-library/react";
import { render, screen } from "@/test/test-utils";
import { SwipeContainer } from "./swipe-container";

function pointerDown(
  target: Element,
  { x = 240, y = 200, pointerType = "touch" } = {},
) {
  const event = createEvent.pointerDown(target, {
    pointerId: 1,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
    isPrimary: { value: true },
    clientX: { value: x },
    clientY: { value: y },
  });
  fireEvent(target, event);
}

function pointerUp(target: Element, x: number, y: number) {
  const event = createEvent.pointerUp(target, {
    pointerId: 1,
    clientX: x,
    clientY: y,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "touch" },
    isPrimary: { value: true },
    clientX: { value: x },
    clientY: { value: y },
  });
  fireEvent(target, event);
}

function renderSwipe(children = <div>content</div>) {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  render(
    <SwipeContainer onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight}>
      {children}
    </SwipeContainer>,
  );
  return {
    surface: screen.getByTestId("calendar-swipe-surface"),
    onSwipeLeft,
    onSwipeRight,
  };
}

describe("SwipeContainer", () => {
  it("renders children and preserves vertical browser panning", () => {
    const { surface } = renderSwipe();
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(surface.style.touchAction).toBe("pan-y");
  });

  it("calls left once for a deliberate leftward touch swipe", () => {
    const { surface, onSwipeLeft } = renderSwipe();
    pointerDown(surface);
    pointerUp(surface, 140, 205);
    pointerUp(surface, 80, 205);
    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });

  it("calls right for a deliberate rightward touch swipe", () => {
    const { surface, onSwipeRight } = renderSwipe();
    pointerDown(surface, { x: 120 });
    pointerUp(surface, 220, 205);
    expect(onSwipeRight).toHaveBeenCalledOnce();
  });

  it("ignores movement below the 56px threshold", () => {
    const { surface, onSwipeLeft, onSwipeRight } = renderSwipe();
    pointerDown(surface);
    pointerUp(surface, 190, 202);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("ignores vertical and ambiguous diagonal movement", () => {
    const { surface, onSwipeLeft, onSwipeRight } = renderSwipe();
    pointerDown(surface);
    pointerUp(surface, 170, 320);
    pointerDown(surface);
    pointerUp(surface, 170, 260);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("ignores touch gestures originating from interactive children", () => {
    const { surface, onSwipeLeft } = renderSwipe(
      <button type="button">Open event</button>,
    );
    const button = screen.getByRole("button", { name: "Open event" });
    pointerDown(button);
    pointerUp(surface, 120, 200);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("does not turn desktop mouse dragging into navigation", () => {
    const { surface, onSwipeLeft } = renderSwipe();
    pointerDown(surface, { pointerType: "mouse" });
    pointerUp(surface, 100, 200);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("clears a cancelled gesture without navigating", () => {
    const { surface, onSwipeLeft } = renderSwipe();
    pointerDown(surface);
    const cancel = createEvent.pointerCancel(surface);
    Object.defineProperties(cancel, {
      pointerId: { value: 1 },
      pointerType: { value: "touch" },
      isPrimary: { value: true },
    });
    fireEvent(surface, cancel);
    pointerUp(surface, 100, 200);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("ignores gestures beginning in either 20px system edge zone", () => {
    const { surface, onSwipeLeft, onSwipeRight } = renderSwipe();
    pointerDown(surface, { x: 10 });
    pointerUp(surface, 140, 200);
    pointerDown(surface, { x: window.innerWidth - 10 });
    pointerUp(surface, window.innerWidth - 140, 200);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });
});
