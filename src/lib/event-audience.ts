import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { colorMap, getFamilyMember } from "@/lib/types";

/** Single source of truth for membership, including old single-member test data. */
export function eventMemberIds(event: CalendarEvent): string[] {
  if (event.audienceType === "FAMILY") return [];
  return event.memberIds ?? (event.memberId ? [event.memberId] : []);
}

export function eventAppliesTo(
  event: CalendarEvent,
  memberId: string,
): boolean {
  return (
    event.audienceType === "FAMILY" || eventMemberIds(event).includes(memberId)
  );
}

export function eventMatchesMembers(
  event: CalendarEvent,
  selected: string[],
): boolean {
  if (selected.length === 0) return false;
  return (
    event.audienceType === "FAMILY" ||
    selected.some((id) => eventAppliesTo(event, id))
  );
}

export function eventAudienceLabel(
  event: CalendarEvent,
  members: FamilyMember[],
): string {
  if (event.audienceType === "FAMILY") return "Everyone";
  const names = eventMemberIds(event).map(
    (id) => getFamilyMember(members, id)?.name ?? "Unknown member",
  );
  return names.join(" + ");
}

/** Shared events use a neutral slate treatment, never a person's colour. */
export function eventColors(event: CalendarEvent, members: FamilyMember[]) {
  const ids = eventMemberIds(event);
  const member =
    event.audienceType !== "FAMILY" && ids.length === 1
      ? getFamilyMember(members, ids[0])
      : undefined;
  return member
    ? colorMap[member.color]
    : {
        bg: "bg-slate-600",
        light: "bg-slate-100",
        text: "text-slate-800",
        border: "border-slate-400",
        hex: "#475569",
      };
}
