import { subDays } from "date-fns";
import { formatLocalDate, parseLocalDate } from "@/lib/time-utils";
import type { EnergyConnection, EnergyObservation } from "./energy-api";

export function siteDay(instant: string | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof instant === "string" ? new Date(instant) : instant);
  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function latestDailySnapshots(
  rows: EnergyObservation[],
  siteId: number,
  timezone: string,
  days: number,
  now: Date,
) {
  const today = siteDay(now, timezone);
  const first = formatLocalDate(subDays(parseLocalDate(today), days - 1));
  const selected = new Map<string, EnergyObservation>();
  for (const row of rows) {
    if (
      row.siteId !== siteId ||
      row.siteTimezone !== timezone ||
      row.measurementKind !== "DAILY_CUMULATIVE"
    )
      continue;
    const day = siteDay(row.periodStart, timezone);
    if (day < first || day > today) continue;
    const previous = selected.get(day);
    if (
      !previous ||
      Date.parse(row.periodEnd) > Date.parse(previous.periodEnd) ||
      (row.periodEnd === previous.periodEnd &&
        Date.parse(row.collectedAt) > Date.parse(previous.collectedAt))
    )
      selected.set(day, row);
  }
  return [...selected.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export function energyValue(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? "Unavailable"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh`;
}

export function connectionLabel(connection: EnergyConnection): string {
  if (!connection.configured) return "Not configured";
  if (
    connection.status === "REAUTHORISATION_REQUIRED" ||
    connection.status === "REFRESHING"
  )
    return "Reauthorisation or recovery required";
  if (
    connection.lastOutcome === "PERMISSION_DENIED" ||
    connection.errorCode === "PERMISSION_DENIED"
  )
    return "Permission or configuration error";
  if (connection.lastOutcome === "BUDGET_EXHAUSTED")
    return "API budget exhausted";
  if (connection.lastOutcome === "PROVIDER_QUOTA_CONFIRMED")
    return "Provider quota paused";
  if (connection.lastOutcome === "PROVIDER_THROTTLED")
    return "Provider backoff or recent rate limit";
  if (connection.lastOutcome === "COLLECTING") return "Collecting";
  if (!connection.collectionEnabled) return "Collection paused";
  if (connection.status === "TEMPORARY_ERROR") return "Temporarily unavailable";
  if (connection.status === "DISCONNECTED") return "Disconnected";
  if (connection.status === "CONFIGURED") return "Awaiting first collection";
  return "Connected";
}

export function freshness(
  timestamp: string | null,
  now: Date,
  interval: number | null,
): string {
  if (!timestamp) return "No successful collection yet";
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(timestamp)) / 60_000),
  );
  if (!Number.isFinite(minutes)) return "Collection time unavailable";
  const age =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : `${Math.floor(minutes / 60)} hr ago`;
  return `Last collected ${age}${minutes > (interval ?? 30) * 2 ? " · may be stale" : ""}`;
}
