import { z } from "zod";
import { formatLocalDate, parseLocalDate } from "@/lib/time-utils";

export const choreFormSchema = z
  .object({
    title: z
      .string()
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, "Chore name is required")
          .max(100, "Chore name must be 100 characters or less"),
      ),
    assignedToMemberId: z.string().min(1, "Assignee is required"),
    cadence: z.enum(["DAILY", "WEEKLY", "FORTNIGHTLY", "MONTHLY"], {
      message: "Cadence is required",
    }),
    dueWeekday: z
      .enum([
        "SUNDAY",
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ])
      .nullable()
      .optional(),
    dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    recurrenceAnchorDate: z.string().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      (value.cadence !== "WEEKLY" &&
        value.cadence !== "FORTNIGHTLY" &&
        value.dueWeekday) ||
      (value.cadence !== "MONTHLY" && value.dueDayOfMonth) ||
      (value.cadence !== "FORTNIGHTLY" && value.recurrenceAnchorDate)
    ) {
      context.addIssue({
        code: "custom",
        message: "Schedule does not match cadence",
        path: ["cadence"],
      });
    }
    if (value.cadence === "FORTNIGHTLY") {
      if (!value.dueWeekday) {
        context.addIssue({
          code: "custom",
          message: "Choose a weekday",
          path: ["dueWeekday"],
        });
      }
      if (!value.recurrenceAnchorDate) {
        context.addIssue({
          code: "custom",
          message: "Choose a starting date",
          path: ["recurrenceAnchorDate"],
        });
      } else {
        const date = parseLocalDate(value.recurrenceAnchorDate);
        if (
          !Number.isFinite(date.getTime()) ||
          formatLocalDate(date) !== value.recurrenceAnchorDate
        ) {
          context.addIssue({
            code: "custom",
            message: "Choose a valid starting date",
            path: ["recurrenceAnchorDate"],
          });
        } else if (
          value.dueWeekday &&
          date
            .toLocaleDateString("en-US", { weekday: "long" })
            .toUpperCase() !== value.dueWeekday
        ) {
          context.addIssue({
            code: "custom",
            message: "Starting date must match the due day",
            path: ["recurrenceAnchorDate"],
          });
        }
      }
    }
  });

export type ChoreFormInput = z.input<typeof choreFormSchema>;
export type ChoreFormData = z.output<typeof choreFormSchema>;
