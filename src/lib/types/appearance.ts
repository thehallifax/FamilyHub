import type { ApiResponse } from "./api-response";

export const accentPresets = [
  "PURPLE",
  "BLUE",
  "TEAL",
  "GREEN",
  "ORANGE",
  "ROSE",
  "SLATE",
] as const;
export const gradientPresets = ["SUNRISE", "LAGOON", "LAVENDER"] as const;
export const backgroundModes = ["DEFAULT", "GRADIENT", "PHOTO"] as const;

export type AccentPreset = (typeof accentPresets)[number];
export type GradientPreset = (typeof gradientPresets)[number];
export type BackgroundMode = (typeof backgroundModes)[number];

export interface Appearance {
  accent: AccentPreset;
  backgroundMode: BackgroundMode;
  gradient: GradientPreset;
  backgroundStrength: number;
  photoKey: string | null;
}

export type AppearanceUpdate = Omit<Appearance, "photoKey">;
export type AppearanceApiResponse = ApiResponse<Appearance>;

export const defaultAppearance: Appearance = {
  accent: "PURPLE",
  backgroundMode: "DEFAULT",
  gradient: "SUNRISE",
  backgroundStrength: 55,
  photoKey: null,
};
