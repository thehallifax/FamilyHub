import { within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { render, renderWithUser, screen } from "@/test/test-utils";
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

describe("LargeTodayRail", () => {
  it("renders rest-of-day and tomorrow peek without calendar controls", () => {
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[event("a", "Dentist"), event("b", "Practice")]}
        tomorrowItems={[event("c", "Camp", new Date(2026, 6, 6))]}
        isTomorrow
        members={members}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText("Dentist")).toBeInTheDocument();
    expect(screen.queryByText(/week/i)).not.toBeInTheDocument();
  });

  it('renders "Coming up" instead of "Tomorrow" for fallback peek items', () => {
    render(
      <LargeTodayRail
        currentDate={new Date(2026, 6, 5)}
        todayItems={[event("a", "Dentist")]}
        tomorrowItems={[event("d1", "Later", new Date(2026, 6, 8))]}
        isTomorrow={false}
        members={members}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Coming up")).toBeInTheDocument();
    expect(screen.queryByText("Tomorrow")).not.toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
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
