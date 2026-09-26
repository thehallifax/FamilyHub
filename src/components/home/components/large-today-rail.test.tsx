import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { render, renderWithUser, screen } from "@/test/test-utils";
import type { HomeAgendaChore } from "../lib/large-home-selectors";
import { LargeTodayRail } from "./large-today-rail";

const members: FamilyMember[] = [{ id: "m1", name: "Alice", color: "coral" }];
const event = (
  id: string,
  title: string,
  date = new Date(2026, 6, 5),
): CalendarEvent => ({
  id,
  title,
  date,
  startTime: "11:00 AM",
  endTime: "12:00 PM",
  memberId: "m1",
  isAllDay: false,
  source: "NATIVE",
});

const chore = (
  id: string,
  dueState: "DUE" | "OVERDUE" = "DUE",
): HomeAgendaChore => ({
  chore: {
    templateId: id,
    title: id,
    cadence: "DAILY",
    assignedToMemberId: "m1",
    completed: false,
    completedAt: null,
    dueState,
  },
  scope: "TODAY",
  periodStartDate: "2026-07-05",
});

describe("LargeTodayRail", () => {
  it("renders today's events and tomorrow's preview", () => {
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[event("a", "Dentist"), event("b", "Practice")]}
        tomorrowItems={[event("c", "Camp", new Date(2026, 6, 6))]}
        members={members}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Dentist")).toBeInTheDocument();
    expect(screen.getByText("Camp")).toBeInTheDocument();
  });

  it("identifies an imported Google event", () => {
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[{ ...event("g", "Imported"), source: "GOOGLE" }]}
        tomorrowItems={[]}
        members={members}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/Google ·/)).toBeInTheDocument();
  });

  it("keeps compact Today, chores, and Tomorrow empty states", () => {
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[]}
        tomorrowItems={[]}
        members={members}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Rest of day clear")).toBeInTheDocument();
    expect(screen.getByText("No chores need attention")).toBeInTheDocument();
    expect(screen.getByText("Nothing scheduled")).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toHaveClass("bg-card");
  });

  it("does not call the day clear when the hero shows the remaining event", () => {
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[]}
        heroEventShown
        tomorrowItems={[]}
        members={members}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Current or next event shown at left"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Rest of day clear")).not.toBeInTheDocument();
  });

  it("shows due and overdue chores with separate completion and navigation targets", async () => {
    const onCompleteChore = vi.fn();
    const onOpenChores = vi.fn();
    const { user } = renderWithUser(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[]}
        tomorrowItems={[]}
        chores={[chore("Bins"), chore("Sheets", "OVERDUE")]}
        members={members}
        onSelect={vi.fn()}
        onOpenChores={onOpenChores}
        onCompleteChore={onCompleteChore}
      />,
    );

    expect(screen.getByText(/Overdue · Alice/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Complete Bins" }));
    expect(onCompleteChore).toHaveBeenCalledWith(chore("Bins"));
    expect(onOpenChores).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Sheets Overdue/ }));
    expect(onOpenChores).toHaveBeenCalledOnce();
  });

  it("disables completion while a request is in flight", () => {
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[]}
        tomorrowItems={[]}
        chores={[chore("Bins")]}
        isCompletingChore
        members={members}
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Complete Bins" }),
    ).toBeDisabled();
  });

  it("caps chores and tomorrow events with navigation affordances", async () => {
    const onOpenChores = vi.fn();
    const onOpenCalendarDate = vi.fn();
    const tomorrow = new Date(2026, 6, 6);
    const { user } = renderWithUser(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[]}
        tomorrowItems={[event("t1", "Camp", tomorrow)]}
        tomorrowExtraCount={2}
        chores={Array.from({ length: 6 }, (_, index) =>
          chore(`Chore ${index}`),
        )}
        members={members}
        onSelect={vi.fn()}
        onOpenChores={onOpenChores}
        onOpenCalendarDate={onOpenCalendarDate}
      />,
    );

    expect(screen.queryByText("Chore 5")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+1 more chores" }));
    expect(onOpenChores).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "+2 more" }));
    expect(onOpenCalendarDate).toHaveBeenCalledWith(tomorrow);
  });

  it("navigates Today and Tomorrow headers to their dates", async () => {
    const onOpenCalendarDate = vi.fn();
    const today = new Date(2026, 6, 5);
    const { user } = renderWithUser(
      <LargeTodayRail
        currentDate={today}
        todayItems={[]}
        tomorrowItems={[]}
        members={members}
        onSelect={vi.fn()}
        onOpenCalendarDate={onOpenCalendarDate}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Today Sun, Jul 5/ }));
    await user.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(onOpenCalendarDate).toHaveBeenNthCalledWith(1, today);
    expect(onOpenCalendarDate).toHaveBeenNthCalledWith(2, new Date(2026, 6, 6));
  });

  it("routes tapped events through the callback", async () => {
    const onSelect = vi.fn();
    const dentist = event("a", "Dentist");
    const { user } = renderWithUser(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[dentist]}
        tomorrowItems={[]}
        members={members}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /dentist/i }));
    expect(onSelect).toHaveBeenCalledWith(dentist);
  });

  it("keeps long Today and Coming up audience labels inside constrained rows", () => {
    const sharedMembers: FamilyMember[] = [
      { id: "m1", name: "Samuel", color: "coral" },
      { id: "m2", name: "Isabella", color: "teal" },
      { id: "m3", name: "Kathryn", color: "purple" },
      {
        id: "m4",
        name: "James-With-An-Exceptionally-Long-Name",
        color: "green",
      },
    ];
    const sharedEvent = {
      ...event("shared", "An unusually long family event title that must fit"),
      audienceType: "MEMBERS" as const,
      memberIds: sharedMembers.map((member) => member.id),
    };
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[sharedEvent]}
        tomorrowItems={[{ ...sharedEvent, id: "tomorrow" }]}
        members={sharedMembers}
        onSelect={vi.fn()}
      />,
    );

    const fullAudience =
      "Samuel + Isabella + Kathryn + James-With-An-Exceptionally-Long-Name";
    expect(screen.getByRole("complementary")).toHaveClass("@container");
    const rows = screen.getAllByRole("button", {
      name: /an unusually long family event title/i,
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveClass("min-w-0");
      expect(row).toHaveAccessibleName(
        new RegExp(fullAudience.replaceAll("+", "\\+")),
      );
      expect(row.querySelector(".w-20")).toHaveTextContent("11:00 AM");
      const title = row.querySelector(
        "[title='An unusually long family event title that must fit']",
      );
      expect(title).toHaveClass("min-w-0", "truncate");
      const audience = within(row).getByText(fullAudience);
      expect(audience).toHaveAttribute("title", fullAudience);
      expect(audience).toHaveClass(
        "min-w-0",
        "[overflow-wrap:anywhere]",
        "@min-[28rem]:truncate",
      );
      expect(audience).not.toHaveClass("shrink-0");
    }
  });
});
