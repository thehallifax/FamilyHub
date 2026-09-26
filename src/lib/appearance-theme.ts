import type { AccentPreset } from "@/lib/types";

export function applyAppearanceAccent(accent?: AccentPreset): void {
  if (accent && accent !== "PURPLE") {
    document.documentElement.dataset.familyhubAccent = accent.toLowerCase();
  } else {
    delete document.documentElement.dataset.familyhubAccent;
  }
}
