import type { ChoreBoardItem, ChoresBoard } from "@/lib/types";

export function scheduledChoresNeedingAttention(
  board: ChoresBoard,
): ChoreBoardItem[] {
  return [board.thisWeek, board.thisMonth].flatMap((scope) =>
    scope.assignees.flatMap((group) =>
      group.chores.filter(
        (chore) =>
          !chore.completed &&
          (chore.dueState === "DUE" || chore.dueState === "OVERDUE"),
      ),
    ),
  );
}

export function choresNeedingAttentionCount(board: ChoresBoard): number {
  return (
    board.today.summary.remaining +
    scheduledChoresNeedingAttention(board).length
  );
}
