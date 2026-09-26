import { useAppearance, useAppearancePhotoUrl } from "@/api";
import { useIsMobile } from "@/hooks";
import { gradientBackgrounds } from "@/lib/appearance-presets";
import { defaultAppearance } from "@/lib/types";
import { LargeHomeDashboard } from "./large-home-dashboard";
import { MobileHomeDashboard } from "./mobile-home-dashboard";

export function HomeDashboard({ nowOverride }: { nowOverride?: Date } = {}) {
  const isMobile = useIsMobile();
  const { data } = useAppearance();
  const appearance = data?.data ?? defaultAppearance;
  const photoUrl = useAppearancePhotoUrl(appearance.photoKey);
  const mode =
    appearance.backgroundMode === "PHOTO" && !photoUrl
      ? "DEFAULT"
      : appearance.backgroundMode;
  const backgroundImage =
    mode === "PHOTO"
      ? `linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)),url("${photoUrl}")`
      : mode === "GRADIENT"
        ? gradientBackgrounds[appearance.gradient]
        : undefined;
  return (
    <div
      data-testid="home-background"
      data-background-mode={mode}
      className="relative flex min-h-0 flex-1 overflow-hidden bg-background"
    >
      {backgroundImage && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage,
            opacity:
              mode === "PHOTO"
                ? 0.2 + appearance.backgroundStrength * 0.004
                : 0.25 + appearance.backgroundStrength * 0.0075,
          }}
        />
      )}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {isMobile ? (
          <MobileHomeDashboard nowOverride={nowOverride} />
        ) : (
          <LargeHomeDashboard nowOverride={nowOverride} />
        )}
      </div>
    </div>
  );
}
