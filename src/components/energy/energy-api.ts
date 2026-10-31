import { formatISO, subDays } from "date-fns";
import { httpClient } from "@/api/client";
import type { ApiResponse } from "@/lib/types";

export interface EnergyConnection {
  configured: boolean;
  siteId: number | null;
  siteTimezone: string | null;
  status: string;
  pollIntervalMinutes: number | null;
  localSafetyBudget: number | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  errorCode: string | null;
  collectionEnabled: boolean;
  lastOutcome: string | null;
  daylightState?: "BEFORE_SUNRISE" | "DAYLIGHT" | "AFTER_SUNSET" | "UNKNOWN";
  sunriseAt?: string | null;
}

export interface EnergyObservation {
  siteId: number;
  periodStart: string;
  periodEnd: string;
  collectedAt: string;
  source: string;
  siteTimezone: string | null;
  measurementKind: string;
  productionUnit: string | null;
  production: number | null;
  selfConsumption: number | null;
  gridExport: number | null;
  consumptionUnit: string | null;
  consumption: number | null;
  gridImport: number | null;
  productionKwh: number | null;
  selfConsumptionKwh: number | null;
  gridExportKwh: number | null;
  consumptionKwh: number | null;
  gridImportKwh: number | null;
}

export interface EnergyUsage {
  cycleStart: string;
  cycleEnd: string;
  familyHubEstimatedCredits: number;
}

export const energyApi = {
  connection: () =>
    httpClient.get<ApiResponse<EnergyConnection>>("/energy/connection"),
  latest: () =>
    httpClient.get<ApiResponse<EnergyObservation | null>>("/energy/latest"),
  usage: () => httpClient.get<ApiResponse<EnergyUsage>>("/energy/usage"),
  async history(now: Date) {
    const from = formatISO(subDays(now, 33));
    const to = formatISO(new Date(now.getTime() + 60_000));
    const observations: EnergyObservation[] = [];
    // The API returns at most 100 rows per page. Bound work and signal truncation.
    for (let offset = 0; offset < 2000; offset += 100) {
      const page = await httpClient.get<ApiResponse<EnergyObservation[]>>(
        "/energy/history",
        {
          params: { from, to, limit: 100, offset },
        },
      );
      observations.push(...page.data);
      if (page.data.length < 100) return { observations, truncated: false };
    }
    return { observations, truncated: true };
  },
};
