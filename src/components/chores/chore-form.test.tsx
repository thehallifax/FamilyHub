import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  TEST_TIMEOUTS,
  typeAndWait,
  waitFor,
  waitForMemberSelected,
} from "@/test/test-utils";
import { ChoreForm } from "./chore-form";

describe("ChoreForm", () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    seedFamilyStore({
      members: [
        { id: "member-1", name: "Leo", color: "coral" },
        { id: "member-2", name: "Maya", color: "teal" },
      ],
    });
  });

  it("submits a new weekly chore with its selected weekday", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{
          assignedToMemberId: "member-1",
          cadence: "WEEKLY",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    await waitForMemberSelected("Leo");
    await typeAndWait(
      user,
      screen.getByLabelText(/chore name/i),
      "Take out trash",
    );
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Tuesday" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));

    await waitFor(
      () => {
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Take out trash",
          assignedToMemberId: "member-1",
          cadence: "WEEKLY",
          dueWeekday: "TUESDAY",
          dueDayOfMonth: null,
          recurrenceAnchorDate: null,
          oneOffDueDate: null,
        });
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );
  });

  it("shows validation errors for required fields", async () => {
    const { user } = renderWithUser(
      <ChoreForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /save chore/i }));

    expect(screen.getByText("Chore name is required")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("saves a new daily chore without a schedule selector", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{
          title: "Dishes",
          assignedToMemberId: "member-1",
          cadence: "DAILY",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByText("Due day")).not.toBeInTheDocument();
    expect(screen.queryByText("Due day of month")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cadence: "DAILY",
          dueWeekday: null,
          dueDayOfMonth: null,
        }),
      ),
    );
  });

  it("preserves entered values when equivalent defaults rerender", async () => {
    const { user, rerender } = renderWithUser(
      <ChoreForm
        defaultValues={{ assignedToMemberId: "member-1", cadence: "DAILY" }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    await waitForMemberSelected("Leo");
    await typeAndWait(
      user,
      screen.getByLabelText(/chore name/i),
      "Take out trash",
    );

    rerender(
      <ChoreForm
        defaultValues={{ assignedToMemberId: "member-1", cadence: "DAILY" }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText(/chore name/i)).toHaveValue("Take out trash");
  });

  it("calls onCancel from the secondary action", async () => {
    const { user } = renderWithUser(
      <ChoreForm onSubmit={onSubmit} onCancel={onCancel} />,
    );

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("requires a weekday for new weekly chores and offers no any-day option", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{
          title: "Bins",
          assignedToMemberId: "member-1",
          cadence: "WEEKLY",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByText(/Any day this week/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a weekday",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tuesday" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dueWeekday: "TUESDAY" }),
      ),
    );
  });

  it("requires a matching weekday and first due date for fortnightly chores", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{ title: "Recycling", assignedToMemberId: "member-1" }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Fortnightly" }));
    expect(
      screen.getByRole("button", { name: "Fortnightly" }).parentElement,
    ).toHaveClass("grid-cols-2");
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Saturday" }));
    await user.type(screen.getByLabelText(/starting/i), "2026-10-02");
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(
      await screen.findByText("Starting date must match the due day"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText(/starting/i));
    await user.type(screen.getByLabelText(/starting/i), "2026-10-03");
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cadence: "FORTNIGHTLY",
          dueWeekday: "SATURDAY",
          recurrenceAnchorDate: "2026-10-03",
        }),
      ),
    );
    onSubmit.mockClear();
    await user.click(screen.getByRole("button", { name: "Sunday" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(
      await screen.findByText("Starting date must match the due day"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("edits a fortnightly chore and clears its anchor on cadence change", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        isEditing
        defaultValues={{
          title: "Recycling",
          assignedToMemberId: "member-1",
          cadence: "FORTNIGHTLY",
          dueWeekday: "SATURDAY",
          recurrenceAnchorDate: "2026-10-03",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByLabelText(/starting/i)).toHaveValue("2026-10-03");
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrenceAnchorDate: "2026-10-03",
        }),
      ),
    );
    onSubmit.mockClear();
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Saturday" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrenceAnchorDate: null,
          dueWeekday: "SATURDAY",
        }),
      ),
    );
  });

  it("requires a numbered day for new monthly chores and offers no any-day option", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{
          title: "Sheets",
          assignedToMemberId: "member-1",
          cadence: "MONTHLY",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByText(/Any day this month/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a day of month",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Day 31" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dueDayOfMonth: 31 }),
      ),
    );
  });

  it("creates a one-off chore with only its required due date", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{
          title: "Renew passport",
          assignedToMemberId: "member-1",
          cadence: "DAILY",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: "One-off" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "One-off" }));
    expect(screen.getByLabelText("Due date")).toHaveClass("min-h-11");
    expect(screen.queryByText("Due day")).not.toBeInTheDocument();
    expect(screen.queryByText("Due day of month")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/starting/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Any day/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a due date",
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Due date"), "2026-10-12");
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cadence: "ONE_OFF",
          oneOffDueDate: "2026-10-12",
          dueWeekday: null,
          dueDayOfMonth: null,
          recurrenceAnchorDate: null,
        }),
      ),
    );
  });

  it("edits a one-off date and clears it when converting to recurring", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        isEditing
        defaultValues={{
          title: "Renew passport",
          assignedToMemberId: "member-1",
          cadence: "ONE_OFF",
          oneOffDueDate: "2026-10-12",
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-10-12");
    await user.clear(screen.getByLabelText("Due date"));
    await user.type(screen.getByLabelText("Due date"), "2026-10-20");
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ oneOffDueDate: "2026-10-20" }),
      ),
    );

    onSubmit.mockClear();
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    await user.click(screen.getByRole("button", { name: "Tuesday" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cadence: "WEEKLY",
          dueWeekday: "TUESDAY",
          oneOffDueDate: null,
        }),
      ),
    );
  });

  it("preserves a legacy weekly null on edit and can convert it to scheduled", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        isEditing
        defaultValues={{
          title: "Bins",
          assignedToMemberId: "member-1",
          cadence: "WEEKLY",
          dueWeekday: null,
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/Currently: Any day this week/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Any day this week" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dueWeekday: null }),
      ),
    );
    onSubmit.mockClear();
    await user.click(screen.getByRole("button", { name: "Saturday" }));
    expect(
      screen.queryByText(/Currently: Any day this week/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dueWeekday: "SATURDAY" }),
      ),
    );
  });

  it("preserves a legacy monthly null on edit and can convert it to scheduled", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        isEditing
        defaultValues={{
          title: "Sheets",
          assignedToMemberId: "member-1",
          cadence: "MONTHLY",
          dueDayOfMonth: null,
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText(/Currently: Any day this month/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Any day this month" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dueDayOfMonth: null }),
      ),
    );
    onSubmit.mockClear();
    await user.click(screen.getByRole("button", { name: "Day 15" }));
    expect(
      screen.queryByText(/Currently: Any day this month/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dueDayOfMonth: 15 }),
      ),
    );
  });

  it("requires a fresh schedule after changing a legacy chore's cadence", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        isEditing
        defaultValues={{
          title: "Bins",
          assignedToMemberId: "member-1",
          cadence: "WEEKLY",
          dueWeekday: null,
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Monthly" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a day of month",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Weekly" }));
    expect(
      screen.queryByText(/Currently: Any day this week/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a weekday",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("supports monthly day 31 and clears incompatible schedule on cadence change", async () => {
    const { user } = renderWithUser(
      <ChoreForm
        defaultValues={{
          title: "Sheets",
          assignedToMemberId: "member-1",
          cadence: "MONTHLY",
          dueDayOfMonth: 15,
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("button", { name: "Day 15" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Day 15" }).parentElement,
    ).toHaveClass("grid-cols-5");
    await user.click(screen.getByRole("button", { name: "Day 31" }));
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ dueDayOfMonth: 31 }),
      ),
    );
    onSubmit.mockClear();
    await user.click(screen.getByRole("button", { name: "Daily" }));
    expect(
      screen.queryByRole("button", { name: "Day 31" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save chore/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          cadence: "DAILY",
          dueDayOfMonth: null,
          dueWeekday: null,
        }),
      ),
    );
  });
});
