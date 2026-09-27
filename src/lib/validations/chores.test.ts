import { describe, expect, it } from "vitest";
import { choreFormSchema } from "./chores";

describe("choreFormSchema", () => {
  it("requires a valid due date only for one-off chores", () => {
    expect(
      choreFormSchema.safeParse({
        title: "Renew passport",
        assignedToMemberId: "member-1",
        cadence: "ONE_OFF",
        dueWeekday: null,
        dueDayOfMonth: null,
        recurrenceAnchorDate: null,
        oneOffDueDate: null,
      }).success,
    ).toBe(false);
    expect(
      choreFormSchema.safeParse({
        title: "Renew passport",
        assignedToMemberId: "member-1",
        cadence: "ONE_OFF",
        dueWeekday: null,
        dueDayOfMonth: null,
        recurrenceAnchorDate: null,
        oneOffDueDate: "2026-10-12",
      }).success,
    ).toBe(true);
    expect(
      choreFormSchema.safeParse({
        title: "Renew passport",
        assignedToMemberId: "member-1",
        cadence: "ONE_OFF",
        dueWeekday: "MONDAY",
        oneOffDueDate: "2026-10-12",
      }).success,
    ).toBe(false);
  });
  it("requires title, assignee, and cadence", () => {
    const result = choreFormSchema.safeParse({
      title: "",
      assignedToMemberId: "",
      cadence: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["title", "assignedToMemberId", "cadence"]),
      );
    }
  });

  it("trims title and preserves recurring template cadence", () => {
    const result = choreFormSchema.safeParse({
      title: "  Take out trash  ",
      assignedToMemberId: "member-1",
      cadence: "WEEKLY",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Take out trash",
        assignedToMemberId: "member-1",
        cadence: "WEEKLY",
      });
    }
  });

  it("rejects unsupported cadences", () => {
    const result = choreFormSchema.safeParse({
      title: "Take out trash",
      assignedToMemberId: "member-1",
      cadence: "YEARLY",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["cadence"]);
    }
  });
});
