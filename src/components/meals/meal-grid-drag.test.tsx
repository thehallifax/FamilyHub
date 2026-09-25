import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MealBoard, MealSlot, MealType } from "@/lib/types";

const calls = vi.hoisted(() => ({
  move: vi.fn(),
  duplicate: vi.fn(),
  moveReset: vi.fn(),
  duplicateReset: vi.fn(),
  moveState: { isPending: false, error: null as Error | null },
  duplicateState: { isPending: false, error: null as Error | null },
  sensorOptions: [] as unknown[],
}));

vi.mock("@/api", () => ({
  useMoveMealSlot: () => ({
    mutate: calls.move,
    reset: calls.moveReset,
    ...calls.moveState,
  }),
  useDuplicateMealSlot: () => ({
    mutate: calls.duplicate,
    reset: calls.duplicateReset,
    ...calls.duplicateState,
  }),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragEnd,
      onDragCancel,
    }: {
      children: ReactNode;
      onDragStart: (event: unknown) => void;
      onDragEnd: (event: unknown) => void;
      onDragCancel: () => void;
    }) => (
      <>
        <button
          type="button"
          onClick={() =>
            onDragStart({ active: { id: "meal-source:0:dinner" } })
          }
        >
          Start test drag
        </button>
        <button
          type="button"
          onClick={() =>
            onDragEnd({
              active: { id: "meal-source:0:dinner" },
              over: { id: "meal-target:1:dinner" },
            })
          }
        >
          Drop on Monday
        </button>
        <button
          type="button"
          onClick={() =>
            onDragEnd({
              active: { id: "meal-source:0:dinner" },
              over: { id: "meal-target:0:dinner" },
            })
          }
        >
          Drop on self
        </button>
        <button
          type="button"
          onClick={() =>
            onDragEnd({ active: { id: "meal-source:0:dinner" }, over: null })
          }
        >
          Drop outside
        </button>
        <button type="button" onClick={onDragCancel}>
          Cancel drag
        </button>
        {children}
      </>
    ),
    useDndContext: () => ({ active: null }),
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
    useDraggable: () => ({ setNodeRef: () => {}, listeners: {} }),
    useSensor: (_sensor: unknown, options: unknown) => {
      calls.sensorOptions.push(options);
      return options;
    },
    useSensors: (...sensors: unknown[]) => sensors,
  };
});

import { MealGrid } from "./meal-grid";

function slot(dayIndex: number, mealType: MealType, title?: string): MealSlot {
  return {
    id: title ? `${dayIndex}-${mealType}` : null,
    weekStartDate: "2026-07-05",
    dayIndex,
    mealType,
    primary: title
      ? {
          id: `${dayIndex}-${mealType}-entry`,
          role: "primary",
          sourceType: "quick",
          recipeId: null,
          title,
          imageUrl: null,
          note: null,
        }
      : null,
    extras: [],
    note: null,
  };
}

function board(occupied = false): MealBoard {
  return {
    weekStartDate: "2026-07-05",
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      date: `2026-07-${String(dayIndex + 5).padStart(2, "0")}`,
      dayIndex,
      slots: (["breakfast", "lunch", "dinner"] as MealType[]).map((type) =>
        slot(
          dayIndex,
          type,
          type === "dinner" && dayIndex === 0
            ? "Pasta"
            : type === "dinner" && dayIndex === 1 && occupied
              ? "Soup"
              : undefined,
        ),
      ),
    })),
  };
}

async function drop(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start test drag" }));
  await user.click(screen.getByRole("button", { name: "Drop on Monday" }));
}

describe("MealGrid drag actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.moveState.error = null;
    calls.duplicateState.error = null;
    calls.sensorOptions.length = 0;
  });

  it("confirms Move before using the existing move mutation", async () => {
    const user = userEvent.setup();
    render(
      <MealGrid board={board()} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    await drop(user);
    expect(calls.move).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Move", exact: true }));
    expect(calls.move).toHaveBeenCalledWith({
      sourceWeekStartDate: "2026-07-05",
      sourceDayIndex: 0,
      sourceMealType: "dinner",
      destinationWeekStartDate: "2026-07-05",
      destinationDayIndex: 1,
      destinationMealType: "dinner",
      collisionMode: "replace_primary",
    });
  });

  it("confirms Copy before using the existing duplicate mutation", async () => {
    const user = userEvent.setup();
    render(
      <MealGrid board={board()} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    await drop(user);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(calls.duplicate).toHaveBeenCalledWith(
      expect.objectContaining({
        collisionMode: "replace_primary",
        destinationDayIndex: 1,
      }),
    );
    expect(calls.move).not.toHaveBeenCalled();
  });

  it("Cancel, same-slot, and outside drops never mutate", async () => {
    const user = userEvent.setup();
    render(
      <MealGrid board={board()} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    await drop(user);
    await user.click(
      screen.getByRole("button", { name: "Cancel", exact: true }),
    );
    await user.click(screen.getByRole("button", { name: "Drop on self" }));
    await user.click(screen.getByRole("button", { name: "Drop outside" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.move).not.toHaveBeenCalled();
    expect(calls.duplicate).not.toHaveBeenCalled();
  });

  it("Escape dismisses the action dialog without mutating", async () => {
    const user = userEvent.setup();
    render(
      <MealGrid board={board()} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    await drop(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.move).not.toHaveBeenCalled();
    expect(calls.duplicate).not.toHaveBeenCalled();
  });

  it("keeps extras-only cards out of the drag source set", () => {
    const extrasBoard = board();
    const extraOnly = extrasBoard.days[0].slots.find(
      (candidate) => candidate.mealType === "dinner",
    );
    if (!extraOnly) throw new Error("Missing dinner slot");
    extraOnly.primary = null;
    extraOnly.extras = [
      {
        id: "side",
        role: "extra",
        sourceType: "quick",
        recipeId: null,
        title: "Salad",
        imageUrl: null,
        note: null,
      },
    ];
    render(
      <MealGrid board={extrasBoard} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /Open dinner, Sunday: extras/ }),
    ).not.toHaveClass("cursor-grab");
    fireEvent.click(screen.getByRole("button", { name: "Drop on Monday" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["Replace primary", "replace_primary"],
    ["Add as extra", "add_as_extra"],
  ])("uses the existing occupied-slot choice %s", async (label, mode) => {
    const user = userEvent.setup();
    render(
      <MealGrid board={board(true)} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    await drop(user);
    await user.click(screen.getByRole("button", { name: "Move", exact: true }));
    expect(calls.move).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: label }));
    expect(calls.move).toHaveBeenCalledWith(
      expect.objectContaining({ collisionMode: mode }),
    );
  });

  it("shows a failed mutation without changing the board or closing the dialog", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MealGrid board={board()} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    await drop(user);
    await user.click(screen.getByRole("button", { name: "Move", exact: true }));
    calls.moveState.error = new Error("Could not move meal");
    rerender(
      <MealGrid board={board()} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Could not move meal");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("does not offer drag on read-only boards, but preserves card click", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(<MealGrid board={board()} readOnly onSelectSlot={select} />);
    await drop(user);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.move).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: /Open dinner, Sunday: Pasta/ }),
    );
    expect(select).toHaveBeenCalled();
  });

  it("keeps click/tap editor access on editable cards", async () => {
    const select = vi.fn();
    render(<MealGrid board={board()} readOnly={false} onSelectSlot={select} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Open dinner, Sunday: Pasta/ }),
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ dayIndex: 0, mealType: "dinner" }),
    );
  });

  it("uses a movement threshold for mouse and a delayed, tolerant touch hold", () => {
    render(
      <MealGrid board={board()} readOnly={false} onSelectSlot={vi.fn()} />,
    );
    expect(calls.sensorOptions).toContainEqual({
      activationConstraint: { distance: 7 },
    });
    expect(calls.sensorOptions).toContainEqual({
      activationConstraint: { delay: 300, tolerance: 8 },
    });
  });
});
