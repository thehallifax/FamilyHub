import { useMemo, useRef, useState } from "react";
import {
  isStaleChorePeriodError,
  useCompleteChoreForCurrentPeriod,
  useFamilyMembers,
  useFamilyName,
} from "@/api";
import { useDashboardEvents } from "@/components/home/hooks/use-dashboard-events";
import { useDashboardNow } from "@/components/home/hooks/use-hero-state";
import { toast } from "@/components/ui/toaster";
import { formatLocalDate, getEventKey } from "@/lib/time-utils";
import type { CalendarEvent } from "@/lib/types";
import { useAppStore } from "@/stores";
import { LargeNowHero } from "./components/large-now-hero";
import { LargeStateStrip } from "./components/large-state-strip";
import { LargeTodayRail } from "./components/large-today-rail";
import { useLargeHomeSummaries } from "./hooks/use-large-home-summaries";
import { deriveHeroState } from "./lib/hero-state";
import {
  type HomeSummaryTarget,
  selectHomeAgendaChores,
  selectRestOfDayItems,
} from "./lib/large-home-selectors";

const LARGE_HOME_GRID_CLASS =
  "mx-auto grid min-h-full max-w-[118rem] grid-cols-[minmax(0,1.42fr)_minmax(22rem,0.88fr)] gap-6 px-6 py-6 lg:px-8 lg:py-8 2xl:gap-8 2xl:px-12 2xl:py-10";

function LoadingLargeHome() {
  return (
    <div className="flex-1 bg-background">
      <div className={LARGE_HOME_GRID_CLASS}>
        <div className="animate-pulse rounded-lg bg-card" />
        <div className="animate-pulse rounded-lg bg-card" />
      </div>
    </div>
  );
}

export function LargeHomeDashboard({
  nowOverride,
}: {
  nowOverride?: Date;
} = {}) {
  const familyName = useFamilyName();
  const members = useFamilyMembers();
  const liveNow = useDashboardNow();
  const now = nowOverride ?? liveNow;
  const { today, tomorrow, isLoading, isError, error } = useDashboardEvents({
    currentDate: now,
    memberFocusId: null,
  });
  const summaries = useLargeHomeSummaries({ now });
  const completingRef = useRef(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const completeChore = useCompleteChoreForCurrentPeriod({
    onError: (completionError) => {
      toast(
        isStaleChorePeriodError(completionError)
          ? {
              title: "Chores were out of date",
              description: "Refreshing the board. Try that again.",
              variant: "destructive",
            }
          : {
              title: "Could not complete chore",
              description: "Please try again.",
              variant: "destructive",
            },
      );
    },
  });
  const heroState = useMemo(
    () => deriveHeroState({ todayEvents: today, now }),
    [now, today],
  );
  const heroEvent = "event" in heroState ? heroState.event : null;
  const heroMember = heroEvent
    ? members.find((member) => member.id === heroEvent.memberId)
    : undefined;
  const todayItems = useMemo(
    () => selectRestOfDayItems(today, heroEvent, now),
    [heroEvent, now, today],
  );
  const choreItems = useMemo(
    () =>
      summaries.choreBoard ? selectHomeAgendaChores(summaries.choreBoard) : [],
    [summaries.choreBoard],
  );

  const openCalendarDate = (date: Date) =>
    useAppStore.getState().focusCalendarDate(formatLocalDate(date));
  const openChores = () => useAppStore.getState().setActiveModule("chores");
  const handleCompleteChore = (item: (typeof choreItems)[number]) => {
    if (completingRef.current || item.chore.completionAvailable === false)
      return;
    completingRef.current = true;
    setIsCompleting(true);
    completeChore.mutate(
      {
        templateId: item.chore.templateId,
        request: { scope: item.scope, periodStartDate: item.periodStartDate },
      },
      {
        onSettled: () => {
          completingRef.current = false;
          setIsCompleting(false);
        },
      },
    );
  };

  const openEvent = (event: CalendarEvent) => {
    useAppStore.getState().openCalendarEvent({
      date: formatLocalDate(event.date),
      eventKey: getEventKey(event),
    });
  };

  const openSummary = (target: HomeSummaryTarget) => {
    const store = useAppStore.getState();
    if (target.module === "chores") store.setActiveModule("chores");
    if (target.module === "lists") {
      if (target.listId) store.openListDetail(target.listId);
      else store.setActiveModule("lists");
    }
    if (target.module === "meals") {
      store.focusMealSlot({
        weekStartDate: target.weekStartDate,
        dayIndex: target.dayIndex,
        mealType: target.mealType,
      });
    }
  };

  if (isLoading) return <LoadingLargeHome />;

  if (isError) {
    return (
      <div className="flex-1 p-8 text-sm text-destructive">
        Error loading events: {error?.message ?? "Unknown error"}
      </div>
    );
  }

  return (
    <div
      data-testid="large-home-dashboard"
      className="flex-1 overflow-y-auto bg-transparent"
    >
      <div className={LARGE_HOME_GRID_CLASS}>
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">
              {familyName || "Family Hub"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              Home
            </h1>
          </div>
          <LargeNowHero
            state={heroState}
            member={heroMember}
            members={members}
            now={now}
            onOpenEvent={openEvent}
          />
          <LargeStateStrip
            summaries={[summaries.chores, summaries.meals, summaries.lists]}
            onSelect={openSummary}
          />
        </div>
        <LargeTodayRail
          currentDate={now}
          todayItems={todayItems}
          heroEventShown={heroEvent !== null}
          tomorrowItems={tomorrow.slice(0, 3)}
          tomorrowExtraCount={Math.max(0, tomorrow.length - 3)}
          chores={choreItems}
          choresLoading={summaries.choresLoading}
          choresError={summaries.choresError}
          isCompletingChore={isCompleting}
          members={members}
          onSelect={openEvent}
          onOpenCalendarDate={openCalendarDate}
          onOpenChores={openChores}
          onCompleteChore={handleCompleteChore}
        />
      </div>
    </div>
  );
}
