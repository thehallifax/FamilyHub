import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestEvent, testMembers } from "@/test/fixtures";
import {
  render,
  screen,
  seedFamilyStore,
  setViewportWidth,
} from "@/test/test-utils";
import { DailyCalendar } from "./daily-calendar";
import { MonthlyCalendar } from "./monthly-calendar";
import { ScheduleCalendar } from "./schedule-calendar";
import { WeeklyCalendar } from "./weekly-calendar";

const date = new Date(2026, 2, 8);
const first = testMembers[0].id;
const second = testMembers[1].id;
const third = testMembers[2].id;
const events = [
  createTestEvent({
    id: "everyone",
    title: "Everyone outing",
    date,
    memberId: "",
    audienceType: "FAMILY",
    memberIds: [],
  }),
  createTestEvent({
    id: "shared",
    title: "Shared dentist",
    date,
    memberId: "",
    audienceType: "MEMBERS",
    memberIds: [first, second],
  }),
  createTestEvent({
    id: "other",
    title: "Other only",
    date,
    memberId: third,
    audienceType: "MEMBERS",
    memberIds: [third],
  }),
];
const filter = { selectedMembers: [first], showAllDayEvents: true };

beforeEach(() => {
  seedFamilyStore({ name: "Family", members: testMembers });
  setViewportWidth(1280);
  class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

describe.each([
  [
    "daily",
    () => <DailyCalendar events={events} currentDate={date} filter={filter} />,
  ],
  [
    "weekly",
    () => <WeeklyCalendar events={events} currentDate={date} filter={filter} />,
  ],
  [
    "monthly",
    () => (
      <MonthlyCalendar
        events={events}
        currentDate={date}
        filter={filter}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    ),
  ],
  [
    "schedule",
    () => (
      <ScheduleCalendar events={events} currentDate={date} filter={filter} />
    ),
  ],
] as const)("%s audience filtering", (_name, component) => {
  it("shows FAMILY and a matching shared event but not an unrelated member", () => {
    render(component());
    expect(screen.getAllByText("Everyone outing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Shared dentist").length).toBeGreaterThan(0);
    expect(screen.queryByText("Other only")).not.toBeInTheDocument();
  });
});
