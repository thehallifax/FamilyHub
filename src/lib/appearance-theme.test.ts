import { eventColors } from "@/lib/event-audience";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { applyAppearanceAccent } from "./appearance-theme";

it("applies household accent without changing semantic member or shared event colours", () => {
  const members: FamilyMember[] = [{ id: "one", name: "One", color: "teal" }];
  const event = {
    audienceType: "MEMBERS",
    memberIds: ["one"],
  } as CalendarEvent;
  const before = eventColors(event, members);
  applyAppearanceAccent("ROSE");
  expect(document.documentElement.dataset.familyhubAccent).toBe("rose");
  expect(eventColors(event, members)).toEqual(before);
  expect(
    eventColors({ ...event, audienceType: "FAMILY", memberIds: [] }, members)
      .bg,
  ).toBe("bg-slate-600");
  applyAppearanceAccent("PURPLE");
  expect(document.documentElement.dataset.familyhubAccent).toBeUndefined();
});
