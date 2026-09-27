import {
  choresNeedingAttentionCount,
  scheduledChoresNeedingAttention,
} from "@/lib/chore-attention";
import {
  formatLocalDate,
  getEventKey,
  getWeekStartSunday,
} from "@/lib/time-utils";
import type {
  CalendarEvent,
  ChoreBoardItem,
  ChoreScope,
  ChoresBoard,
  ListSummary,
  MealBoard,
  MealDay,
  MealSlot,
  MealType,
} from "@/lib/types";
import { compareAllDayFirst, getEventDateTime } from "./event-time";

export type SummaryStatus =
  | "loading"
  | "unavailable"
  | "empty"
  | "done"
  | "remaining"
  | "planned"
  | "missing"
  | "active"
  | "quiet";

export interface MealSlotTarget {
  weekStartDate: string;
  dayIndex: number;
  mealType: MealType;
}

export type HomeSummaryTarget =
  | { module: "chores" }
  | { module: "lists"; listId?: string }
  | ({ module: "meals" } & MealSlotTarget);

export interface HomeStateSummary {
  module: "chores" | "meals" | "lists";
  kind: SummaryStatus;
  label: string;
  target: HomeSummaryTarget;
}

export interface HomeAgendaChore {
  chore: ChoreBoardItem;
  scope: ChoreScope;
  periodStartDate: string;
}

/** The same due/overdue board items and period identity used by Chores. */
export function selectHomeAgendaChores(board: ChoresBoard): HomeAgendaChore[] {
  const daily = board.today.assignees.flatMap((group) =>
    group.chores
      .filter(
        (chore) =>
          !chore.completed &&
          (chore.dueState === "DUE" || chore.dueState === "OVERDUE"),
      )
      .map((chore) => ({
        chore,
        scope: "TODAY" as const,
        periodStartDate: chore.periodStartDate ?? board.today.periodStartDate,
      })),
  );
  const scheduled = scheduledChoresNeedingAttention(board).map((chore) => {
    const scope: ChoreScope =
      chore.cadence === "MONTHLY" || chore.cadence === "ONE_OFF"
        ? "THIS_MONTH"
        : "THIS_WEEK";
    const period = scope === "THIS_MONTH" ? board.thisMonth : board.thisWeek;
    return {
      chore,
      scope,
      periodStartDate: chore.periodStartDate ?? period.periodStartDate,
    };
  });
  return [...daily, ...scheduled].sort((left, right) => {
    if (left.chore.dueState === right.chore.dueState) return 0;
    return left.chore.dueState === "OVERDUE" ? -1 : 1;
  });
}

/**
 * Rest-of-day agenda items, excluding the hero by event KEY (recurring-safe:
 * matches on id, or recurringEventId+date for expanded instances) so the same
 * recurring instance isn't duplicated. All-day events always survive the
 * ended-filter regardless of `now`; timed events are dropped once ended.
 */
export function selectRestOfDayItems(
  todayEvents: CalendarEvent[],
  heroEvent: CalendarEvent | null,
  now: Date,
  limit = 5,
): CalendarEvent[] {
  const heroKey = heroEvent ? getEventKey(heroEvent) : null;

  return todayEvents
    .filter((event) => getEventKey(event) !== heroKey)
    .filter((event) => {
      if (event.isAllDay) return true;
      return getEventDateTime(event, "end") > now;
    })
    .sort(compareAllDayFirst)
    .slice(0, limit);
}

/** Summaries always carry a routing target, even when loading or unavailable. */
export function deriveChoresSummary({
  board,
  isLoading,
  isError,
}: {
  board: ChoresBoard | null | undefined;
  isLoading: boolean;
  isError: boolean;
}): HomeStateSummary {
  if (isLoading) {
    return {
      module: "chores",
      kind: "loading",
      label: "Loading chores",
      target: { module: "chores" },
    };
  }
  if (isError || !board) {
    return {
      module: "chores",
      kind: "unavailable",
      label: "Chores unavailable",
      target: { module: "chores" },
    };
  }

  const { total } = board.today.summary;
  const remaining = choresNeedingAttentionCount(board);
  if (
    total + board.thisWeek.summary.total + board.thisMonth.summary.total ===
    0
  ) {
    return {
      module: "chores",
      kind: "empty",
      label: "No chores configured",
      target: { module: "chores" },
    };
  }
  if (remaining === 0) {
    return {
      module: "chores",
      kind: "done",
      label:
        board.thisWeek.summary.remaining + board.thisMonth.summary.remaining > 0
          ? "Nothing due now"
          : "Chores done",
      target: { module: "chores" },
    };
  }

  return {
    module: "chores",
    kind: "remaining",
    label: `${remaining} chore${remaining === 1 ? "" : "s"} left`,
    target: { module: "chores" },
  };
}

/** Locates today's day entry and dinner slot in a single pass over the board. */
function findTodayDinnerSlot(
  board: MealBoard,
  today: Date,
): { day: MealDay; slot: MealSlot } | null {
  const todayKey = formatLocalDate(today);
  const day = board.days.find((candidate) => candidate.date === todayKey);
  const slot = day?.slots.find((candidate) => candidate.mealType === "dinner");
  if (!day || !slot) return null;

  return { day, slot };
}

/** Routing target for today's dinner slot, or null when today isn't on the board. */
export function getTodayDinnerTarget(
  board: MealBoard,
  today: Date,
): MealSlotTarget | null {
  const found = findTodayDinnerSlot(board, today);
  if (!found) return null;

  return {
    weekStartDate: board.weekStartDate,
    dayIndex: found.day.dayIndex,
    mealType: "dinner",
  };
}

/** Summaries always carry a routing target, even when loading or unavailable. */
export function deriveMealsSummary({
  board,
  today,
  isLoading,
  isError,
}: {
  board: MealBoard | null | undefined;
  today: Date;
  isLoading: boolean;
  isError: boolean;
}): HomeStateSummary {
  const fallbackTarget: MealSlotTarget = {
    weekStartDate: formatLocalDate(getWeekStartSunday(today)),
    dayIndex: today.getDay(),
    mealType: "dinner",
  };

  if (isLoading) {
    return {
      module: "meals",
      kind: "loading",
      label: "Loading meals",
      target: { module: "meals", ...fallbackTarget },
    };
  }
  if (isError || !board) {
    return {
      module: "meals",
      kind: "unavailable",
      label: "Meals unavailable",
      target: { module: "meals", ...fallbackTarget },
    };
  }

  const found = findTodayDinnerSlot(board, today);
  const target: MealSlotTarget = found
    ? {
        weekStartDate: board.weekStartDate,
        dayIndex: found.day.dayIndex,
        mealType: "dinner",
      }
    : fallbackTarget;
  const dinner = found?.slot;
  const title = dinner?.primary?.title ?? dinner?.extras[0]?.title ?? null;

  if (title) {
    return {
      module: "meals",
      kind: "planned",
      label: `${title} tonight`,
      target: { module: "meals", ...target },
    };
  }

  return {
    module: "meals",
    kind: "missing",
    label: "Dinner not planned",
    target: { module: "meals", ...target },
  };
}

/** Summaries always carry a routing target, even when loading or unavailable. */
export function deriveListsSummary({
  lists,
  isLoading,
  isError,
}: {
  lists: ListSummary[] | null | undefined;
  isLoading: boolean;
  isError: boolean;
}): HomeStateSummary {
  if (isLoading) {
    return {
      module: "lists",
      kind: "loading",
      label: "Loading lists",
      target: { module: "lists" },
    };
  }
  if (isError || !lists) {
    return {
      module: "lists",
      kind: "unavailable",
      label: "Lists unavailable",
      target: { module: "lists" },
    };
  }

  const grocery = lists
    .filter((list) => list.kind === "grocery")
    .map((list) => ({
      ...list,
      activeItems: Math.max(0, list.totalItems - list.completedItems),
    }))
    .sort((left, right) => right.activeItems - left.activeItems)[0];

  if (grocery && grocery.activeItems > 0) {
    return {
      module: "lists",
      kind: "active",
      label: `${grocery.activeItems} grocery item${grocery.activeItems === 1 ? "" : "s"}`,
      target: { module: "lists", listId: grocery.id },
    };
  }

  return {
    module: "lists",
    kind: "quiet",
    label: "Lists quiet",
    target: { module: "lists" },
  };
}
