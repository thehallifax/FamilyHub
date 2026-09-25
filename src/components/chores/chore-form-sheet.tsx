import { MobileSheet } from "@/components/ui/mobile-sheet";
import type { ChoreFormData, ChoreFormInput } from "@/lib/validations";
import { ChoreForm } from "./chore-form";

interface ChoreFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ChoreFormData) => void;
  isPending?: boolean;
  defaultValues?: Partial<ChoreFormInput>;
  title?: string;
  isEditing?: boolean;
}

export function ChoreFormSheet({
  isOpen,
  onClose,
  onSubmit,
  isPending = false,
  defaultValues,
  title = "New Chore",
  isEditing = false,
}: ChoreFormSheetProps) {
  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      initialHeight="full"
    >
      <ChoreForm
        defaultValues={defaultValues}
        isEditing={isEditing}
        onSubmit={onSubmit}
        onCancel={onClose}
        isPending={isPending}
      />
    </MobileSheet>
  );
}

export type { ChoreFormSheetProps };
