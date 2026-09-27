import { fireEvent, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChoreBoardItem,
  ChoresBoard,
  UpdateCurrentPeriodCompletionRequest,
} from "@/lib/types";
import { useAppStore } from "@/stores";
import { createTestEventResponse } from "@/test/fixtures";
import {
  API_BASE,
  getMockChoresBoard,
  seedMockChoresBoard,
  seedMockEvents,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedAuthStore,
  seedFamilyStore,
} from "@/test/test-utils";
import { LargeHomeDashboard } from "./large-home-dashboard";

const now = new Date(2026, 6, 5, 9, 0);
const member = { id: "m1", name: "Alice", color: "coral" as const };

function chore(
  templateId: string,
  cadence: ChoreBoardItem["cadence"],
  dueState: ChoreBoardItem["dueState"],
): ChoreBoardItem {
  return {
    templateId,
    title: templateId,
    cadence,
    assignedToMemberId: member.id,
    completed: false,
    completedAt: null,
    dueState,
  };
}

function seedBoard(): ChoresBoard {
  const board = getMockChoresBoard();
  board.today.periodStartDate = "2026-07-05";
  board.today.periodEndDate = "2026-07-05";
  board.today.summary = { total: 1, completed: 0, remaining: 1 };
  board.today.assignees = [
    {
      member,
      summary: { total: 1, completed: 0, remaining: 1 },
      chores: [chore("Dishes", "DAILY", "DUE")],
    },
  ];
  board.thisWeek.periodStartDate = "2026-07-05";
  board.thisWeek.periodEndDate = "2026-07-11";
  board.thisWeek.summary = { total: 2, completed: 0, remaining: 2 };
  board.thisWeek.assignees = [
    {
      member,
      summary: { total: 2, completed: 0, remaining: 2 },
      chores: [
        chore("Bins", "WEEKLY", "DUE"),
        chore("Vacuum", "WEEKLY", "UPCOMING"),
      ],
    },
  ];
  board.thisMonth.periodStartDate = "2026-07-01";
  board.thisMonth.periodEndDate = "2026-07-31";
  board.thisMonth.summary = { total: 1, completed: 0, remaining: 1 };
  board.thisMonth.assignees = [
    {
      member,
      summary: { total: 1, completed: 0, remaining: 1 },
      chores: [chore("Sheets", "MONTHLY", "OVERDUE")],
    },
  ];
  seedMockChoresBoard(board);
  return board;
}

describe("large Home agenda", () => {
  setupMswServer();

  beforeEach(() => {
    seedAuthStore({ isAuthenticated: true });
    seedFamilyStore({ name: "Family", members: [member] });
    useAppStore.setState({ activeModule: null });
  });

  it("uses due chores, completes directly, and focuses Calendar by day", async () => {
    seedBoard();
    seedMockEvents(
      Array.from({ length: 5 }, (_, index) =>
        createTestEventResponse({
          id: `tomorrow-${index}`,
          title: `Tomorrow event ${index}`,
          date: "2026-07-06",
          startTime: ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM"][
            index
          ],
          endTime: ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM"][
            index
          ],
          memberId: member.id,
        }),
      ),
    );
    const { user } = renderWithUser(<LargeHomeDashboard nowOverride={now} />);

    expect(
      await screen.findByRole("button", { name: "Complete Dishes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete Sheets" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete Vacuum" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+2 more" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Complete Dishes" }));
    expect(useAppStore.getState().activeModule).toBeNull();
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Complete Dishes" }),
      ).not.toBeInTheDocument();
      expect(getMockChoresBoard().today.assignees[0].chores[0].completed).toBe(
        true,
      );
    });

    await user.click(screen.getByRole("button", { name: "Tomorrow" }));
    expect(useAppStore.getState()).toMatchObject({
      activeModule: "calendar",
      calendarFocusDate: "2026-07-06",
    });
    await user.click(screen.getByRole("button", { name: /Today Sun, Jul 5/ }));
    expect(useAppStore.getState().calendarFocusDate).toBe("2026-07-05");

    await user.click(screen.getByRole("button", { name: /Sheets Overdue/ }));
    expect(useAppStore.getState().activeModule).toBe("chores");
  });

  it("blocks a second completion while the first request is pending", async () => {
    seedBoard();
    let releaseRequest: (() => void) | undefined;
    const requestGate = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const requests = vi.fn();
    server.use(
      http.put(
        `${API_BASE}/chores/templates/:id/current-period-completion`,
        async () => {
          requests();
          await requestGate;
          return HttpResponse.json({ message: "Unavailable" }, { status: 503 });
        },
      ),
    );
    renderWithUser(<LargeHomeDashboard nowOverride={now} />);

    const dishes = await screen.findByRole("button", {
      name: "Complete Dishes",
    });
    fireEvent.click(dishes);
    await waitFor(() => expect(requests).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "Complete Bins" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Complete Bins" }));
    expect(requests).toHaveBeenCalledOnce();
    releaseRequest?.();
    expect(
      await screen.findByRole("button", { name: "Complete Dishes" }),
    ).toBeEnabled();
  });

  it("completes a due one-off using its permanent fixed period", async () => {
    const board = seedBoard();
    board.thisMonth.assignees[0].chores = [
      {
        ...chore("Renew passport", "ONE_OFF", "DUE"),
        dueDate: "2026-07-05",
        oneOffDueDate: "2026-07-05",
        periodStartDate: "2026-07-05",
        periodEndDate: "2026-07-05",
      },
    ];
    seedMockChoresBoard(board);
    let submitted: UpdateCurrentPeriodCompletionRequest | null = null;
    server.use(
      http.put(
        `${API_BASE}/chores/templates/:id/current-period-completion`,
        async ({ request }) => {
          submitted =
            (await request.json()) as UpdateCurrentPeriodCompletionRequest;
          return HttpResponse.json({
            data: {
              scope: "THIS_MONTH",
              periodStartDate: "2026-07-05",
              periodEndDate: "2026-07-05",
              item: {
                ...board.thisMonth.assignees[0].chores[0],
                completed: true,
                dueState: "COMPLETE",
                completedAt: "2026-07-05T09:00:00Z",
              },
            },
          });
        },
      ),
    );
    const { user } = renderWithUser(<LargeHomeDashboard nowOverride={now} />);

    await user.click(
      await screen.findByRole("button", { name: "Complete Renew passport" }),
    );
    await waitFor(() =>
      expect(submitted).toEqual({
        scope: "THIS_MONTH",
        periodStartDate: "2026-07-05",
      }),
    );
  });
});
