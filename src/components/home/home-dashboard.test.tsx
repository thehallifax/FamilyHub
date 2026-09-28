import { HttpResponse, http } from "msw";
import { afterEach, beforeEach } from "vitest";
import type { ListDetail } from "@/lib/types";
import { defaultAppearance } from "@/lib/types";
import { useAppStore } from "@/stores";
import { createTestEventResponse, testMembers } from "@/test/fixtures";
import {
  API_BASE,
  resetMockEvents,
  seedMockAppearance,
  seedMockEvents,
  seedMockLists,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import {
  render,
  renderWithUser,
  screen,
  seedFamilyStore,
  typeAndWait,
  waitFor,
  waitForMemberSelected,
} from "@/test/test-utils";
import { HomeDashboard } from "./home-dashboard";

const groceryList: ListDetail = {
  id: "grocery-1",
  name: "Groceries",
  kind: "grocery",
  categoryDisplayMode: "grouped",
  showCompletedOverride: null,
  categories: [],
  items: [
    {
      id: "item-1",
      text: "Milk",
      completed: false,
      completedAt: null,
      categoryId: null,
      createdAt: "2026-06-21T09:00:00",
      updatedAt: "2026-06-21T09:00:00",
    },
  ],
  createdAt: "2026-06-21T09:00:00",
  updatedAt: "2026-06-21T09:00:00",
};

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });

  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: (() => {
      const maxWidth = Number.parseInt(
        query.match(/max-width:\s*(\d+)px/)?.[1] ?? "",
        10,
      );
      const minWidth = Number.parseInt(
        query.match(/min-width:\s*(\d+)px/)?.[1] ?? "",
        10,
      );

      const matchesMax = Number.isNaN(maxWidth) || width <= maxWidth;
      const matchesMin = Number.isNaN(minWidth) || width >= minWidth;
      return matchesMax && matchesMin;
    })(),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe("HomeDashboard", () => {
  setupMswServer();
  const currentDate = new Date(2026, 3, 25, 9, 0, 0, 0);

  beforeEach(() => {
    setViewportWidth(768);
    seedFamilyStore({
      name: "Test Family",
      members: testMembers,
    });
  });

  afterEach(() => {
    resetMockEvents();
  });

  it("keeps the default Home background unchanged", async () => {
    render(<HomeDashboard nowOverride={currentDate} />);
    await screen.findByTestId("home-background");
    expect(screen.getByTestId("home-background")).toHaveAttribute(
      "data-background-mode",
      "DEFAULT",
    );
  });

  it("renders the saved gradient and strength on Home", async () => {
    seedMockAppearance({
      ...defaultAppearance,
      backgroundMode: "GRADIENT",
      gradient: "LAGOON",
      backgroundStrength: 80,
    });
    render(<HomeDashboard nowOverride={currentDate} />);
    await waitFor(() =>
      expect(screen.getByTestId("home-background")).toHaveAttribute(
        "data-background-mode",
        "GRADIENT",
      ),
    );
    expect(
      screen
        .getByTestId("home-background")
        .querySelector("[style*='linear-gradient']"),
    ).toBeTruthy();
  });

  it("renders an authenticated saved photo behind Home", async () => {
    seedMockAppearance({
      ...defaultAppearance,
      backgroundMode: "PHOTO",
      photoKey: "photo-1",
    });
    server.use(
      http.get(
        `${API_BASE}/family/appearance/photo`,
        () => new HttpResponse(new Blob(["jpeg"], { type: "image/jpeg" })),
      ),
    );
    URL.createObjectURL = vi.fn(() => "blob:home-photo");
    URL.revokeObjectURL = vi.fn();
    render(<HomeDashboard nowOverride={currentDate} />);
    await waitFor(() =>
      expect(screen.getByTestId("home-background")).toHaveAttribute(
        "data-background-mode",
        "PHOTO",
      ),
    );
    expect(
      screen
        .getByTestId("home-background")
        .querySelector("[style*='blob:home-photo']"),
    ).toBeTruthy();
  });

  it("renders the mobile dashboard surface instead of the launcher grid", async () => {
    seedMockEvents([
      createTestEventResponse({
        id: "today",
        title: "School pickup",
        date: "2026-04-25",
        startTime: "9:45 AM",
        endTime: "10:15 AM",
        memberId: testMembers[0].id,
      }),
      createTestEventResponse({
        id: "tomorrow",
        title: "Dentist",
        date: "2026-04-26",
        startTime: "9:00 AM",
        endTime: "10:00 AM",
        memberId: testMembers[1].id,
      }),
    ]);

    render(<HomeDashboard nowOverride={currentDate} />);

    expect(
      await screen.findByText("Good morning, Test Family"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Up next · in 45 min")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Focus on John's events" }),
    ).toBeInTheDocument();
    expect(screen.getByText("School pickup")).toBeInTheDocument();
    expect(screen.getByText("Coming up")).toBeInTheDocument();
    expect(
      screen.queryByText("What would you like to do?"),
    ).not.toBeInTheDocument();
  });

  it("uses the large responsive Home composition in the narrow-tablet band", async () => {
    setViewportWidth(820);
    seedMockEvents([]);

    render(<HomeDashboard nowOverride={currentDate} />);

    expect(await screen.findByTestId("large-home-dashboard")).toBeVisible();
    expect(screen.getByTestId("large-home-grid")).toHaveClass("grid-cols-1");
    expect(
      screen.queryByText("Good morning, Test Family"),
    ).not.toBeInTheDocument();
  });

  it("renders the calm empty state without any Google connect CTA", async () => {
    seedMockEvents([]);

    render(<HomeDashboard nowOverride={currentDate} />);

    expect(
      await screen.findByText("Nothing on the calendar today"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect google calendar/i }),
    ).not.toBeInTheDocument();
  });

  it("filters hero, today, and coming up when a member chip is focused", async () => {
    seedMockEvents([
      createTestEventResponse({
        id: "john-today",
        title: "John event",
        date: "2026-04-25",
        startTime: "9:30 AM",
        endTime: "10:00 AM",
        memberId: testMembers[0].id,
      }),
      createTestEventResponse({
        id: "jane-today",
        title: "Jane event",
        date: "2026-04-25",
        startTime: "11:00 AM",
        endTime: "12:00 PM",
        memberId: testMembers[1].id,
      }),
      createTestEventResponse({
        id: "john-tomorrow",
        title: "John tomorrow",
        date: "2026-04-26",
        startTime: "9:00 AM",
        endTime: "10:00 AM",
        memberId: testMembers[0].id,
      }),
      createTestEventResponse({
        id: "jane-tomorrow",
        title: "Jane tomorrow",
        date: "2026-04-26",
        startTime: "2:00 PM",
        endTime: "3:00 PM",
        memberId: testMembers[1].id,
      }),
    ]);

    const { user } = renderWithUser(
      <HomeDashboard nowOverride={currentDate} />,
    );

    await screen.findByText("John event");
    await user.click(
      screen.getByRole("button", { name: "Focus on Jane's events" }),
    );

    expect(screen.getByText("Jane event")).toBeInTheDocument();
    expect(screen.getByText("Jane tomorrow")).toBeInTheDocument();
    expect(screen.queryByText("John event")).not.toBeInTheDocument();
    expect(screen.queryByText("John tomorrow")).not.toBeInTheDocument();
    expect(screen.getByText("Up next · in 2 hrs")).toBeInTheDocument();
  });

  it("keeps non-hero recurring instances visible when the hero event is virtual", async () => {
    seedMockEvents([
      createTestEventResponse({
        id: null,
        recurringEventId: "series-1",
        isRecurring: true,
        title: "Morning standup",
        date: "2026-04-25",
        startTime: "9:30 AM",
        endTime: "10:00 AM",
        memberId: testMembers[0].id,
      }),
      createTestEventResponse({
        id: null,
        recurringEventId: "series-2",
        isRecurring: true,
        title: "Doctor follow-up",
        date: "2026-04-25",
        startTime: "11:00 AM",
        endTime: "11:30 AM",
        memberId: testMembers[1].id,
      }),
    ]);

    render(<HomeDashboard nowOverride={currentDate} />);

    expect(await screen.findByText("Morning standup")).toBeInTheDocument();
    expect(screen.getByText("Doctor follow-up")).toBeInTheDocument();
  });

  it("clears stale delete errors before opening a different event detail", async () => {
    server.use(
      http.delete(`${API_BASE}/calendar/events/:id`, () =>
        HttpResponse.json({ message: "Delete failed" }, { status: 500 }),
      ),
    );
    seedMockEvents([
      createTestEventResponse({
        id: "event-breakfast",
        title: "Breakfast",
        date: "2026-04-25",
        startTime: "8:00 AM",
        endTime: "9:00 AM",
        memberId: testMembers[0].id,
      }),
      createTestEventResponse({
        id: "event-pickup",
        title: "School pickup",
        date: "2026-04-25",
        startTime: "10:00 AM",
        endTime: "11:00 AM",
        memberId: testMembers[1].id,
      }),
    ]);

    const { user } = renderWithUser(
      <HomeDashboard nowOverride={new Date(2026, 3, 25, 12, 0, 0, 0)} />,
    );

    await screen.findByText("Breakfast");

    await user.click(screen.getByRole("button", { name: /breakfast/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /delete event/i }));

    expect(await screen.findByText("Delete failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back/i }));
    await user.click(screen.getByRole("button", { name: /school pickup/i }));

    expect(screen.queryByText("Delete failed")).not.toBeInTheDocument();
  });

  it("opens the reused add-event flow prefilled for the focused member and today", async () => {
    seedMockEvents([]);

    const { user } = renderWithUser(
      <HomeDashboard nowOverride={currentDate} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Focus on Jane's events" }),
    );
    await user.click(screen.getByRole("button", { name: /add event/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitForMemberSelected("Jane");
    expect(
      screen.getByRole("button", { name: /april 25th, 2026/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Save to" })).toHaveValue(
      "native",
    );
  });

  it("creates a Google destination from the Home add-event flow without posting a native event", async () => {
    seedMockEvents([]);
    let googlePosts = 0;
    let nativePosts = 0;
    server.use(
      http.get(`${API_BASE}/google/events/destinations`, () =>
        HttpResponse.json({
          data: {
            destinations: [
              {
                syncedCalendarId: "calendar-1",
                memberId: testMembers[0].id,
                memberName: "John",
                calendarName: "Personal",
                accessRole: "owner",
              },
            ],
            reconnectMemberIds: [],
            unavailableMemberIds: [],
          },
        }),
      ),
      http.post(`${API_BASE}/calendar/events`, () => {
        nativePosts++;
        return HttpResponse.json({}, { status: 500 });
      }),
      http.post(`${API_BASE}/google/events`, () => {
        googlePosts++;
        return HttpResponse.json({
          data: createTestEventResponse({
            title: "Google Home Event",
            source: "GOOGLE",
          }),
        });
      }),
    );

    const { user } = renderWithUser(
      <HomeDashboard nowOverride={currentDate} />,
    );
    await user.click(screen.getByRole("button", { name: /add event/i }));
    await waitForMemberSelected("John");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Save to" }),
      `${testMembers[0].id}:calendar-1`,
    );
    await typeAndWait(
      user,
      screen.getByLabelText(/event name/i),
      "Google Home Event",
    );
    await user.click(screen.getByRole("button", { name: /^add event$/i }));

    await waitFor(() => expect(googlePosts).toBe(1));
    expect(nativePosts).toBe(0);
  });

  it("edits a recurring Google occurrence from Home with an explicit scope", async () => {
    const event = createTestEventResponse({
      id: null,
      recurringEventId: "google-parent-row",
      isRecurring: true,
      recurrenceRule: "RRULE:FREQ=WEEKLY;BYDAY=SA",
      title: "Weekly Google breakfast",
      date: "2026-04-25",
      startTime: "9:45 AM",
      endTime: "10:15 AM",
      memberId: testMembers[0].id,
      source: "GOOGLE",
      syncedCalendarId: "calendar-1",
    });
    seedMockEvents([event]);
    let capturedId = "";
    let capturedBody: Record<string, unknown> = {};
    server.use(
      http.get(`${API_BASE}/google/events/destinations`, () =>
        HttpResponse.json({
          data: {
            destinations: [
              {
                syncedCalendarId: "calendar-1",
                memberId: testMembers[0].id,
                memberName: "John",
                calendarName: "Personal",
                accessRole: "owner",
              },
            ],
            reconnectMemberIds: [],
            unavailableMemberIds: [],
          },
        }),
      ),
      http.put(`${API_BASE}/google/events/:id`, async ({ request, params }) => {
        capturedId = String(params.id);
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: event });
      }),
    );

    const { user } = renderWithUser(
      <HomeDashboard nowOverride={currentDate} />,
    );
    await user.click(
      await screen.findByRole("button", { name: /weekly google breakfast/i }),
    );
    const edit = await screen.findByRole("button", { name: "Edit" });
    await waitFor(() => expect(edit).toBeEnabled());
    await user.click(edit);
    expect(
      screen.getByRole("dialog", { name: "Edit recurring event" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByText("Editing: This event")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(capturedId).toBe("google-parent-row"));
    expect(capturedBody).toMatchObject({
      scope: "THIS_EVENT",
      occurrenceDate: "2026-04-25",
    });
  });

  it("renders the activity feed region on mobile", async () => {
    setViewportWidth(768);
    render(<HomeDashboard nowOverride={new Date(2026, 5, 21, 12)} />);
    // Assert the region, not its heading: the heading is first-run dependent
    // ("What's new" until the lastSeen marker is written), and this test is about
    // the feed rendering at all. First-run copy is covered in activity-feed.test.tsx.
    expect(
      await screen.findByRole("region", { name: "Recent changes" }),
    ).toBeInTheDocument();
  });

  it("renders the large-screen home dashboard on desktop without mobile feed", async () => {
    setViewportWidth(1024);
    seedMockEvents([
      createTestEventResponse({
        id: "today",
        title: "Swim lesson",
        date: "2026-06-21",
        startTime: "1:00 PM",
        endTime: "2:00 PM",
        memberId: testMembers[0].id,
      }),
    ]);

    render(<HomeDashboard nowOverride={new Date(2026, 5, 21, 12)} />);

    expect(
      await screen.findByTestId("large-home-dashboard"),
    ).toBeInTheDocument();
    expect(screen.getByText("Swim lesson")).toBeInTheDocument();
    expect(
      screen.queryByText(/Since you last opened/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add event/i }),
    ).not.toBeInTheDocument();
  });

  it("routes large-screen event taps to Calendar instead of opening inline detail", async () => {
    setViewportWidth(1024);
    seedMockEvents([
      createTestEventResponse({
        id: "swim",
        title: "Swim lesson",
        date: "2026-06-21",
        startTime: "1:00 PM",
        endTime: "2:00 PM",
        memberId: testMembers[0].id,
      }),
    ]);

    const { user } = renderWithUser(
      <HomeDashboard nowOverride={new Date(2026, 5, 21, 12)} />,
    );

    await user.click(
      await screen.findByRole("button", { name: /up next: swim lesson/i }),
    );

    expect(useAppStore.getState().activeModule).toBe("calendar");
    expect(useAppStore.getState().calendarEventIntent).toEqual({
      date: "2026-06-21",
      eventKey: "swim",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("routes large-screen state strip taps to Chores, Meals, and Lists", async () => {
    setViewportWidth(1024);
    seedMockLists([groceryList]);
    const { user } = renderWithUser(
      <HomeDashboard nowOverride={new Date(2026, 5, 21, 12)} />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /open chores\. no chores configured/i,
      }),
    );
    expect(useAppStore.getState().activeModule).toBe("chores");

    useAppStore.getState().setActiveModule(null);
    await user.click(
      await screen.findByRole("button", {
        name: /open meals\. dinner not planned/i,
      }),
    );
    expect(useAppStore.getState().activeModule).toBe("meals");
    expect(useAppStore.getState().mealSlotIntent).toMatchObject({
      mealType: "dinner",
    });

    useAppStore.getState().setActiveModule(null);
    await user.click(
      await screen.findByRole("button", {
        name: /open lists\. 1 grocery item/i,
      }),
    );
    expect(useAppStore.getState().activeModule).toBe("lists");
    expect(useAppStore.getState().listDetailIntent).toBe("grocery-1");
  });
});
