import { Gift, Plus, Settings2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  useAdjustRewardPoints,
  useCreateReward,
  useRedeemReward,
  useRewardHistory,
  useRewardsOverview,
  useUpdateReward,
} from "@/api";
import type { ApiException } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { colorMap, type HouseholdReward } from "@/lib/types";
import { cn } from "@/lib/utils";

function errorToast(error: unknown) {
  toast({
    title: "Could not update rewards",
    description: (error as ApiException).message ?? "Try again in a moment.",
    variant: "destructive",
  });
}

export function RewardsView() {
  const overview = useRewardsOverview();
  const members = overview.data?.data.members ?? [];
  const rewards = overview.data?.data.rewards ?? [];
  const [memberId, setMemberId] = useState("");
  const [redeemReward, setRedeemReward] = useState<HouseholdReward | null>(
    null,
  );
  const [manageOpen, setManageOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const selected = members.find((entry) => entry.member.id === memberId);
  const history = useRewardHistory(memberId);
  const redeem = useRedeemReward();

  useEffect(() => {
    if (!members.some((entry) => entry.member.id === memberId)) {
      setMemberId(members[0]?.member.id ?? "");
    }
  }, [memberId, members]);

  if (overview.isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading rewards…
      </div>
    );
  }
  if (overview.isError) {
    return (
      <div className="p-8 text-center text-destructive">
        Could not load rewards.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Rewards</h1>
            <p className="text-sm text-muted-foreground">
              Earn points through chores and choose a treat.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setAdjustOpen(true)}
              disabled={!selected}
            >
              <Plus className="h-4 w-4" /> Adjust points
            </Button>
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <Settings2 className="h-4 w-4" /> Manage rewards
            </Button>
          </div>
        </header>

        {members.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <h2 className="font-semibold">No Rewards members yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enable Rewards in a member profile from the menu.
            </p>
          </div>
        ) : (
          <section
            aria-label="Member balances"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {members.map(({ member, balance }) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setMemberId(member.id)}
                aria-pressed={member.id === memberId}
                className={cn(
                  "flex min-h-20 items-center gap-3 rounded-xl border bg-card p-4 text-left",
                  member.id === memberId
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full font-bold text-white",
                    colorMap[member.color].bg,
                  )}
                >
                  {member.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {member.name}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Selected member
                  </span>
                </span>
                <strong className="text-xl tabular-nums">{balance} pts</strong>
              </button>
            ))}
          </section>
        )}

        <section aria-labelledby="available-rewards-title">
          <h2
            id="available-rewards-title"
            className="mb-3 text-lg font-semibold"
          >
            Available rewards
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rewards
              .filter((reward) => reward.active)
              .map((reward) => {
                const affordable = Boolean(
                  selected && selected.balance >= reward.pointsCost,
                );
                return (
                  <article
                    key={reward.id}
                    className="flex min-h-40 flex-col rounded-xl border bg-card p-4"
                  >
                    <Gift className="mb-3 h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{reward.name}</h3>
                    {reward.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {reward.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <strong>{reward.pointsCost} pts</strong>
                      <Button
                        disabled={!affordable}
                        onClick={() => setRedeemReward(reward)}
                      >
                        Redeem
                      </Button>
                    </div>
                  </article>
                );
              })}
            {rewards.every((reward) => !reward.active) && (
              <p className="text-sm text-muted-foreground">
                No rewards are currently available.
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="recent-activity-title">
          <h2 id="recent-activity-title" className="mb-3 text-lg font-semibold">
            Recent activity
          </h2>
          <div className="divide-y rounded-xl border bg-card">
            {(history.data?.data ?? []).map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-3 p-4">
                <strong
                  className={cn(
                    "w-16 tabular-nums",
                    transaction.pointsDelta > 0
                      ? "text-green-700"
                      : "text-foreground",
                  )}
                >
                  {transaction.pointsDelta > 0 ? "+" : ""}
                  {transaction.pointsDelta}
                </strong>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {transaction.description}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </span>
                </span>
              </div>
            ))}
            {memberId &&
              !history.isLoading &&
              (history.data?.data.length ?? 0) === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  No activity yet.
                </p>
              )}
          </div>
        </section>
      </div>

      <Dialog
        open={Boolean(redeemReward)}
        onOpenChange={(open) => !open && setRedeemReward(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem reward?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Spend {redeemReward?.pointsCost} points from {selected?.member.name}{" "}
            on {redeemReward?.name}?
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedeemReward(null)}>
              Cancel
            </Button>
            <Button
              disabled={redeem.isPending}
              onClick={() => {
                if (!redeemReward || !selected) return;
                redeem.mutate(
                  { rewardId: redeemReward.id, memberId: selected.member.id },
                  {
                    onSuccess: () => setRedeemReward(null),
                    onError: errorToast,
                  },
                );
              }}
            >
              Redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageRewardsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        rewards={rewards}
      />
      <AdjustPointsDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        memberId={memberId}
        balance={selected?.balance ?? 0}
      />
    </div>
  );
}

function ManageRewardsDialog({
  open,
  onOpenChange,
  rewards,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewards: HouseholdReward[];
}) {
  const create = useCreateReward();
  const update = useUpdateReward();
  const [editingId, setEditingId] = useState("");
  const editing = rewards.find((reward) => reward.id === editingId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("50");

  useEffect(() => {
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setCost(String(editing?.pointsCost ?? 50));
  }, [editing]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { name, description, pointsCost: Number(cost) };
    const options = {
      onSuccess: () => {
        setEditingId("");
        setName("");
        setDescription("");
        setCost("50");
      },
      onError: errorToast,
    };
    if (editing) update.mutate({ id: editing.id, ...payload }, options);
    else create.mutate(payload, options);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div>
            <DialogTitle>Manage rewards</DialogTitle>
            <DialogDescription>
              Create, edit, or change availability.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-2">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="flex items-center gap-2 rounded-lg border p-2"
            >
              <button
                type="button"
                className="min-h-11 min-w-0 flex-1 text-left"
                onClick={() => setEditingId(reward.id)}
              >
                <span className="block truncate font-medium">
                  {reward.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {reward.pointsCost} pts ·{" "}
                  {reward.active ? "Active" : "Inactive"}
                </span>
              </button>
              <Button
                variant="outline"
                onClick={() =>
                  update.mutate(
                    { id: reward.id, active: !reward.active },
                    { onError: errorToast },
                  )
                }
              >
                {reward.active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3 border-t pt-4">
          <h3 className="font-semibold">
            {editing ? "Edit reward" : "New reward"}
          </h3>
          <div>
            <Label htmlFor="reward-name">Name</Label>
            <Input
              id="reward-name"
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="reward-description">Description</Label>
            <textarea
              id="reward-description"
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-20 w-full rounded-md border bg-input p-3"
            />
          </div>
          <div>
            <Label htmlFor="reward-cost">Points cost</Label>
            <Input
              id="reward-cost"
              type="number"
              min={1}
              max={1000000}
              required
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingId("")}
            >
              Clear
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || update.isPending}
            >
              Save reward
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdjustPointsDialog({
  open,
  onOpenChange,
  memberId,
  balance,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  balance: number;
}) {
  const adjust = useAdjustRewardPoints();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const parsed = Number(amount);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    adjust.mutate(
      { memberId, pointsDelta: parsed, reason },
      {
        onSuccess: () => {
          setAmount("");
          setReason("");
          onOpenChange(false);
        },
        onError: errorToast,
      },
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Adjust points</DialogTitle>
            <DialogDescription>
              Household adjustment. A reason is required.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="adjustment-amount">Amount</Label>
            <Input
              id="adjustment-amount"
              type="number"
              min={-1000000}
              max={1000000}
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Use - to remove points"
            />
          </div>
          <div>
            <Label htmlFor="adjustment-reason">Reason</Label>
            <Input
              id="adjustment-reason"
              required
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Current: {balance} · Adjustment:{" "}
            {Number.isFinite(parsed) ? parsed : 0} · New:{" "}
            {Number.isFinite(parsed) ? balance + parsed : balance}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                !memberId ||
                !reason.trim() ||
                parsed === 0 ||
                balance + parsed < 0 ||
                adjust.isPending
              }
            >
              Apply adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
