// biome-ignore-all lint/a11y/useSemanticElements: CSS grid needs explicit ARIA table roles so rows can flex vertically.
// biome-ignore-all lint/a11y/useFocusableInteractive: ARIA table structure is descriptive, not interactive.
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useRef, useState } from "react";
import { useDuplicateMealSlot, useMoveMealSlot } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLocalDate, parseLocalDate } from "@/lib/time-utils";
import type {
  MealBoard,
  MealCollisionMode,
  MealSlot,
  MealType,
  MoveMealSlotRequest,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { MealGridCard } from "./meal-grid-card";
import type {
  MealPlanningDraft,
  MealPlanningTarget,
} from "./meal-planning-session";
import { formatMealType, mealTypeRailClasses } from "./meal-type-utils";

function shortWeekday(date: string) {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "short",
  });
}

function fullWeekday(date: string) {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

const MEAL_ROWS: Array<MealSlot["mealType"]> = ["breakfast", "lunch", "dinner"];

// One shared column template so header and body rows always align.
const GRID_COLS = "grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))]";

type SlotTarget = { dayIndex: number; mealType: MealType };
type PendingDrop = { source: SlotTarget; destination: SlotTarget };
type DropAction = "move" | "copy";

function slotKey(target: SlotTarget) {
  return `${target.dayIndex}:${target.mealType}`;
}

function findSlot(board: MealBoard, target: SlotTarget) {
  return board.days
    .find((day) => day.dayIndex === target.dayIndex)
    ?.slots.find((slot) => slot.mealType === target.mealType);
}

function MealDropCell({
  slot,
  enabled,
  children,
  className,
}: {
  slot: MealSlot;
  enabled: boolean;
  children: React.ReactNode;
  className: string;
}) {
  const { active } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({
    id: `meal-target:${slotKey(slot)}`,
    disabled: !enabled,
  });
  const isSource = active?.id === `meal-source:${slotKey(slot)}`;

  return (
    <div
      ref={setNodeRef}
      role="cell"
      className={cn(
        className,
        active && !isSource && enabled
          ? "bg-primary/5 ring-1 ring-inset ring-primary/40"
          : null,
        isOver && !isSource
          ? "bg-primary/15 ring-2 ring-inset ring-primary"
          : null,
      )}
    >
      {children}
    </div>
  );
}

interface MealGridProps {
  board: MealBoard;
  readOnly: boolean;
  dragDisabled?: boolean;
  pendingRecipeId?: string | null;
  planningDrafts?: MealPlanningDraft[];
  planningTarget?: MealPlanningTarget | null;
  onSelectSlot: (slot: MealSlot) => void;
}

// ARIA table semantics are attached explicitly: real <table> rows cannot
// stretch to share viewport height, a flex column of CSS grids can.
export function MealGrid({
  board,
  readOnly,
  dragDisabled = false,
  pendingRecipeId = null,
  planningDrafts = [],
  planningTarget = null,
  onSelectSlot,
}: MealGridProps) {
  const todayIso = formatLocalDate(new Date());
  const dragEnabled =
    !readOnly &&
    !dragDisabled &&
    !pendingRecipeId &&
    planningDrafts.length === 0 &&
    !planningTarget;
  const [activeSource, setActiveSource] = useState<SlotTarget | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const [chosenAction, setChosenAction] = useState<DropAction | null>(null);
  const suppressClick = useRef(false);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
  );
  const moveSlot = useMoveMealSlot({ onSuccess: () => clearDrop() });
  const duplicateSlot = useDuplicateMealSlot({ onSuccess: () => clearDrop() });
  const isPending = moveSlot.isPending || duplicateSlot.isPending;
  const mutationError = moveSlot.error ?? duplicateSlot.error;

  function clearDrop() {
    setPendingDrop(null);
    setChosenAction(null);
    moveSlot.reset();
    duplicateSlot.reset();
  }

  function targetFromId(id: string, prefix: string): SlotTarget | null {
    if (!id.startsWith(prefix)) return null;
    const [dayIndex, mealType] = id.slice(prefix.length).split(":");
    if (!/^[0-6]$/.test(dayIndex) || !MEAL_ROWS.includes(mealType as MealType))
      return null;
    return { dayIndex: Number(dayIndex), mealType: mealType as MealType };
  }

  function finishDrag(event: DragEndEvent) {
    setActiveSource(null);
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    if (!dragEnabled || isPending) return;
    const source = targetFromId(String(event.active.id), "meal-source:");
    const destination = event.over
      ? targetFromId(String(event.over.id), "meal-target:")
      : null;
    if (!source || !destination || slotKey(source) === slotKey(destination))
      return;
    if (!findSlot(board, source)?.primary || !findSlot(board, destination))
      return;
    clearDrop();
    setPendingDrop({ source, destination });
  }

  function submit(action: DropAction, collisionMode: MealCollisionMode) {
    if (!pendingDrop || readOnly || isPending) return;
    if (
      !findSlot(board, pendingDrop.source)?.primary ||
      !findSlot(board, pendingDrop.destination)
    ) {
      clearDrop();
      return;
    }
    const request: MoveMealSlotRequest = {
      sourceWeekStartDate: board.weekStartDate,
      sourceDayIndex: pendingDrop.source.dayIndex,
      sourceMealType: pendingDrop.source.mealType,
      destinationWeekStartDate: board.weekStartDate,
      destinationDayIndex: pendingDrop.destination.dayIndex,
      destinationMealType: pendingDrop.destination.mealType,
      collisionMode,
    };
    if (action === "move") moveSlot.mutate(request);
    else duplicateSlot.mutate(request);
  }

  function chooseAction(action: DropAction) {
    if (!pendingDrop) return;
    setChosenAction(action);
    const destination = findSlot(board, pendingDrop.destination);
    if (!destination?.primary && !destination?.extras.length) {
      submit(action, "replace_primary");
    }
  }

  const destination = pendingDrop
    ? findSlot(board, pendingDrop.destination)
    : null;
  const hasCollision = Boolean(
    destination?.primary || destination?.extras.length,
  );
  const sourceTitle = activeSource
    ? findSlot(board, activeSource)?.primary?.title
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(event) => {
        setActiveSource(targetFromId(String(event.active.id), "meal-source:"));
      }}
      onDragEnd={finishDrag}
      onDragCancel={() => setActiveSource(null)}
    >
      <div
        role="table"
        aria-label="Weekly meals"
        className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border"
      >
        <div role="rowgroup">
          <div role="row" className={GRID_COLS}>
            <div
              role="columnheader"
              className="border-b border-r border-border bg-muted/40"
            />
            {board.days.map((day) => {
              const isToday = day.date === todayIso;

              return (
                <div
                  key={day.date}
                  role="columnheader"
                  aria-label={fullWeekday(day.date)}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "border-b border-r border-border p-2 text-center text-sm font-semibold text-foreground last:border-r-0",
                    isToday ? "bg-primary/10" : "bg-muted/40",
                  )}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <span
                      className={cn(
                        "text-xs font-semibold uppercase",
                        isToday ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {shortWeekday(day.date)}
                    </span>
                    <span
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {parseLocalDate(day.date).getDate()}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div role="rowgroup" className="flex flex-1 flex-col">
          {MEAL_ROWS.map((mealType) => (
            <div
              key={mealType}
              role="row"
              className={cn(
                GRID_COLS,
                "min-h-[170px] flex-1 [&:last-child>*]:border-b-0",
              )}
            >
              <div
                role="rowheader"
                className="flex items-center justify-center border-b border-r border-border bg-muted/30"
              >
                <span
                  className={cn(
                    "rotate-180 text-xs font-semibold uppercase tracking-widest [writing-mode:vertical-rl]",
                    mealTypeRailClasses(mealType),
                  )}
                >
                  {formatMealType(mealType)}
                </span>
              </div>
              {board.days.map((day) => {
                const slot = day.slots.find(
                  (candidate) => candidate.mealType === mealType,
                );
                if (!slot) return null;

                return (
                  // [contain:size]: the cell must take its height from the grid
                  // row (flex-distributed, floored at 170px) rather than its
                  // content. Without it the implicit auto row grows to the
                  // tallest card, breaking the equal-height fill and the row
                  // floor; align-content: stretch (the default) then re-expands
                  // the size-contained track to the row height. Don't remove it.
                  <MealDropCell
                    key={`${day.date}-${mealType}`}
                    slot={slot}
                    enabled={dragEnabled}
                    className={cn(
                      "[contain:size] border-b border-r border-border p-2 last:border-r-0",
                      day.date === todayIso ? "bg-primary/5" : null,
                    )}
                  >
                    <MealGridCard
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
                      dayLabel={fullWeekday(day.date)}
                      dragEnabled={dragEnabled}
                      onSelectSlot={(selected) => {
                        if (!suppressClick.current) onSelectSlot(selected);
                      }}
                    />
                  </MealDropCell>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {sourceTitle ? (
          <div className="rounded-lg border-2 border-primary bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-xl">
            {sourceTitle}
          </div>
        ) : null}
      </DragOverlay>
      <Dialog
        open={pendingDrop !== null && (!chosenAction || !hasCollision)}
        onOpenChange={(open) => {
          if (!open && !isPending) clearDrop();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move or copy meal?</DialogTitle>
            <DialogDescription>
              Choose what to do with this meal in the selected slot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={isPending}
              onClick={clearDrop}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isPending}
              onClick={() => chooseAction("copy")}
            >
              Copy
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={isPending}
              onClick={() => chooseAction("move")}
            >
              Move
            </Button>
          </DialogFooter>
          {mutationError ? (
            <p role="alert" className="text-sm text-destructive">
              {mutationError.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog
        open={pendingDrop !== null && chosenAction !== null && hasCollision}
        onOpenChange={(open) => {
          if (!open && !isPending) clearDrop();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>That slot already has a meal</DialogTitle>
            <DialogDescription>
              Choose whether to replace the primary meal or add this meal as an
              extra.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={isPending}
              onClick={clearDrop}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isPending}
              onClick={() => {
                if (chosenAction) submit(chosenAction, "add_as_extra");
              }}
            >
              Add as extra
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={isPending}
              onClick={() => {
                if (chosenAction) submit(chosenAction, "replace_primary");
              }}
            >
              Replace primary
            </Button>
          </DialogFooter>
          {mutationError ? (
            <p role="alert" className="text-sm text-destructive">
              {mutationError.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
