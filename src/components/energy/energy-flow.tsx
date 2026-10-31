import type { EnergyObservation } from "./energy-api";
import { energyPercent, energyValue, flowValues } from "./energy-utils";

export function EnergyFlow({
  observation,
}: {
  observation: EnergyObservation | null;
}) {
  const flows = flowValues(observation);
  const max = Math.max(
    0,
    ...flows.map(({ value }) =>
      value != null && Number.isFinite(value) ? value : 0,
    ),
  );
  const ratios = [
    {
      label: "Solar self-consumption rate",
      value: energyPercent(
        observation?.selfConsumptionKwh,
        observation?.productionKwh,
      ),
    },
    {
      label: "Solar contribution to household",
      value: energyPercent(
        observation?.selfConsumptionKwh,
        observation?.consumptionKwh,
      ),
    },
    {
      label: "Grid dependence",
      value: energyPercent(
        observation?.gridImportKwh,
        observation?.consumptionKwh,
      ),
    },
  ];
  return (
    <section
      className="rounded-xl border bg-card p-4"
      aria-labelledby="energy-flow"
    >
      <h2 id="energy-flow" className="text-lg font-semibold">
        Energy flow
      </h2>
      <p className="text-sm text-muted-foreground">
        Cumulative energy for today’s reporting period, not instantaneous power.
      </p>
      <section
        className="mt-4 grid gap-3 md:grid-cols-2"
        aria-label="Cumulative energy flow diagram"
      >
        <div className="rounded-lg bg-muted/40 p-3 min-w-0">
          <h3 className="font-semibold">
            ☀ Solar production · {energyValue(observation?.productionKwh)}
          </h3>
          <ul className="mt-3 space-y-3">
            {flows.slice(0, 2).map((flow) => (
              <Flow key={flow.label} {...flow} max={max} />
            ))}
          </ul>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 min-w-0">
          <h3 className="font-semibold">
            Household consumption · {energyValue(observation?.consumptionKwh)}
          </h3>
          <ul className="mt-3 space-y-3">
            <Flow {...flows[2]} max={max} />
          </ul>
        </div>
      </section>
      <section
        className="mt-4 grid gap-3 sm:grid-cols-3"
        aria-label="Cumulative-period percentages"
      >
        {ratios.map((ratio) => (
          <div key={ratio.label} className="min-w-0 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">{ratio.label}</p>
            <p className="font-semibold">{ratio.value}</p>
          </div>
        ))}
      </section>
      <p className="mt-3 text-xs text-muted-foreground">
        Percentages use the same cumulative reporting period. Flow bars are
        proportional to the largest available flow.
      </p>
    </section>
  );
}

function Flow({
  label,
  value,
  max,
}: {
  label: string;
  value: number | null | undefined;
  max: number;
}) {
  const width =
    value != null && Number.isFinite(value) && value >= 0 && max > 0
      ? (value / max) * 100
      : 0;
  return (
    <li aria-label={`${label}: ${energyValue(value)}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span>{label}</span>
        <span className="font-semibold">{energyValue(value)}</span>
      </div>
      <div aria-hidden="true" className="mt-1 flex items-center gap-1">
        <div className="h-2 flex-1 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary"
            style={{ width: `${width}%` }}
          />
        </div>
        <span>➜</span>
      </div>
    </li>
  );
}
