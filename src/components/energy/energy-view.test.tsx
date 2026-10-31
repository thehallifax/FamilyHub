import { delay, HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen } from "@/test/test-utils";
import {
  type EnergyConnection,
  type EnergyObservation,
  energyApi,
} from "./energy-api";
import {
  connectionLabel,
  energyPercent,
  energyValue,
  flowValues,
  freshness,
  isIncompleteDay,
  latestDailySnapshots,
} from "./energy-utils";
import { EnergyView } from "./energy-view";

vi.mock("@/components/home/hooks/use-hero-state", () => ({
  useDashboardNow: () => new Date("2026-10-30T05:00:00Z"),
}));
setupMswServer();

const connection: EnergyConnection = {
  configured: true,
  siteId: 1,
  siteTimezone: "UTC",
  status: "CONNECTED",
  pollIntervalMinutes: 30,
  localSafetyBudget: 1500,
  lastAttemptAt: null,
  lastSuccessAt: "2026-10-30T04:45:00Z",
  errorCode: null,
  collectionEnabled: true,
  lastOutcome: "SUCCESS",
};
const row: EnergyObservation = {
  siteId: 1,
  periodStart: "2026-10-30T00:00:00Z",
  periodEnd: "2026-10-30T04:45:00Z",
  collectedAt: "2026-10-30T04:45:00Z",
  source: "SOLAREDGE_OVERVIEW",
  siteTimezone: "UTC",
  measurementKind: "DAILY_CUMULATIVE",
  productionUnit: "WH",
  production: 1200,
  selfConsumption: null,
  gridExport: null,
  consumptionUnit: null,
  consumption: null,
  gridImport: null,
  productionKwh: 1.2,
  selfConsumptionKwh: null,
  gridExportKwh: null,
  consumptionKwh: null,
  gridImportKwh: null,
};

describe("EnergyView", () => {
  beforeEach(() =>
    server.use(
      http.get(`${API_BASE}/energy/connection`, () =>
        HttpResponse.json({ data: connection }),
      ),
      http.get(`${API_BASE}/energy/latest`, () =>
        HttpResponse.json({ data: row }),
      ),
      http.get(`${API_BASE}/energy/usage`, () =>
        HttpResponse.json({
          data: {
            cycleStart: "2026-10-01T00:00:00Z",
            cycleEnd: "2026-11-01T00:00:00Z",
            familyHubEstimatedCredits: 14,
          },
        }),
      ),
      http.get(`${API_BASE}/energy/history`, () =>
        HttpResponse.json({ data: [row] }),
      ),
    ),
  );

  it("renders cumulative measurements, missing values, freshness and estimated usage", async () => {
    renderWithUser(<EnergyView />);
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(await screen.findAllByText("1.2 kWh")).not.toHaveLength(0);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByText(/Last collected 15 min ago/)).toBeInTheDocument();
    expect(await screen.findByText(/14 estimated credits/)).toBeInTheDocument();
    expect(screen.getByText(/not the SolarEdge account/)).toBeInTheDocument();
    expect(screen.getByText(/not instantaneous power/i)).toBeInTheDocument();
  });

  it("supports history range controls and responsive grids", async () => {
    const { user } = renderWithUser(<EnergyView />);
    expect(await screen.findByText("2026-10-30")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByRole("button", { name: "Month" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getAllByText("Solar production")[0].parentElement,
    ).toHaveClass("min-w-0");
    expect(
      screen.getAllByText("Solar production")[0].parentElement?.parentElement,
    ).toHaveClass("xl:grid-cols-5");
    expect(
      screen.getByRole("heading", { name: "Energy", level: 1 }).parentElement
        ?.parentElement,
    ).toHaveClass("max-w-[1250px]");
  });

  it("renders directional flow and an honest single-day snapshot", async () => {
    server.use(
      http.get(`${API_BASE}/energy/latest`, () =>
        HttpResponse.json({
          data: {
            ...row,
            productionKwh: 10,
            consumptionKwh: 20,
            selfConsumptionKwh: 5,
            gridExportKwh: 5,
            gridImportKwh: 15,
          },
        }),
      ),
    );
    const { user } = renderWithUser(<EnergyView />);
    expect(
      await screen.findByLabelText("Solar → household self-consumption: 5 kWh"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Grid import → household consumption: 15 kWh"),
    ).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("75.0%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Day" }));
    expect(
      await screen.findByLabelText("Daily energy snapshot"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Partial snapshot through/)).toBeInTheDocument();
  });

  it("shows a clear empty history rather than fabricating readings", async () => {
    server.use(
      http.get(`${API_BASE}/energy/history`, () =>
        HttpResponse.json({ data: [] }),
      ),
    );
    renderWithUser(<EnergyView />);
    expect(
      await screen.findByText("No stored measurements for this period."),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Daily energy history chart"),
    ).not.toBeInTheDocument();
  });

  it("shows a loading state while the connection is being retrieved", async () => {
    server.use(
      http.get(`${API_BASE}/energy/connection`, async () => {
        await delay(100);
        return HttpResponse.json({ data: connection });
      }),
    );
    renderWithUser(<EnergyView />);
    expect(screen.getByText("Loading energy…")).toBeInTheDocument();
    expect(await screen.findByText("Connected")).toBeInTheDocument();
  });

  it("does not present an older observation as today's energy", async () => {
    server.use(
      http.get(`${API_BASE}/energy/latest`, () =>
        HttpResponse.json({
          data: { ...row, periodStart: "2026-10-29T00:00:00Z" },
        }),
      ),
    );
    renderWithUser(<EnergyView />);
    expect(
      await screen.findByText(/No measurements for today/),
    ).toBeInTheDocument();
  });

  it("fetches all history pages instead of silently stopping at 100 snapshots", async () => {
    const offsets: string[] = [];
    server.use(
      http.get(`${API_BASE}/energy/history`, ({ request }) => {
        const offset = new URL(request.url).searchParams.get("offset") ?? "";
        offsets.push(offset);
        return HttpResponse.json({
          data: offset === "0" ? Array(100).fill(row) : [row],
        });
      }),
    );
    const result = await energyApi.history(new Date("2026-10-30T05:00:00Z"));
    expect(offsets).toEqual(["0", "100"]);
    expect(result.observations).toHaveLength(101);
    expect(result.truncated).toBe(false);
  });

  it("shows an unconfigured state without fetching energy data", async () => {
    server.use(
      http.get(`${API_BASE}/energy/connection`, () =>
        HttpResponse.json({
          data: { ...connection, configured: false, status: "NOT_CONFIGURED" },
        }),
      ),
    );
    renderWithUser(<EnergyView />);
    expect(await screen.findByText("Not configured")).toBeInTheDocument();
    expect(screen.queryByText("Energy flow")).not.toBeInTheDocument();
  });

  it("reports a failed connection API", async () => {
    server.use(
      http.get(`${API_BASE}/energy/connection`, () =>
        HttpResponse.json({ message: "error" }, { status: 500 }),
      ),
    );
    renderWithUser(<EnergyView />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load Energy connection",
    );
  });
});

describe("energy presentation", () => {
  it("calculates cumulative ratios safely", () => {
    expect(energyPercent(1, 3)).toBe("33.3%");
    expect(energyPercent(0, 5)).toBe("0.0%");
    for (const denominator of [0, null, undefined, Number.NaN])
      expect(energyPercent(1, denominator)).toBe("Unavailable");
    expect(energyPercent(null, 4)).toBe("Unavailable");
  });

  it("maps each directional flow to its own measurement", () => {
    expect(
      flowValues({
        ...row,
        selfConsumptionKwh: 1,
        gridExportKwh: 2,
        gridImportKwh: 3,
      }).map((flow) => flow.value),
    ).toEqual([1, 2, 3]);
    expect(flowValues(null).every((flow) => flow.value === undefined)).toBe(
      true,
    );
  });

  it("chooses the latest valid site-local day snapshot and marks partial days", () => {
    const perth = {
      ...row,
      siteTimezone: "Australia/Perth",
      periodStart: "2026-10-29T16:00:00Z",
      periodEnd: "2026-10-30T04:00:00Z",
      collectedAt: "2026-10-30T04:00:01Z",
    };
    const latest = {
      ...perth,
      periodEnd: "2026-10-30T06:00:00Z",
      collectedAt: "2026-10-30T06:00:01Z",
      productionKwh: 2,
    };
    const invalid = {
      ...latest,
      periodEnd: "2026-10-30T07:00:00Z",
      productionKwh: null,
      consumptionKwh: null,
    };
    const selected = latestDailySnapshots(
      [perth, latest, invalid],
      1,
      "Australia/Perth",
      1,
      new Date("2026-10-30T07:10:00Z"),
    );
    expect(selected).toEqual([["2026-10-30", latest]]);
    expect(isIncompleteDay(latest, "Australia/Perth")).toBe(true);
    expect(
      isIncompleteDay(
        { ...latest, periodEnd: "2026-10-30T16:00:00Z" },
        "Australia/Perth",
      ),
    ).toBe(false);
  });
  it("does not add cumulative snapshots or mix sites", () => {
    const rows = [
      row,
      { ...row, periodEnd: "2026-10-30T03:00:00Z", productionKwh: 9 },
      { ...row, siteId: 2, productionKwh: 99 },
    ];
    const result = latestDailySnapshots(
      rows,
      1,
      "UTC",
      7,
      new Date("2026-10-30T05:00:00Z"),
    );
    expect(result).toHaveLength(1);
    expect(result[0][1].productionKwh).toBe(1.2);
    expect(energyValue(null)).toBe("Unavailable");
    expect(energyValue(0)).toBe("0 kWh");
  });

  it("reports important connection states and stale data", () => {
    expect(
      connectionLabel({ ...connection, lastOutcome: "PERMISSION_DENIED" }),
    ).toContain("Permission");
    expect(
      connectionLabel({ ...connection, lastOutcome: "BUDGET_EXHAUSTED" }),
    ).toContain("budget");
    expect(
      connectionLabel({ ...connection, lastOutcome: "PROVIDER_THROTTLED" }),
    ).toContain("backoff");
    expect(
      connectionLabel({ ...connection, status: "REAUTHORISATION_REQUIRED" }),
    ).toContain("Reauthorisation");
    expect(
      freshness("2026-10-30T02:00:00Z", new Date("2026-10-30T05:00:00Z"), 30),
    ).toContain("stale");
  });
});
