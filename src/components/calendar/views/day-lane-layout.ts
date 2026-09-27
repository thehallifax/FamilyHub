import { getTimeInMinutes } from "@/lib/time-utils";
import type { CalendarEvent } from "@/lib/types";
import { getEventOffsetsForDay } from "../utils/hour-grid";

export interface EventWithLayout extends CalendarEvent {
  column: number;
  totalColumns: number;
}

function interval(event: CalendarEvent, day?: Date, gridEndHour = 24) {
  if (day) {
    const offsets = getEventOffsetsForDay(event, day, gridEndHour);
    return offsets
      ? {
          start: offsets.startOffsetHours,
          end: offsets.startOffsetHours + offsets.spanHours,
        }
      : null;
  }
  return {
    start: getTimeInMinutes(event.startTime),
    end: getTimeInMinutes(event.endTime),
  };
}

export function eventsOverlap(
  a: CalendarEvent,
  b: CalendarEvent,
  day?: Date,
  gridEndHour = 24,
): boolean {
  const aRange = interval(a, day, gridEndHour);
  const bRange = interval(b, day, gridEndHour);
  return (
    aRange !== null &&
    bRange !== null &&
    aRange.start < bRange.end &&
    bRange.start < aRange.end
  );
}

/**
 * Greedy column packing for overlapping timed events. Each event gets the first
 * column where it does not overlap an existing event; totalColumns is the width
 * of its overlap cluster. Used by the tablet Day canvas and each member lane.
 */
export function calculateEventColumns(
  events: CalendarEvent[],
  day?: Date,
  gridEndHour = 24,
): EventWithLayout[] {
  if (events.length === 0) return [];

  const sorted = events
    .filter((event) => interval(event, day, gridEndHour) !== null)
    .sort((a, b) => {
      const aRange = interval(a, day, gridEndHour)!;
      const bRange = interval(b, day, gridEndHour)!;
      const aStart = aRange.start;
      const bStart = bRange.start;
      if (aStart !== bStart) return aStart - bStart;
      const aDuration = aRange.end - aStart;
      const bDuration = bRange.end - bStart;
      return bDuration - aDuration;
    });

  const result: EventWithLayout[] = [];
  const columns: CalendarEvent[][] = [];

  for (const event of sorted) {
    let assignedColumn = -1;
    for (let col = 0; col < columns.length; col++) {
      const hasOverlap = columns[col].some((e) =>
        eventsOverlap(e, event, day, gridEndHour),
      );
      if (!hasOverlap) {
        assignedColumn = col;
        break;
      }
    }
    if (assignedColumn === -1) {
      assignedColumn = columns.length;
      columns.push([]);
    }
    columns[assignedColumn].push(event);
    result.push({ ...event, column: assignedColumn, totalColumns: 0 });
  }

  for (const eventWithLayout of result) {
    const overlapping = result.filter((e) =>
      eventsOverlap(e, eventWithLayout, day, gridEndHour),
    );
    const maxColumn = Math.max(...overlapping.map((e) => e.column));
    eventWithLayout.totalColumns = maxColumn + 1;
  }

  return result;
}
