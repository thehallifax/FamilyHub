import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLocalDate, parseLocalDate } from "@/lib/time-utils";
import type { MealDay, MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";
import type {
  MealPlanningDraft,
  MealPlanningTarget,
} from "./meal-planning-session";
import { MealSlotCard } from "./meal-slot-card";
import { formatMealType } from "./meal-type-utils";

function formatDayLabel(date: string) {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

interface MealDayCardProps {
  day: MealDay;
  readOnly: boolean;
  pendingRecipeId?: string | null;
  planningDrafts?: MealPlanningDraft[];
  planningTarget?: MealPlanningTarget | null;
  onSelectSlot: (slot: MealSlot) => void;
}

export function MealDayCard({
  day,
  readOnly,
  pendingRecipeId = null,
  planningDrafts = [],
  planningTarget = null,
  onSelectSlot,
}: MealDayCardProps) {
  const [isMealTypePickerOpen, setIsMealTypePickerOpen] = useState(false);
  const isToday = day.date === formatLocalDate(new Date());
  const headingId = `meal-day-${day.date}`;
  const dayLabel = formatDayLabel(day.date);
  const visibleSlots = day.slots.filter((slot) => {
    const hasDraft = planningDrafts.some(
      (draft) =>
        draft.target.dayIndex === slot.dayIndex &&
        draft.target.mealType === slot.mealType,
    );
    const isTarget =
      planningTarget?.dayIndex === slot.dayIndex &&
      planningTarget.mealType === slot.mealType;

    return Boolean(
      slot.primary || slot.extras.length > 0 || hasDraft || isTarget,
    );
  });

  function selectMealType(slot: MealSlot) {
    setIsMealTypePickerOpen(false);
    onSelectSlot(slot);
  }

  return (
    <>
      <section
        aria-labelledby={headingId}
        aria-current={isToday ? "date" : undefined}
        className={cn(
          "space-y-2 rounded-lg border p-3",
          isToday
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card/60",
        )}
      >
        <h2 id={headingId} className="text-base font-semibold text-foreground">
          {dayLabel}
        </h2>
        {visibleSlots.length > 0 ? (
          <div className="space-y-2">
            {visibleSlots.map((slot) => (
              <MealSlotCard
                key={slot.mealType}
                slot={slot}
                readOnly={readOnly}
                pendingRecipeId={pendingRecipeId}
                draft={
                  planningDrafts.find(
                    (draft) =>
                      draft.target.dayIndex === slot.dayIndex &&
                      draft.target.mealType === slot.mealType,
                  ) ?? null
                }
                isPlanningTarget={
                  planningTarget?.dayIndex === slot.dayIndex &&
                  planningTarget.mealType === slot.mealType
                }
                onSelectSlot={onSelectSlot}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No meals planned</p>
        )}

        {!readOnly && day.slots.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full border-dashed"
            aria-label={`Add meal, ${dayLabel}`}
            onClick={() => setIsMealTypePickerOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add meal
          </Button>
        ) : null}
      </section>

      <Dialog
        open={isMealTypePickerOpen}
        onOpenChange={setIsMealTypePickerOpen}
      >
        <DialogContent>
          <DialogHeader onClose={() => setIsMealTypePickerOpen(false)}>
            <DialogTitle>Add meal to {dayLabel}</DialogTitle>
          </DialogHeader>
          <DialogDescription>Choose a meal type to continue.</DialogDescription>
          <div className="mt-4 grid gap-2">
            {day.slots.map((slot) => {
              const mealType = formatMealType(slot.mealType);
              const hasMeal = Boolean(slot.primary || slot.extras.length > 0);
              const action = pendingRecipeId ? "Add recipe to" : "Add";

              return (
                <Button
                  key={slot.mealType}
                  type="button"
                  variant="outline"
                  className="min-h-12 justify-between px-4"
                  aria-label={`${action} ${slot.mealType}, ${dayLabel}`}
                  onClick={() => selectMealType(slot)}
                >
                  <span>{mealType}</span>
                  {hasMeal ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      Meal planned
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
