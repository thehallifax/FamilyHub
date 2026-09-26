import type { AccentPreset, GradientPreset } from "@/lib/types";

export const accentSwatches: Record<AccentPreset, string> = {
  PURPLE: "#7b43ae",
  BLUE: "#2467bd",
  TEAL: "#167c80",
  GREEN: "#3a8054",
  ORANGE: "#a95421",
  ROSE: "#ad3e73",
  SLATE: "#526174",
};

export const gradientBackgrounds: Record<GradientPreset, string> = {
  SUNRISE: "linear-gradient(145deg, #fbe7dc 0%, #f8e7f4 45%, #e9e9fb 100%)",
  LAGOON: "linear-gradient(145deg, #e1f3ef 0%, #e5eff8 50%, #f4f4e7 100%)",
  LAVENDER: "linear-gradient(145deg, #efe9fb 0%, #f8e9f2 50%, #fdf0e5 100%)",
};
