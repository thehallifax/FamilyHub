import { ImagePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useAppearance,
  useAppearancePhotoUrl,
  useRemoveAppearancePhoto,
  useUpdateAppearance,
  useUploadAppearancePhoto,
} from "@/api";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { accentSwatches, gradientBackgrounds } from "@/lib/appearance-presets";
import {
  type AppearanceUpdate,
  accentPresets,
  backgroundModes,
  defaultAppearance,
  gradientPresets,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const modeLabels = {
  DEFAULT: "Default",
  GRADIENT: "Gradient",
  PHOTO: "Family photo",
} as const;

export function AppearanceSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [strengthDraft, setStrengthDraft] = useState(55);
  const { data, isPending, isError } = useAppearance();
  const appearance = data?.data ?? defaultAppearance;
  const photoUrl = useAppearancePhotoUrl(appearance.photoKey);
  const update = useUpdateAppearance();
  const upload = useUploadAppearancePhoto();
  const remove = useRemoveAppearancePhoto();
  const busy = update.isPending || upload.isPending || remove.isPending;

  useEffect(
    () => setStrengthDraft(appearance.backgroundStrength),
    [appearance.backgroundStrength],
  );

  const save = (patch: Partial<AppearanceUpdate>) => {
    setError(null);
    setSuccess(null);
    update.mutate(
      {
        accent: appearance.accent,
        backgroundMode: appearance.backgroundMode,
        gradient: appearance.gradient,
        backgroundStrength: appearance.backgroundStrength,
        ...patch,
      },
      { onError: (cause) => setError(cause.message) },
    );
  };

  const uploadFile = (file?: File) => {
    if (!file) return;
    setError(null);
    setSuccess(null);
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 12 * 1024 * 1024
    ) {
      setError("Choose a JPEG or PNG smaller than 12 MiB.");
      return;
    }
    upload.mutate(file, {
      onSuccess: () =>
        setSuccess("Photo ready. Select Family photo to use it on Home."),
      onError: (cause) => setError(cause.message),
    });
  };

  const commitStrength = (value: number) => {
    if (value !== appearance.backgroundStrength)
      save({ backgroundStrength: value });
  };

  return (
    <section className="space-y-5" aria-label="Appearance">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Appearance
      </h3>
      <p className="text-sm text-muted-foreground">
        Shared with everyone in this household.
      </p>
      {isPending && <p className="text-sm">Loading appearance…</p>}
      {isError && (
        <FormError message="Appearance could not be loaded. Try reopening Settings." />
      )}

      <fieldset disabled={busy || isPending || isError} className="space-y-2">
        <legend className="text-sm font-semibold">Accent</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {accentPresets.map((accent) => (
            <button
              key={accent}
              type="button"
              aria-pressed={appearance.accent === accent}
              onClick={() => save({ accent })}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-lg border px-3 text-sm font-medium",
                appearance.accent === accent
                  ? "border-primary ring-2 ring-primary"
                  : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className="h-6 w-6 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: accentSwatches[accent] }}
              />
              {accent.charAt(0) + accent.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={busy || isPending || isError} className="space-y-2">
        <legend className="text-sm font-semibold">Home background</legend>
        <div className="grid grid-cols-3 gap-2">
          {backgroundModes.map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={appearance.backgroundMode === mode}
              disabled={mode === "PHOTO" && !appearance.photoKey}
              onClick={() => save({ backgroundMode: mode })}
              className={cn(
                "min-h-12 rounded-lg border px-2 text-sm font-medium disabled:opacity-50",
                appearance.backgroundMode === mode
                  ? "border-primary ring-2 ring-primary"
                  : "border-border",
              )}
            >
              {modeLabels[mode]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset disabled={busy || isPending || isError} className="space-y-2">
        <legend className="text-sm font-semibold">Gradient</legend>
        <div className="grid grid-cols-3 gap-2">
          {gradientPresets.map((gradient) => (
            <button
              key={gradient}
              type="button"
              aria-pressed={appearance.gradient === gradient}
              onClick={() => save({ gradient, backgroundMode: "GRADIENT" })}
              className={cn(
                "min-h-16 rounded-lg border p-1 text-sm font-semibold",
                appearance.gradient === gradient &&
                  appearance.backgroundMode === "GRADIENT"
                  ? "border-primary ring-2 ring-primary"
                  : "border-border",
              )}
            >
              <span
                aria-hidden="true"
                className="mb-1 block h-8 rounded-md"
                style={{ backgroundImage: gradientBackgrounds[gradient] }}
              />
              {gradient.charAt(0) + gradient.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Family photo</h4>
        {photoUrl && (
          <img
            src={photoUrl}
            alt="Current family background"
            className="h-28 w-full rounded-lg object-cover"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          aria-label="Choose family photo"
          onChange={(event) => {
            uploadFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {upload.isPending
              ? "Uploading…"
              : appearance.photoKey
                ? "Change photo"
                : "Upload photo"}
          </Button>
          {appearance.photoKey && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={busy}
              onClick={() =>
                remove.mutate(undefined, {
                  onError: (cause) => setError(cause.message),
                })
              }
            >
              Remove photo
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPEG or PNG, 640×360 or larger, up to 12 MiB and 16 megapixels. HEIC
          is not supported.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="background-strength"
          className="block text-sm font-semibold"
        >
          Background strength: {strengthDraft}%
        </label>
        <input
          id="background-strength"
          type="range"
          min="0"
          max="100"
          step="5"
          value={strengthDraft}
          disabled={busy || isPending || isError}
          onChange={(event) => setStrengthDraft(Number(event.target.value))}
          onPointerUp={(event) =>
            commitStrength(Number(event.currentTarget.value))
          }
          onKeyUp={(event) => commitStrength(Number(event.currentTarget.value))}
          onBlur={(event) => commitStrength(Number(event.currentTarget.value))}
          className="h-11 w-full accent-primary"
        />
      </div>
      <FormError message={error ?? undefined} />
      {success && (
        <p role="status" className="text-sm text-muted-foreground">
          {success}
        </p>
      )}
    </section>
  );
}
