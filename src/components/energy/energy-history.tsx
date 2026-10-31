import { cn } from "@/lib/utils";
import type { EnergyObservation } from "./energy-api";
import { energyValue, isIncompleteDay } from "./energy-utils";

export function EnergyHistory({
  snapshots,
  timezone,
  days,
}: {
  snapshots: [string, EnergyObservation][];
  timezone: string;
  days: number;
}) {
  const values = snapshots.flatMap(([, row]) => [
    row.productionKwh,
    row.consumptionKwh,
  ]);
  const max = Math.max(
    0,
    ...values.filter(
      (value): value is number =>
        value != null && Number.isFinite(value) && value >= 0,
    ),
  );
  return (
    <section
      className="mt-4 space-y-4"
      aria-label={
        days === 1 ? "Daily energy snapshot" : "Daily energy history chart"
      }
    >
      {[...snapshots].reverse().map(([day, row]) => (
        <div key={day} className="min-w-0 rounded-lg bg-muted/30 p-3">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold">{day}</span>
            <span className="text-muted-foreground">
              {isIncompleteDay(row, timezone)
                ? "Partial snapshot through "
                : "Through "}
              {new Date(row.periodEnd).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                timeZone: timezone,
              })}
            </span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Bar
              label="Solar production"
              value={row.productionKwh}
              max={max}
              color="bg-amber-500"
            />
            <Bar
              label="Household consumption"
              value={row.consumptionKwh}
              max={max}
              color="bg-sky-500"
            />
          </div>
        </div>
      ))}
    </section>
  );
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number | null;
  max: number;
  color: string;
}) {
  const width =
    value != null && Number.isFinite(value) && value >= 0 && max > 0
      ? (value / max) * 100
      : 0;
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-x-2 text-sm">
        <span>{label}</span>
        <span className="font-medium">{energyValue(value)}</span>
      </div>
      <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full", color)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
