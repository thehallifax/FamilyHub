import { describe, expect, it } from "vitest";
import {
  eventAppliesTo,
  eventAudienceLabel,
  eventColors,
  eventMatchesMembers,
} from "./event-audience";
import type { CalendarEvent, FamilyMember } from "./types";

const members = [
  { id: "james", name: "James", color: "coral" },
  { id: "kate", name: "Kathryn", color: "teal" },
  { id: "child", name: "Child", color: "pink" },
] as FamilyMember[];

const base = {
  id: "event",
  title: "Event",
  date: new Date(2025, 5, 15),
  startTime: "9:00 AM",
  endTime: "10:00 AM",
  isAllDay: false,
  memberId: "james",
} as CalendarEvent;

describe("calendar event audience", () => {
  it("FAMILY applies to every current or future member without a member snapshot", () => {
    const event = {
      ...base,
      memberId: "",
      audienceType: "FAMILY" as const,
      memberIds: [],
    };
    expect(eventAppliesTo(event, "new-member")).toBe(true);
    expect(eventMatchesMembers(event, ["kate"])).toBe(true);
    expect(eventAudienceLabel(event, members)).toBe("Everyone");
    expect(eventColors(event, members).hex).toBe("#475569");
  });

  it("a shared event matches either selected person once, not an unrelated person", () => {
    const event = {
      ...base,
      memberId: "",
      audienceType: "MEMBERS" as const,
      memberIds: ["james", "kate"],
    };
    expect(eventMatchesMembers(event, ["james"])).toBe(true);
    expect(eventMatchesMembers(event, ["kate"])).toBe(true);
    expect(eventMatchesMembers(event, ["james", "kate"])).toBe(true);
    expect(eventMatchesMembers(event, ["child"])).toBe(false);
    expect(eventAudienceLabel(event, members)).toBe("James + Kathryn");
    expect(eventColors(event, members).hex).toBe("#475569");
  });

  it("a sole member retains their colour and legacy fixtures remain supported", () => {
    expect(eventColors(base, members).hex).toBe("#b95443");
    expect(eventMatchesMembers(base, ["james"])).toBe(true);
    expect(eventAudienceLabel(base, members)).toBe("James");
  });
});
