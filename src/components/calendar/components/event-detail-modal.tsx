import { format } from "date-fns";
import {
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useFamilyMembers } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBackHandler, useIsMobile } from "@/hooks";
import { eventAudienceLabel, eventColors } from "@/lib/event-audience";
import { formatRecurrenceLabel } from "@/lib/recurrence-utils";
import type { CalendarEvent } from "@/lib/types";
import { getFamilyMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MobileEventDetail } from "./mobile-event-detail";

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
  deleteError?: string | null;
  canDeleteGoogleEvent?: boolean;
  canEditGoogleEvent?: boolean;
}

function EventDetailModal({
  event,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  isDeleting = false,
  deleteError,
  canDeleteGoogleEvent = false,
  canEditGoogleEvent = false,
}: EventDetailModalProps) {
  const isMobile = useIsMobile();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const familyMembers = useFamilyMembers();
  useBackHandler(isOpen, onClose);

  // Reset confirmation state when modal closes or event changes
  useEffect(() => {
    if (!isOpen) {
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  if (!event) return null;

  const isGoogleEvent = event.source === "GOOGLE";

  const handleEditClick = () => {
    if (isGoogleEvent) {
      if (!canEditGoogleEvent) return;
    }
    onEdit();
  };

  const member = event.memberId
    ? getFamilyMember(familyMembers, event.memberId)
    : undefined;
  const colors = eventColors(event, familyMembers);
  const audienceLabel = eventAudienceLabel(event, familyMembers);

  if (isMobile) {
    return (
      <MobileEventDetail
        event={event}
        member={member}
        audienceLabel={audienceLabel}
        colors={colors}
        isOpen={isOpen}
        onClose={onClose}
        onEdit={onEdit}
        onDelete={onDelete}
        isDeleting={isDeleting}
        deleteError={deleteError}
        canDeleteGoogleEvent={canDeleteGoogleEvent}
        canEditGoogleEvent={canEditGoogleEvent}
      />
    );
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteAttempt = () => {
    handleDeleteClick();
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleConfirmDelete = () => {
    onDelete();
  };

  // Format date for display — multi-day shows range, single-day shows full date
  const formattedDate = event.endDate
    ? event.date.getFullYear() !== event.endDate.getFullYear()
      ? `${format(event.date, "MMMM d, yyyy")} – ${format(event.endDate, "MMMM d, yyyy")}`
      : `${format(event.date, "MMMM d")} – ${format(event.endDate, "MMMM d, yyyy")}`
    : format(event.date, "EEEE, MMMM d, yyyy");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader onClose={onClose}>
          <DialogTitle className="pr-8 truncate">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Member badge */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0",
                colors?.bg || "bg-muted-foreground",
              )}
            >
              {audienceLabel.charAt(0)}
            </div>
            <span className="font-medium text-foreground">{audienceLabel}</span>
          </div>

          {/* Event details */}
          <div className="space-y-3 text-sm">
            {/* Date */}
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>{formattedDate}</span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              {event.isAllDay ? (
                <span className="px-2 py-0.5 bg-muted rounded text-xs font-medium">
                  All day
                </span>
              ) : (
                <span>
                  {event.startTime} – {event.endTime}
                </span>
              )}
            </div>

            {/* Recurrence (conditional) */}
            {event.isRecurring && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Repeat className="w-4 h-4 shrink-0" />
                <span>
                  {event.recurrenceRule
                    ? formatRecurrenceLabel(event.recurrenceRule, event.date)
                    : "Recurring event"}
                </span>
              </div>
            )}

            {/* Location (conditional) */}
            {event.location && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {/* Description (conditional) */}
            {event.description && (
              <div className="flex items-start gap-3 text-muted-foreground">
                <FileText className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-sm whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}

            {/* Open in Google Calendar (conditional) */}
            {isGoogleEvent && event.htmlLink && (
              <div className="flex items-center gap-3">
                <ExternalLink className="w-4 h-4 shrink-0 text-muted-foreground" />
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open in Google Calendar
                </a>
              </div>
            )}
            {isGoogleEvent && event.isRecurring && canEditGoogleEvent && (
              <p className="text-sm text-muted-foreground">
                Editing lets you choose this event or the entire series.
              </p>
            )}
            {isGoogleEvent && !canEditGoogleEvent && (
              <p className="text-sm text-muted-foreground">
                This Google event is read-only in FamilyHub.
              </p>
            )}
          </div>

          {/* Error message */}
          {deleteError && (
            <div className="text-destructive text-sm text-center py-2">
              {deleteError}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-3">
          {showDeleteConfirm ? (
            <>
              <p className="text-sm text-muted-foreground text-center w-full">
                {isGoogleEvent
                  ? "This will delete the event from Google Calendar and FamilyHub."
                  : "Are you sure you want to delete this event?"}
              </p>
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                  className="flex-1 min-h-[48px]"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 min-h-[48px]"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Event"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={handleEditClick}
                disabled={isDeleting || (isGoogleEvent && !canEditGoogleEvent)}
                className="flex-1 min-h-[48px]"
              >
                <Pencil className="w-4 h-4 mr-2" />
                {isGoogleEvent && !canEditGoogleEvent
                  ? "Edit unavailable"
                  : "Edit"}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAttempt}
                disabled={
                  isDeleting ||
                  (isGoogleEvent &&
                    (!canDeleteGoogleEvent || Boolean(event.isRecurring)))
                }
                className="flex-1 min-h-[48px]"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { EventDetailModalProps };
export { EventDetailModal };
