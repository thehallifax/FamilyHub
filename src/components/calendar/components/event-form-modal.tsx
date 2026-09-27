import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks";
import { eventMemberIds } from "@/lib/event-audience";
import { parseRRule } from "@/lib/recurrence-utils";
import { format12hTo24h, formatLocalDate } from "@/lib/time-utils";
import type { CalendarEvent } from "@/lib/types";
import type { EventFormData } from "@/lib/validations";
import { EventForm } from "./event-form";
import { MobileEventSheet } from "./mobile-event-sheet";

interface EventFormModalProps {
  mode: "add" | "edit";
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
  isPending?: boolean;
  defaultValues?: Partial<EventFormData>;
  /** For edit mode: the event to pre-populate the form with */
  event?: CalendarEvent;
  showRecurrencePicker?: boolean;
}

/**
 * Transform a CalendarEvent to EventFormData for the form
 * Handles date formatting and time conversion (12h -> 24h)
 */
function eventToFormData(event: CalendarEvent): Partial<EventFormData> {
  const base: Partial<EventFormData> = {
    title: event.title,
    date: formatLocalDate(event.date),
    endDate: event.endDate ? formatLocalDate(event.endDate) : undefined,
    startTime: format12hTo24h(event.startTime),
    endTime: format12hTo24h(event.endTime),
    memberId: event.memberId ?? undefined,
    audienceType: event.audienceType ?? "MEMBERS",
    memberIds: eventMemberIds(event),
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    isAllDay: event.isAllDay,
    destination: event.source === "GOOGLE" ? "google-existing" : "native",
  };

  if (event.recurrenceRule) {
    const recurrence = parseRRule(event.recurrenceRule);
    base.recurrenceFrequency = recurrence.frequency;
    base.recurrenceInterval = recurrence.interval;
    base.recurrenceWeeklyDays = recurrence.weeklyDays;
    base.recurrenceMonthDay = recurrence.monthDay;
    base.recurrenceEndDate = recurrence.endDate;
  }

  return base;
}

function EventFormModal({
  mode,
  isOpen,
  onClose,
  onSubmit,
  isPending = false,
  defaultValues,
  event,
  showRecurrencePicker,
}: EventFormModalProps) {
  const isMobile = useIsMobile();
  const title = mode === "add" ? "Add Event" : "Edit Event";

  // For edit mode, convert the event to form data
  const formDefaultValues = event ? eventToFormData(event) : defaultValues;

  if (isMobile) {
    return (
      <MobileEventSheet isOpen={isOpen} onClose={onClose} title={title}>
        <EventForm
          mode={mode}
          defaultValues={formDefaultValues}
          onSubmit={onSubmit}
          onCancel={onClose}
          isPending={isPending}
          showRecurrencePicker={showRecurrencePicker}
          hideCancelButton
          googleBacked={event?.source === "GOOGLE"}
        />
      </MobileEventSheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Height is bounded and scrolled by DialogContent itself, so the form
          stays reachable once "Add details" expands past a short viewport. */}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader onClose={onClose}>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <EventForm
          mode={mode}
          defaultValues={formDefaultValues}
          onSubmit={onSubmit}
          onCancel={onClose}
          isPending={isPending}
          showRecurrencePicker={showRecurrencePicker}
          googleBacked={event?.source === "GOOGLE"}
        />
      </DialogContent>
    </Dialog>
  );
}

export type { EventFormModalProps };
export { EventFormModal };
