import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useFamilyMembers } from "@/api";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberSelector } from "@/components/ui/member-selector";
import type { ChoreCadence, ChoreWeekday } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  type ChoreFormData,
  type ChoreFormInput,
  choreFormSchema,
} from "@/lib/validations";

interface ChoreFormProps {
  defaultValues?: Partial<ChoreFormInput>;
  isEditing?: boolean;
  onSubmit: (data: ChoreFormData) => void;
  onCancel: () => void;
  isPending?: boolean;
  hideCancelButton?: boolean;
}

export function ChoreForm({
  defaultValues,
  isEditing = false,
  onSubmit,
  onCancel,
  isPending = false,
  hideCancelButton = false,
}: ChoreFormProps) {
  const familyMembers = useFamilyMembers();
  const defaultTitle = defaultValues?.title;
  const defaultAssignedToMemberId = defaultValues?.assignedToMemberId;
  const defaultCadence = defaultValues?.cadence;
  const defaultDueWeekday = defaultValues?.dueWeekday;
  const defaultDueDayOfMonth = defaultValues?.dueDayOfMonth;
  const [cadenceChanged, setCadenceChanged] = useState(false);

  const initialValues = useMemo(
    (): Partial<ChoreFormInput> => ({
      title: defaultTitle ?? "",
      assignedToMemberId:
        defaultAssignedToMemberId ?? familyMembers[0]?.id ?? "",
      cadence: defaultCadence ?? "DAILY",
      dueWeekday: defaultDueWeekday ?? null,
      dueDayOfMonth: defaultDueDayOfMonth ?? null,
    }),
    [
      defaultTitle,
      defaultAssignedToMemberId,
      defaultCadence,
      defaultDueWeekday,
      defaultDueDayOfMonth,
      familyMembers,
    ],
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChoreFormInput, undefined, ChoreFormData>({
    resolver: zodResolver(choreFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const assignedToMemberId = watch("assignedToMemberId") ?? "";
  const cadence = watch("cadence") ?? "DAILY";
  const dueWeekday = watch("dueWeekday");
  const dueDayOfMonth = watch("dueDayOfMonth");
  const canPreserveLegacyWeek =
    isEditing &&
    !cadenceChanged &&
    defaultCadence === "WEEKLY" &&
    defaultDueWeekday == null;
  const canPreserveLegacyMonth =
    isEditing &&
    !cadenceChanged &&
    defaultCadence === "MONTHLY" &&
    defaultDueDayOfMonth == null;

  const handleFormSubmit = (data: ChoreFormData) => {
    if (isPending) return;
    if (
      data.cadence === "WEEKLY" &&
      !data.dueWeekday &&
      !canPreserveLegacyWeek
    ) {
      setError("dueWeekday", { type: "manual", message: "Choose a weekday" });
      return;
    }
    if (
      data.cadence === "MONTHLY" &&
      !data.dueDayOfMonth &&
      !canPreserveLegacyMonth
    ) {
      setError("dueDayOfMonth", {
        type: "manual",
        message: "Choose a day of month",
      });
      return;
    }
    onSubmit(data);
  };

  const cadenceOptions: Array<{ value: ChoreCadence; label: string }> = [
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "MONTHLY", label: "Monthly" },
  ];

  return (
    <form
      id="chore-form"
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="chore-title">Chore Name</Label>
        <Input
          id="chore-title"
          {...register("title")}
          placeholder="What needs doing?"
          className={cn("bg-input", errors.title && "border-destructive")}
          aria-invalid={!!errors.title}
        />
        <FormError message={errors.title?.message} />
      </div>

      <div className="space-y-2">
        <Label>Assign To</Label>
        <MemberSelector
          members={familyMembers}
          value={assignedToMemberId}
          onChange={(memberId) =>
            setValue("assignedToMemberId", memberId, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          error={!!errors.assignedToMemberId}
        />
        <FormError message={errors.assignedToMemberId?.message} />
      </div>

      <div className="space-y-2">
        <Label>Repeats</Label>
        <div className="grid grid-cols-3 gap-2">
          {cadenceOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={cadence === option.value ? "default" : "outline"}
              aria-pressed={cadence === option.value}
              onClick={() => {
                if (cadence !== option.value) {
                  setCadenceChanged(true);
                  setValue("dueWeekday", null);
                  setValue("dueDayOfMonth", null);
                  clearErrors(["dueWeekday", "dueDayOfMonth"]);
                }
                setValue("cadence", option.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
              className="min-w-0"
            >
              {option.label}
            </Button>
          ))}
        </div>
        <FormError message={errors.cadence?.message} />
      </div>

      {cadence === "WEEKLY" && (
        <div className="space-y-2">
          <Label>Due day</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                "SUNDAY",
                "MONDAY",
                "TUESDAY",
                "WEDNESDAY",
                "THURSDAY",
                "FRIDAY",
                "SATURDAY",
              ] as ChoreWeekday[]
            ).map((day) => (
              <Button
                key={day}
                type="button"
                variant={dueWeekday === day ? "default" : "outline"}
                aria-pressed={dueWeekday === day}
                onClick={() =>
                  setValue("dueWeekday", day, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {day.charAt(0) + day.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
          {canPreserveLegacyWeek && !dueWeekday && (
            <p className="text-sm text-muted-foreground">
              Currently: Any day this week. Choose a weekday to schedule it.
            </p>
          )}
          <FormError message={errors.dueWeekday?.message} />
        </div>
      )}
      {cadence === "MONTHLY" && (
        <div className="space-y-2">
          <Label>Due day of month</Label>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
            {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
              <Button
                key={day}
                type="button"
                variant={dueDayOfMonth === day ? "default" : "outline"}
                aria-label={`Day ${day}`}
                aria-pressed={dueDayOfMonth === day}
                onClick={() =>
                  setValue("dueDayOfMonth", day, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {day}
              </Button>
            ))}
          </div>
          {canPreserveLegacyMonth && !dueDayOfMonth && (
            <p className="text-sm text-muted-foreground">
              Currently: Any day this month. Choose a day to schedule it.
            </p>
          )}
          <FormError message={errors.dueDayOfMonth?.message} />
          <p className="text-xs text-muted-foreground">
            Days beyond month end are due on the last day of that month.
          </p>
        </div>
      )}

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
          {isPending ? "Saving..." : "Save Chore"}
        </Button>
      </div>
    </form>
  );
}

export type { ChoreFormProps };
