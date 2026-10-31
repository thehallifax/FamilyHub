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
      row.measurementKind !== "DAILY_CUMULATIVE" ||
      !Number.isFinite(Date.parse(row.periodStart)) ||
      !Number.isFinite(Date.parse(row.periodEnd)) ||
      !Number.isFinite(Date.parse(row.collectedAt)) ||
      Date.parse(row.periodEnd) <= Date.parse(row.periodStart) ||
      ![row.productionKwh, row.consumptionKwh].some(
        (value) => value != null && Number.isFinite(value) && value >= 0,
      )
    )
      continue;
    const day = siteDay(row.periodStart, timezone);
    if (day < first || day > today) continue;
    const previous = selected.get(day);
    if (
      !previous ||
      Date.parse(row.periodEnd) > Date.parse(previous.periodEnd) ||
      (Date.parse(row.periodEnd) === Date.parse(previous.periodEnd) &&
        Date.parse(row.collectedAt) > Date.parse(previous.collectedAt))
    )
      selected.set(day, row);
  }
  return [...selected.entries()].sort(([a], [b]) => b.localeCompare(a));
}

export function energyPercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): string {
  if (
    numerator == null ||
    denominator == null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator < 0 ||
    denominator <= 0
  )
    return "Unavailable";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** A snapshot is complete only if its period reaches the next site-local day. */
export function isIncompleteDay(row: EnergyObservation, timezone: string) {
  return siteDay(row.periodEnd, timezone) <= siteDay(row.periodStart, timezone);
}

export function flowValues(row: EnergyObservation | null | undefined) {
  return [
    {
      label: "Solar → household self-consumption",
      value: row?.selfConsumptionKwh,
    },
    { label: "Solar → grid export", value: row?.gridExportKwh },
    { label: "Grid import → household consumption", value: row?.gridImportKwh },
  ];
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
  if (connection.status === "TEMPORARY_ERROR") return "Connection issue";
  if (connection.status === "DISCONNECTED") return "Disconnected";
  if (connection.status === "CONFIGURED") return "Awaiting first collection";
  return "Connected";
}

export function freshness(connection: EnergyConnection, now: Date): string {
  const timestamp = connection.lastSuccessAt;
  if (connectionLabel(connection) !== "Connected") {
    return timestamp
      ? "Last successful collection recorded"
      : "No successful collection yet";
  }
  if (connection.daylightState === "BEFORE_SUNRISE")
    return "Waiting for sunrise";
  if (connection.daylightState === "AFTER_SUNSET")
    return "Paused until sunrise";
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
  if (connection.daylightState !== "DAYLIGHT")
    return `Last collected ${age} · daylight status unavailable`;
  const sunrise = connection.sunriseAt ? Date.parse(connection.sunriseAt) : NaN;
  const reference = Number.isFinite(sunrise)
    ? Math.max(Date.parse(timestamp), sunrise)
    : Date.parse(timestamp);
  const overdue =
    now.getTime() - reference >
    (connection.pollIntervalMinutes ?? 30) * 2 * 60_000;
  if (overdue) return `Last collected ${age} · data may be stale`;
  if (Number.isFinite(sunrise) && Date.parse(timestamp) < sunrise)
    return `Waiting for first daylight collection · Last collected ${age}`;
  return `Updated recently · Last collected ${age}`;
}
