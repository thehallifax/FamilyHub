import { z } from "zod";

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
    cadence: z.enum(["DAILY", "WEEKLY", "MONTHLY"], {
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
  })
  .superRefine((value, context) => {
    if (
      (value.cadence !== "WEEKLY" && value.dueWeekday) ||
      (value.cadence !== "MONTHLY" && value.dueDayOfMonth)
    ) {
      context.addIssue({
        code: "custom",
        message: "Schedule does not match cadence",
        path: ["cadence"],
      });
    }
  });

export type ChoreFormInput = z.input<typeof choreFormSchema>;
export type ChoreFormData = z.output<typeof choreFormSchema>;
