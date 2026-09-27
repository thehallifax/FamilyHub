import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useFamilyMembers, useGoogleWriteDestinations } from "@/api";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import type { RecurrenceFrequency } from "@/lib/recurrence-utils";
import { getSmartDefaultTimes, parseLocalDate } from "@/lib/time-utils";
import { colorMap } from "@/lib/types";
import { cn } from "@/lib/utils";
import { type EventFormData, eventFormSchema } from "@/lib/validations";
import { RecurrencePicker } from "./recurrence-picker";

interface EventFormProps {
  mode: "add" | "edit";
  defaultValues?: Partial<EventFormData>;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
  isPending?: boolean;
  showRecurrencePicker?: boolean;
  hideCancelButton?: boolean;
  googleBacked?: boolean;
}

const DEFAULT_DURATION_MINUTES = 60;
const LAST_MINUTE_OF_DAY = 23 * 60 + 59;
const NUDGE_MINUTES = 15;
const TIME_PATTERN = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

function parseTimeToMinutes(time?: string): number | null {
  if (!time) return null;

  const match = TIME_PATTERN.exec(time);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutesToTime(minutes: number): string {
  const clampedMinutes = Math.max(0, Math.min(minutes, LAST_MINUTE_OF_DAY));
  const hours = Math.floor(clampedMinutes / 60);
  const mins = clampedMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function getDurationMinutes(startTime?: string, endTime?: string): number {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return DEFAULT_DURATION_MINUTES;
  }

  return endMinutes - startMinutes;
}

function EventForm({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  isPending = false,
  showRecurrencePicker = true,
  hideCancelButton = false,
  googleBacked = false,
}: EventFormProps) {
  const familyMembers = useFamilyMembers();
  const {
    data: writeDestinations,
    isError: destinationsError,
    refetch: retryDestinations,
  } = useGoogleWriteDestinations(mode === "add");

  /**
   * Get smart defaults for add mode
   * - Date: today
   * - Start time: next 15-min slot (clamped to visible calendar hours)
   * - End time: 1 hour after start
   * - Member: first family member
   */
  const getAddModeDefaults = useMemo((): Partial<EventFormData> => {
    const { startTime, endTime } = getSmartDefaultTimes();

    return {
      title: "",
      destination: "native",
      date: format(new Date(), "yyyy-MM-dd"),
      startTime,
      endTime,
      audienceType: "MEMBERS",
      memberIds: familyMembers[0] ? [familyMembers[0].id] : [],
    };
  }, [familyMembers]);

  // Use smart defaults for add mode, or provided defaults for edit mode
  const initialValues = useMemo(() => {
    const values =
      mode === "add"
        ? { ...getAddModeDefaults, ...defaultValues }
        : { ...defaultValues };
    if (values.audienceType !== "FAMILY") {
      values.memberIds =
        defaultValues?.memberIds ??
        (defaultValues?.memberId
          ? [defaultValues.memberId]
          : (values.memberIds ?? []));
      values.audienceType = "MEMBERS";
    } else {
      values.memberIds = [];
    }
    // Legacy defaults are converted above and never participate in validation.
    values.memberId = undefined;
    return values;
  }, [mode, defaultValues, getAddModeDefaults]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: initialValues,
  });

  const [showDetails, setShowDetails] = useState(false);

  // Watch values for controlled components
  const dateValue = watch("date");
  const endDateValue = watch("endDate");
  const startTimeValue = watch("startTime");
  const endTimeValue = watch("endTime");
  const audienceTypeValue = watch("audienceType");
  const memberIdsValue = watch("memberIds") ?? [];
  const isAllDayValue = watch("isAllDay");
  const recurrenceFrequency = watch("recurrenceFrequency");
  const recurrenceInterval = watch("recurrenceInterval");
  const recurrenceWeeklyDays = watch("recurrenceWeeklyDays");
  const recurrenceMonthDay = watch("recurrenceMonthDay");
  const recurrenceEndDate = watch("recurrenceEndDate");
  const descriptionValue = watch("description");
  const destinationValue = watch("destination") ?? "native";
  const googleDestination = mode === "add" && destinationValue !== "native";

  // Reset form when defaultValues change (e.g., switching between events in edit mode)
  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  // Auto-expand details if initial value has description or location content
  useEffect(() => {
    if (initialValues.description || initialValues.location) {
      setShowDetails(true);
    }
  }, [initialValues.description, initialValues.location]);

  const handleFormSubmit = (data: EventFormData) => {
    if (isPending) return;
    onSubmit(data);
  };

  const handleStartTimeChange = (time: string) => {
    const startMinutes = parseTimeToMinutes(time);
    const durationMinutes = getDurationMinutes(startTimeValue, endTimeValue);
    if (startMinutes === null) return;

    const nextEndMinutes = Math.min(
      startMinutes + durationMinutes,
      LAST_MINUTE_OF_DAY,
    );
    if (
      nextEndMinutes <= startMinutes &&
      !(googleDestination && endDateValue && endDateValue > dateValue)
    )
      return;

    setValue("startTime", time);
    setValue("endTime", formatMinutesToTime(nextEndMinutes));
  };

  const handleStartTimeNudge = (deltaMinutes: number) => {
    const startMinutes = parseTimeToMinutes(startTimeValue);
    if (startMinutes === null) return;

    // Only clamp the new start here; handleStartTimeChange re-derives the
    // duration from the same current times and applies the end-clamp + guard.
    const nextStartMinutes = Math.max(
      0,
      Math.min(startMinutes + deltaMinutes, LAST_MINUTE_OF_DAY),
    );

    handleStartTimeChange(formatMinutesToTime(nextStartMinutes));
  };

  const handleEndTimeNudge = (deltaMinutes: number) => {
    const startMinutes = parseTimeToMinutes(startTimeValue);
    const endMinutes = parseTimeToMinutes(endTimeValue);
    if (startMinutes === null || endMinutes === null) return;

    const nextEndMinutes = Math.max(
      0,
      Math.min(endMinutes + deltaMinutes, LAST_MINUTE_OF_DAY),
    );
    if (nextEndMinutes <= startMinutes) return;

    setValue("endTime", formatMinutesToTime(nextEndMinutes));
  };

  const toggleAllDay = () => {
    const next = !isAllDayValue;
    setValue("isAllDay", next);
    if (next) {
      setValue("startTime", "00:00");
      setValue("endTime", "23:59");
    } else {
      const { startTime, endTime } = getSmartDefaultTimes();
      setValue("startTime", startTime);
      setValue("endTime", endTime);
      setValue("endDate", undefined);
    }
  };

  // Convert date strings to Date objects for DatePicker display
  // Use parseLocalDate to ensure consistent local timezone handling
  const dateAsDate = dateValue ? parseLocalDate(dateValue) : undefined;
  const endDateAsDate = endDateValue ? parseLocalDate(endDateValue) : undefined;

  const isAdd = mode === "add";
  const submitText = isAdd ? "Add Event" : "Save Changes";
  const pendingText = isAdd ? "Adding..." : "Saving...";

  return (
    <form
      id="event-form"
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-4"
    >
      {/* Event Name */}
      <div className="space-y-2">
        <Label htmlFor="title">Event Name</Label>
        <Input
          id="title"
          {...register("title")}
          placeholder="Enter event name"
          className={cn("bg-input", errors.title && "border-destructive")}
          aria-invalid={!!errors.title}
        />
        <FormError message={errors.title?.message} />
      </div>

      {mode === "add" && (
        <div className="space-y-2">
          <Label htmlFor="event-destination">Save to</Label>
          <select
            id="event-destination"
            value={destinationValue}
            onChange={(event) =>
              setValue("destination", event.target.value, {
                shouldValidate: true,
              })
            }
            className="h-11 w-full rounded-lg border border-input bg-input px-3 text-sm"
          >
            <option value="native">FamilyHub only</option>
            {writeDestinations?.data.destinations.map((destination) => (
              <option
                key={destination.syncedCalendarId}
                value={`${destination.memberId}:${destination.syncedCalendarId}`}
              >
                {destination.memberName} — {destination.calendarName}
              </option>
            ))}
          </select>
          <FormError message={errors.destination?.message} />
          {writeDestinations?.data.reconnectMemberIds.length ? (
            <p className="text-sm text-muted-foreground">
              Google write permission is needed. Reconnect the account in
              Settings → member profile.
            </p>
          ) : null}
          {writeDestinations?.data.unavailableMemberIds.length ? (
            <p className="text-sm text-muted-foreground">
              Some Google calendars could not be checked. Retry later or check
              the connection in Settings.
            </p>
          ) : null}
          {destinationsError && (
            <button
              type="button"
              className="min-h-11 text-sm text-destructive underline"
              onClick={() => retryDestinations()}
            >
              Could not load Google destinations. Retry
            </button>
          )}
          {googleDestination && (
            <p className="text-xs text-muted-foreground">
              FamilyHub audience controls who sees this here; no Google
              invitations are sent.
            </p>
          )}
        </div>
      )}
      {mode === "edit" && googleBacked && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium">Save to: Google Calendar</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The destination is fixed. Saving will update Google Calendar; the
            FamilyHub audience remains local.
          </p>
        </div>
      )}

      {/* Date */}
      <div className="space-y-2">
        <Label>Date</Label>
        <DatePicker
          value={dateAsDate}
          onChange={(date) => {
            const newDate = date ? format(date, "yyyy-MM-dd") : "";
            setValue("date", newDate);
            if (endDateValue && newDate > endDateValue) {
              setValue("endDate", undefined);
            }
          }}
          placeholder="Pick a date"
          error={!!errors.date}
        />
        <FormError message={errors.date?.message} />
      </div>

      {/* Recurrence Picker */}
      {showRecurrencePicker && dateValue && (
        <RecurrencePicker
          frequency={(recurrenceFrequency as RecurrenceFrequency) ?? "none"}
          interval={recurrenceInterval ?? 1}
          weeklyDays={recurrenceWeeklyDays}
          monthDay={recurrenceMonthDay}
          endDate={recurrenceEndDate}
          eventDate={dateValue}
          onChange={(updates) => {
            setValue("recurrenceFrequency", updates.frequency);
            setValue("recurrenceInterval", updates.interval);
            setValue("recurrenceWeeklyDays", updates.weeklyDays);
            setValue("recurrenceMonthDay", updates.monthDay);
            setValue("recurrenceEndDate", updates.endDate);
          }}
        />
      )}

      {/* All Day Toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={!!isAllDayValue}
          onClick={toggleAllDay}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
            isAllDayValue ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
              isAllDayValue ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
        <Label className="cursor-pointer" onClick={toggleAllDay}>
          All day
        </Label>
      </div>

      {/* Google timed events can also cross a date boundary. */}
      {(isAllDayValue || googleDestination) && (
        <div className="space-y-2">
          <Label>End Date</Label>
          <DatePicker
            value={endDateAsDate}
            onChange={(date) => {
              setValue(
                "endDate",
                date ? format(date, "yyyy-MM-dd") : undefined,
              );
            }}
            placeholder="Same day (optional)"
            error={!!errors.endDate}
            fromDate={dateAsDate}
          />
          <FormError message={errors.endDate?.message} />
        </div>
      )}

      {/* Start/End Time */}
      {!isAllDayValue && (
        // Track sizing is driven by the space actually available, not by a
        // viewport breakpoint: the desktop dialog is capped at max-w-md, so a
        // `sm:grid-cols-2` pair only ever left the time trigger 88px — far too
        // narrow for "10:30 AM" once the -/+ buttons (44px each) and the
        // trigger's own icon and padding are subtracted, and the trigger's
        // nowrap text spilled under the adjacent + button. auto-fit keeps the
        // side-by-side pair wherever a column can hold a full time label and
        // stacks them everywhere else.
        <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="h-11 w-11 shrink-0 bg-input"
                aria-label="Start time earlier by 15 minutes"
                onClick={() => handleStartTimeNudge(-NUDGE_MINUTES)}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <TimePicker
                value={startTimeValue}
                onChange={handleStartTimeChange}
                placeholder="Start time"
                error={!!errors.startTime}
                className="h-11 min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="h-11 w-11 shrink-0 bg-input"
                aria-label="Start time later by 15 minutes"
                onClick={() => handleStartTimeNudge(NUDGE_MINUTES)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <FormError message={errors.startTime?.message} />
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="h-11 w-11 shrink-0 bg-input"
                aria-label="End time earlier by 15 minutes"
                onClick={() => handleEndTimeNudge(-NUDGE_MINUTES)}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <TimePicker
                value={endTimeValue}
                onChange={(time) => setValue("endTime", time)}
                placeholder="End time"
                error={!!errors.endTime}
                className="h-11 min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className="h-11 w-11 shrink-0 bg-input"
                aria-label="End time later by 15 minutes"
                onClick={() => handleEndTimeNudge(NUDGE_MINUTES)}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <FormError message={errors.endTime?.message} />
          </div>
        </div>
      )}

      {/* Event audience */}
      <div className="space-y-2">
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-[13px] leading-5 font-semibold">
            Who is this for?
          </legend>
          <button
            type="button"
            aria-pressed={audienceTypeValue === "FAMILY"}
            onClick={() => {
              setValue("audienceType", "FAMILY", { shouldValidate: true });
              setValue("memberIds", [], { shouldValidate: true });
            }}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm font-medium border transition-colors",
              audienceTypeValue === "FAMILY"
                ? "bg-slate-700 text-white border-slate-700"
                : "bg-muted border-border",
            )}
          >
            Everyone
          </button>
          {familyMembers.map((member) => {
            const selected =
              audienceTypeValue !== "FAMILY" &&
              memberIdsValue.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  const next = selected
                    ? memberIdsValue.filter((id) => id !== member.id)
                    : [...memberIdsValue, member.id];
                  setValue("audienceType", "MEMBERS", { shouldValidate: true });
                  setValue("memberIds", next, { shouldValidate: true });
                }}
                className={cn(
                  "min-h-11 rounded-full px-4 text-sm font-medium border transition-colors",
                  selected
                    ? `${colorMap[member.color].bg} text-white border-transparent`
                    : "bg-muted border-border",
                )}
              >
                {member.name}
              </button>
            );
          })}
        </fieldset>
        <FormError message={errors.memberIds?.message} />
      </div>

      {/* Details: Location + Description (collapsible) */}
      <div className="space-y-2">
        {!showDetails ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            Add details
          </button>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...register("location")}
                placeholder="Where?"
                className={cn(
                  "bg-input",
                  errors.location && "border-destructive",
                )}
                maxLength={255}
                aria-invalid={!!errors.location}
              />
              <FormError message={errors.location?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                {...register("description")}
                placeholder="Add notes or details..."
                className={cn(
                  "flex min-h-[88px] w-full resize-y rounded-lg border border-input bg-input px-3 py-2 text-[15px] leading-5 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  errors.description && "border-destructive",
                )}
                maxLength={2000}
                aria-invalid={!!errors.description}
              />
              {descriptionValue && descriptionValue.length > 1900 && (
                <p className="text-xs text-muted-foreground text-right">
                  {descriptionValue.length}/2000
                </p>
              )}
              <FormError message={errors.description?.message} />
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-3">
        {!hideCancelButton && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 bg-transparent"
            disabled={isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 bg-primary hover:bg-primary/90"
          disabled={isPending}
        >
          {isPending ? pendingText : submitText}
        </Button>
      </div>
    </form>
  );
}

export type { EventFormProps };
export { EventForm };
