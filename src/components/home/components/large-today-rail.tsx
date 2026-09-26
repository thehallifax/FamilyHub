import { addDays, format } from "date-fns";
import { Check, ChevronRight } from "lucide-react";
import { eventAudienceLabel, eventColors } from "@/lib/event-audience";
import { getEventKey } from "@/lib/time-utils";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatEventTimeForDisplay } from "../lib/event-time";
import type { HomeAgendaChore } from "../lib/large-home-selectors";

function EventRow({
  event,
  members,
  onSelect,
}: {
  event: CalendarEvent;
  members: FamilyMember[];
  onSelect: (event: CalendarEvent) => void;
}) {
  const colors = eventColors(event, members);
  const time = event.isAllDay
    ? "All day"
    : formatEventTimeForDisplay(event.startTime);
  const audience = eventAudienceLabel(event, members);

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span
        aria-hidden="true"
        className={cn("h-2.5 w-2.5 shrink-0 rounded-full", colors.bg)}
      />
      <span className="w-20 shrink-0 text-sm font-medium text-foreground/60">
        {time}
      </span>
      <span className="flex min-w-0 flex-1 flex-col @min-[28rem]:flex-row @min-[28rem]:items-baseline @min-[28rem]:gap-3">
        <span
          className="min-w-0 truncate text-lg font-semibold leading-7 text-foreground @min-[28rem]:flex-1"
          title={event.title}
        >
          {event.title}
        </span>
        <span
          className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere] @min-[28rem]:max-w-[50%] @min-[28rem]:truncate"
          title={audience}
        >
          {event.source === "GOOGLE" ? `Google · ${audience}` : audience}
        </span>
      </span>
    </button>
  );
}

export function LargeTodayRail({
  currentDate,
  todayItems,
  heroEventShown = false,
  tomorrowItems,
  tomorrowExtraCount = 0,
  chores = [],
  choresLoading = false,
  choresError = false,
  isCompletingChore = false,
  members,
  onSelect,
  onOpenCalendarDate = () => {},
  onOpenChores = () => {},
  onCompleteChore = () => {},
}: {
  currentDate: Date;
  todayItems: CalendarEvent[];
  heroEventShown?: boolean;
  tomorrowItems: CalendarEvent[];
  tomorrowExtraCount?: number;
  chores?: HomeAgendaChore[];
  choresLoading?: boolean;
  choresError?: boolean;
  isCompletingChore?: boolean;
  members: FamilyMember[];
  onSelect: (event: CalendarEvent) => void;
  onOpenCalendarDate?: (date: Date) => void;
  onOpenChores?: () => void;
  onCompleteChore?: (item: HomeAgendaChore) => void;
}) {
  const tomorrowDate = addDays(currentDate, 1);

  return (
    <aside className="@container flex min-h-0 min-w-0 flex-col gap-5 rounded-lg border border-border/70 bg-card px-5 py-5 shadow-sm">
      <section>
        <button
          type="button"
          onClick={() => onOpenCalendarDate(currentDate)}
          className="mb-2 flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="text-2xl font-semibold leading-8 text-foreground">
            Today
          </h3>
          <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            {format(currentDate, "EEE, MMM d")}
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </span>
        </button>
        {todayItems.length > 0 ? (
          <div className="space-y-1">
            {todayItems.map((event) => (
              <EventRow
                key={getEventKey(event)}
                event={event}
                members={members}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            {heroEventShown
              ? "Current or next event shown at left"
              : "Rest of day clear"}
          </p>
        )}
      </section>

      <section className="border-t border-border/70 pt-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">Chores</h3>
          {chores.length > 0 && (
            <button
              type="button"
              onClick={onOpenChores}
              className="min-h-11 rounded-lg px-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View chores
            </button>
          )}
        </div>
        {chores.length > 0 ? (
          <div className="space-y-1">
            {chores.slice(0, 5).map((item) => (
              <div
                key={`${item.scope}-${item.chore.templateId}`}
                className="flex min-w-0 items-center gap-2 rounded-lg hover:bg-muted/40"
              >
                <button
                  type="button"
                  onClick={onOpenChores}
                  className="min-h-12 min-w-0 flex-1 rounded-lg px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {item.chore.title}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-xs",
                      item.chore.dueState === "OVERDUE"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {item.chore.dueState === "OVERDUE"
                      ? "Overdue"
                      : "Due today"}
                    {" · "}
                    {members.find(
                      (member) => member.id === item.chore.assignedToMemberId,
                    )?.name ?? "Family member"}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Complete ${item.chore.title}`}
                  onClick={() => onCompleteChore(item)}
                  disabled={
                    isCompletingChore ||
                    item.chore.completionAvailable === false
                  }
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Check className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            ))}
            {chores.length > 5 && (
              <button
                type="button"
                onClick={onOpenChores}
                className="min-h-11 rounded-lg px-2 text-sm font-medium text-primary"
              >
                +{chores.length - 5} more chores
              </button>
            )}
          </div>
        ) : (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            {choresLoading
              ? "Loading chores…"
              : choresError
                ? "Chores unavailable"
                : "No chores need attention"}
          </p>
        )}
      </section>

      <section className="border-t border-border/70 pt-4">
        <button
          type="button"
          onClick={() => onOpenCalendarDate(tomorrowDate)}
          className="mb-2 flex min-h-11 w-full items-center justify-between rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h3 className="text-base font-semibold leading-6 text-foreground/75">
            Tomorrow
          </h3>
          <ChevronRight
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </button>
        {tomorrowItems.length > 0 ? (
          <div className="space-y-1">
            {tomorrowItems.map((event) => (
              <EventRow
                key={getEventKey(event)}
                event={event}
                members={members}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <p className="px-2 py-2 text-sm text-muted-foreground">
            Nothing scheduled
          </p>
        )}
        {tomorrowExtraCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenCalendarDate(tomorrowDate)}
            className="min-h-11 rounded-lg px-2 text-sm font-medium text-primary"
          >
            +{tomorrowExtraCount} more
          </button>
        )}
      </section>
      <button
        type="button"
        onClick={() => onOpenCalendarDate(currentDate)}
        className="min-h-11 self-start rounded-lg px-2 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        View calendar
      </button>
    </aside>
  );
}
