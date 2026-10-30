import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rewardsService } from "@/api/services";

export const rewardKeys = {
  all: ["rewards"] as const,
  overview: () => [...rewardKeys.all, "overview"] as const,
  history: (memberId: string) =>
    [...rewardKeys.all, "history", memberId] as const,
};

function useRewardMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rewardKeys.all }),
  });
}

export function useRewardsOverview() {
  return useQuery({
    queryKey: rewardKeys.overview(),
    queryFn: rewardsService.overview,
  });
}

export function useRewardHistory(memberId: string) {
  return useQuery({
    queryKey: rewardKeys.history(memberId),
    queryFn: () => rewardsService.history(memberId),
    enabled: Boolean(memberId),
  });
}

export function useCreateReward() {
  return useRewardMutation(rewardsService.create);
}

export function useUpdateReward() {
  return useRewardMutation(
    ({
      id,
      ...request
    }: {
      id: string;
      name?: string;
      description?: string;
      pointsCost?: number;
      active?: boolean;
    }) => rewardsService.update(id, request),
  );
}

export function useRedeemReward() {
  return useRewardMutation(
    ({ rewardId, memberId }: { rewardId: string; memberId: string }) =>
      rewardsService.redeem(rewardId, memberId),
  );
}

export function useAdjustRewardPoints() {
  return useRewardMutation(rewardsService.adjust);
}
