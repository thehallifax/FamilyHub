import type { CalendarEvent } from "@/lib/types";
import { testMembers } from "@/test/fixtures";
import { renderWithUser, screen } from "@/test/test-utils";
import { TodayList } from "./today-list";

function createEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    title: "Soccer practice",
    startTime: "2:00 PM",
    endTime: "3:00 PM",
    date: new Date(2026, 3, 25),
    memberId: testMembers[0].id,
    isAllDay: false,
    source: "NATIVE",
    ...overrides,
  };
}

describe("TodayList", () => {
  const currentDate = new Date(2026, 3, 25, 12, 0, 0, 0);

  it("pins all-day events to the top, excludes the hero event, and shows multi-day affixes", () => {
    renderWithUser(
      <TodayList
        currentDate={currentDate}
        events={[
          createEvent({
            id: "hero-event",
            title: "Hero event",
            startTime: "10:00 AM",
            endTime: "11:00 AM",
          }),
          createEvent({
            id: "all-day",
            title: "Vacation",
            isAllDay: true,
            startTime: "00:00",
            endTime: "23:59",
            date: new Date(2026, 3, 25),
            endDate: new Date(2026, 3, 27),
          }),
          createEvent({
            id: "last-day",
            title: "Conference",
            isAllDay: true,
            startTime: "00:00",
            endTime: "23:59",
            date: new Date(2026, 3, 23),
            endDate: new Date(2026, 3, 25),
          }),
          createEvent({
            id: "timed-event",
            title: "Pickup",
            startTime: "4:00 PM",
            endTime: "5:00 PM",
          }),
        ]}
        members={testMembers}
        excludeKey="hero-event"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByText("Hero event")).not.toBeInTheDocument();
    const firstTwoRows = screen.getAllByRole("button").slice(0, 2);
    expect(firstTwoRows.map((button) => button.textContent ?? "")).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Vacation"),
        expect.stringContaining("Conference"),
      ]),
    );
    expect(screen.getByText(/John · → ends Mon/)).toBeInTheDocument();
    expect(screen.getByText(/John · from Thu →/)).toBeInTheDocument();
    expect(screen.getByText("4:00 PM")).toBeInTheDocument();
  });

  it("calls onSelect when a row is tapped", async () => {
    const event = createEvent();
    const onSelect = vi.fn();
    const { user } = renderWithUser(
      <TodayList
        currentDate={currentDate}
        events={[event]}
        members={testMembers}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /soccer practice/i }));

    expect(onSelect).toHaveBeenCalledWith(event);
  });

  it("renders nothing when there are no events", () => {
    const { container } = renderWithUser(
      <TodayList
        currentDate={currentDate}
        events={[]}
        members={testMembers}
        onSelect={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("marks events that have already finished", () => {
    const pastEvent = createEvent({
      id: "past",
      title: "Morning run",
      startTime: "8:00 AM",
      endTime: "9:00 AM",
    });
    const futureEvent = createEvent({
      id: "future",
      title: "Dinner",
      startTime: "6:00 PM",
      endTime: "7:00 PM",
    });

    renderWithUser(
      <TodayList
        currentDate={new Date(2026, 3, 25, 15, 0)}
        events={[pastEvent, futureEvent]}
        members={testMembers}
        onSelect={vi.fn()}
      />,
    );

    const past = screen
      .getByText(pastEvent.title)
      .closest("[data-past]") as HTMLElement | null;
    expect(past).toHaveAttribute("data-past", "true");

    // The future event must not be marked.
    expect(
      screen.getByText(futureEvent.title).closest("[data-past]"),
    ).toBeNull();
  });

  it("conveys elapsed state to assistive tech, not by opacity alone", () => {
    renderWithUser(
      <TodayList
        currentDate={new Date(2026, 3, 25, 15, 0)}
        events={[
          createEvent({
            id: "past",
            title: "Morning run",
            startTime: "8:00 AM",
            endTime: "9:00 AM",
          }),
        ]}
        members={testMembers}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /morning run.*ended/i }),
    ).toBeInTheDocument();
    // "done" belongs to completion copy ("2 of 6 done") — an elapsed event was
    // not completed by anyone, so it must not borrow the word.
    expect(screen.queryByText(/·\s*done/i)).toBeNull();
  });

  it("keeps long title and audience text constrained while exposing the full label", () => {
    const sharedMembers = [
      testMembers[0],
      { ...testMembers[1], name: "Isabella" },
      { ...testMembers[2], name: "Kathryn-With-An-Exceptionally-Long-Name" },
    ];
    const longTitle = "An unusually long event title for the family Today list";
    renderWithUser(
      <TodayList
        currentDate={currentDate}
        events={[
          createEvent({
            title: longTitle,
            audienceType: "MEMBERS",
            memberIds: sharedMembers.map((member) => member.id),
          }),
        ]}
        members={sharedMembers}
        onSelect={vi.fn()}
      />,
    );

    const row = screen.getByRole("button", { name: new RegExp(longTitle) });
    expect(row).toHaveClass("min-w-0");
    expect(screen.getByText(longTitle)).toHaveClass("min-w-0", "truncate");
    const label = "John + Isabella + Kathryn-With-An-Exceptionally-Long-Name";
    expect(row).toHaveAccessibleName(new RegExp(label.replaceAll("+", "\\+")));
    expect(screen.getByText(label)).toHaveClass("min-w-0", "truncate");
    expect(screen.getByText("2:00 PM")).toHaveClass("shrink-0");
  });
});
