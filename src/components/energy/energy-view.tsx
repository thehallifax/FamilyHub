import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDashboardNow } from "@/components/home/hooks/use-hero-state";
import { cn } from "@/lib/utils";
import { type EnergyObservation, energyApi } from "./energy-api";
import {
  connectionLabel,
  energyValue,
  freshness,
  latestDailySnapshots,
  siteDay,
} from "./energy-utils";

const metrics: { label: string; field: keyof EnergyObservation }[] = [
  { label: "Solar production", field: "productionKwh" },
  { label: "Household consumption", field: "consumptionKwh" },
  { label: "Solar self-consumption", field: "selfConsumptionKwh" },
  { label: "Grid import", field: "gridImportKwh" },
  { label: "Grid export", field: "gridExportKwh" },
];

export function EnergyView() {
  const now = useDashboardNow();
  const [days, setDays] = useState(7);
  const connection = useQuery({
    queryKey: ["energy", "connection"],
    queryFn: energyApi.connection,
    refetchInterval: 60_000,
  });
  const configured = connection.data?.data.configured === true;
  const latest = useQuery({
    queryKey: ["energy", "latest"],
    queryFn: energyApi.latest,
    enabled: configured,
    refetchInterval: 60_000,
  });
  const usage = useQuery({
    queryKey: ["energy", "usage"],
    queryFn: energyApi.usage,
    enabled: configured,
    refetchInterval: 60_000,
  });
  const history = useQuery({
    queryKey: ["energy", "history"],
    queryFn: () => energyApi.history(new Date()),
    enabled: configured,
    refetchInterval: 300_000,
  });

  if (connection.isLoading)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading energy…
      </div>
    );
  if (connection.isError || !connection.data)
    return (
      <div role="alert" className="p-8 text-center text-destructive">
        Could not load Energy connection. Please try again.
      </div>
    );
  const info = connection.data.data;
  const observation = latest.data?.data;
  const timezone = info.siteTimezone;
  const today =
    observation &&
    timezone &&
    observation.measurementKind === "DAILY_CUMULATIVE" &&
    observation.siteTimezone === timezone &&
    siteDay(observation.periodStart, timezone) === siteDay(now, timezone)
      ? observation
      : null;
  const snapshots =
    timezone && info.siteId != null
      ? latestDailySnapshots(
          history.data?.observations ?? [],
          info.siteId,
          timezone,
          days,
          now,
        )
      : [];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Energy</h1>
          <p className="text-sm text-muted-foreground">
            Your household solar and energy use
          </p>
        </header>
        <section
          aria-label="Connection status"
          className="rounded-xl border bg-card p-4"
        >
          <h2 className="font-semibold">{connectionLabel(info)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {freshness(info.lastSuccessAt, now, info.pollIntervalMinutes)}
          </p>
          {!info.configured && (
            <p className="mt-2 text-sm">
              Ask an administrator to configure the SolarEdge connection.
            </p>
          )}
        </section>
        {configured && (
          <>
            <section aria-labelledby="energy-today">
              <h2 id="energy-today" className="text-lg font-semibold">
                Today’s energy
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Cumulative since site-local midnight
                {timezone ? ` · ${timezone}` : ""}. Not live power.
              </p>
              {latest.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Could not load the latest measurements.
                </p>
              )}
              {latest.isLoading ? (
                <p>Loading measurements…</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3">
                  {metrics.map(({ label, field }) => (
                    <div
                      key={field}
                      className="min-w-0 rounded-xl border bg-card p-4"
                    >
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-2 text-xl font-semibold">
                        {energyValue(
                          today?.[field] as number | null | undefined,
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {!today && !latest.isLoading && !latest.isError && (
                <p className="mt-3 text-sm text-muted-foreground">
                  No measurements for today are available yet.
                </p>
              )}
              {today && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Reporting period ends{" "}
                  {new Date(today.periodEnd).toLocaleString(undefined, {
                    timeZone: timezone ?? undefined,
                    timeZoneName: "short",
                  })}{" "}
                  · collected{" "}
                  {new Date(today.collectedAt).toLocaleString(undefined, {
                    timeZone: timezone ?? undefined,
                    timeZoneName: "short",
                  })}
                </p>
              )}
            </section>
            <section
              className="rounded-xl border bg-card p-4"
              aria-labelledby="energy-flow"
            >
              <h2 id="energy-flow" className="text-lg font-semibold">
                Energy flow
              </h2>
              <p className="text-sm text-muted-foreground">
                Cumulative energy for today’s reporting period, not
                instantaneous power.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    label: "Solar → self-consumption",
                    value: today?.selfConsumptionKwh,
                  },
                  { label: "Solar → grid export", value: today?.gridExportKwh },
                  {
                    label: "Grid import → household",
                    value: today?.gridImportKwh,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm">{label}</p>
                    <p className="font-semibold">{energyValue(value)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Solar supplies the household or exports to the grid; the grid
                also supplies the household.
              </p>
            </section>
            <section
              className="rounded-xl border bg-card p-4"
              aria-labelledby="energy-history"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="energy-history" className="text-lg font-semibold">
                  History
                </h2>
                <fieldset aria-label="History range" className="flex gap-1">
                  {[
                    { label: "Day", value: 1 },
                    { label: "Week", value: 7 },
                    { label: "Month", value: 31 },
                  ].map((range) => (
                    <button
                      type="button"
                      key={range.value}
                      aria-pressed={days === range.value}
                      onClick={() => setDays(range.value)}
                      className={cn(
                        "min-h-11 rounded-lg px-3 text-sm",
                        days === range.value
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      {range.label}
                    </button>
                  ))}
                </fieldset>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Latest available cumulative snapshot for each site-local day. A
                snapshot may be incomplete; readings are not added together.
                Hourly data is unavailable.
              </p>
              {history.isLoading && <p className="mt-3">Loading history…</p>}
              {history.isError && (
                <p role="alert" className="mt-3 text-destructive">
                  Could not load energy history.
                </p>
              )}
              {!history.isLoading &&
                !history.isError &&
                snapshots.length === 0 && (
                  <p className="mt-3 text-muted-foreground">
                    No stored measurements for this period.
                  </p>
                )}
              {history.data?.truncated && (
                <p className="mt-3 text-sm text-muted-foreground">
                  History is limited to the most recent 2,000 snapshots; earlier
                  days may be missing.
                </p>
              )}
              <ul className="mt-3 divide-y">
                {snapshots.map(([day, row]) => (
                  <li
                    key={day}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm"
                  >
                    <span className="font-medium">{day}</span>
                    <span>Solar: {energyValue(row.productionKwh)}</span>
                    <span>Home: {energyValue(row.consumptionKwh)}</span>
                    <span className="text-muted-foreground">
                      Through{" "}
                      {new Date(row.periodEnd).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: timezone ?? undefined,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border bg-card p-4">
              <h2 className="font-semibold">FamilyHub API usage</h2>
              {usage.isLoading ? (
                <p className="text-sm">Loading usage…</p>
              ) : usage.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  Could not load estimated usage.
                </p>
              ) : (
                <p className="mt-1 text-sm">
                  {usage.data?.data.familyHubEstimatedCredits ?? "Unavailable"}{" "}
                  estimated credits this billing cycle.
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                This is FamilyHub’s estimate, not the SolarEdge account’s
                remaining balance.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
