import type { FamilyMember } from "./family";

export type RewardTransactionType =
  | "CHORE_COMPLETION"
  | "CHORE_COMPLETION_REVERSAL"
  | "REWARD_REDEMPTION"
  | "MANUAL_ADJUSTMENT";

export interface HouseholdReward {
  id: string;
  name: string;
  description?: string | null;
  pointsCost: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RewardMemberBalance {
  member: FamilyMember;
  balance: number;
}

export interface RewardTransaction {
  id: string;
  memberId: string;
  pointsDelta: number;
  type: RewardTransactionType;
  description: string;
  choreTitle?: string | null;
  rewardName?: string | null;
  rewardCost?: number | null;
  createdAt: string;
}

export interface RewardsOverview {
  members: RewardMemberBalance[];
  rewards: HouseholdReward[];
}
