import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { haptics } from "@/lib/haptics";
import type { ChoreBoardItem } from "@/lib/types";
import { ChoreRow } from "./chore-row";

// Cast: the row only reads templateId/title/cadence/completed.
const baseChore = {
  templateId: "t1",
  title: "Dishes",
  cadence: "DAILY",
  completed: false,
} as ChoreBoardItem;

describe("ChoreRow haptics", () => {
  it("fires success() on the complete path", async () => {
    const success = vi.spyOn(haptics, "success").mockImplementation(() => {});
    render(
      <ChoreRow
        chore={baseChore}
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /mark dishes complete/i }),
    );
    expect(success).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire success() on the uncomplete path", async () => {
    const success = vi.spyOn(haptics, "success").mockImplementation(() => {});
    render(
      <ChoreRow
        chore={{ ...baseChore, completed: true }}
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /mark dishes incomplete/i }),
    );
    expect(success).not.toHaveBeenCalled();
  });
});

it("sizes the checkoff at 44px unconditionally, not only at lg", () => {
  render(<ChoreRow chore={baseChore} onComplete={() => {}} />);
  const checkoff = screen.getByTestId("chore-checkoff");
  expect(checkoff.className).toContain("h-11");
  expect(checkoff.className).toContain("w-11");
  expect(checkoff.className).not.toContain("lg:h-11");
  // The tappable control is the button wrapping it, not the indicator itself.
  expect(screen.getByRole("button", { name: /^Mark / }).className).toContain(
    "min-h-11",
  );
});

it("exposes exactly one completion control, labelled for the current state", () => {
  const { rerender } = render(
    <ChoreRow chore={baseChore} onComplete={() => {}} />,
  );
  expect(screen.getAllByRole("button", { name: /^Mark / })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: /^Complete / })).toBeNull();

  // A static label would still read "Complete Dishes" here while activating it
  // un-completes the chore.
  rerender(
    <ChoreRow
      chore={{ ...baseChore, completed: true }}
      onUncomplete={() => {}}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Mark Dishes incomplete" }),
  ).toBeInTheDocument();
});

it("lets the row body complete the chore", async () => {
  const onComplete = vi.fn();
  render(<ChoreRow chore={baseChore} onComplete={onComplete} />);
  // The title text sits inside the toggle, so tapping it completes the chore.
  await userEvent.click(screen.getByTestId("chore-title"));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

it("keeps Archive separate from the row-body target", async () => {
  const onComplete = vi.fn();
  const onArchive = vi.fn();
  render(
    <ChoreRow
      chore={baseChore}
      onComplete={onComplete}
      onArchive={onArchive}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: /^Archive / }));
  expect(onArchive).toHaveBeenCalledTimes(1);
  expect(onComplete).not.toHaveBeenCalled();
});

it("shows authoritative upcoming, due, overdue and completed schedule states", () => {
  const chore = {
    ...baseChore,
    cadence: "WEEKLY" as const,
    dueWeekday: "TUESDAY" as const,
    dueDate: "2026-05-19",
    dueState: "UPCOMING" as const,
  };
  const { rerender } = render(<ChoreRow chore={chore} />);
  expect(screen.getByText("Due Tuesday")).toBeVisible();
  rerender(<ChoreRow chore={{ ...chore, dueState: "DUE" }} />);
  expect(screen.getByText("Due today")).toBeVisible();
  rerender(<ChoreRow chore={{ ...chore, dueState: "OVERDUE" }} />);
  expect(screen.getByText("Overdue · Tuesday")).toBeVisible();
  rerender(
    <ChoreRow chore={{ ...chore, dueState: "COMPLETE", completed: true }} />,
  );
  expect(screen.getByText("Completed")).toBeVisible();
});

it("keeps edit separate from completion and preserves legacy any-day labels", async () => {
  const onEdit = vi.fn();
  const onComplete = vi.fn();
  render(
    <ChoreRow
      chore={{ ...baseChore, cadence: "MONTHLY" }}
      onEdit={onEdit}
      onComplete={onComplete}
    />,
  );
  expect(screen.getByText("Any day this month")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Edit Dishes" }));
  expect(onEdit).toHaveBeenCalledOnce();
  expect(onComplete).not.toHaveBeenCalled();
});

it("shows a one-off's explicit due date without implying another occurrence", () => {
  const oneOff = {
    ...baseChore,
    cadence: "ONE_OFF" as const,
    dueDate: "2026-10-12",
    oneOffDueDate: "2026-10-12",
    dueState: "UPCOMING" as const,
  };
  const { rerender } = render(
    <ChoreRow chore={oneOff} activeScope="THIS_MONTH" />,
  );
  expect(screen.getByText("Due Oct 12")).toBeVisible();
  expect(screen.queryByText("One-off")).not.toBeInTheDocument();

  rerender(
    <ChoreRow
      chore={{ ...oneOff, completed: true, dueState: "COMPLETE" }}
      activeScope="THIS_MONTH"
    />,
  );
  expect(screen.getByText("Completed · Oct 12")).toBeVisible();
  expect(screen.queryByText(/next/i)).not.toBeInTheDocument();
});

describe("ChoreRow cadence label", () => {
  it("hides the cadence label when the active scope already implies it", () => {
    render(
      <ChoreRow chore={baseChore} activeScope="TODAY" onComplete={() => {}} />,
    );
    expect(screen.queryByText("Daily")).toBeNull();
  });

  it("shows the cadence label when the scope does not imply it", () => {
    render(
      <ChoreRow
        chore={baseChore}
        activeScope="THIS_WEEK"
        onComplete={() => {}}
      />,
    );
    expect(screen.getByText("Daily")).toBeInTheDocument();
  });

  it("shows the cadence label when no scope is supplied", () => {
    render(<ChoreRow chore={baseChore} onComplete={() => {}} />);
    expect(screen.getByText("Daily")).toBeInTheDocument();
  });
});
