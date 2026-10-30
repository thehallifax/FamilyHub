import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  HouseholdReward,
  RewardsOverview,
  RewardTransaction,
} from "@/lib/types";

export const rewardsService = {
  overview: () => httpClient.get<ApiResponse<RewardsOverview>>("/rewards"),
  history: (memberId: string) =>
    httpClient.get<ApiResponse<RewardTransaction[]>>(
      `/rewards/members/${memberId}/history`,
    ),
  create: (request: {
    name: string;
    description?: string;
    pointsCost: number;
  }) =>
    httpClient.post<ApiResponse<HouseholdReward>>("/rewards/catalog", request),
  update: (
    id: string,
    request: Partial<
      Pick<HouseholdReward, "name" | "description" | "pointsCost" | "active">
    >,
  ) =>
    httpClient.patch<ApiResponse<HouseholdReward>>(
      `/rewards/catalog/${id}`,
      request,
    ),
  redeem: (rewardId: string, memberId: string) =>
    httpClient.post<ApiResponse<RewardTransaction>>(
      `/rewards/catalog/${rewardId}/redeem`,
      { memberId },
    ),
  adjust: (request: {
    memberId: string;
    pointsDelta: number;
    reason: string;
  }) =>
    httpClient.post<ApiResponse<RewardTransaction>>(
      "/rewards/adjustments",
      request,
    ),
};
