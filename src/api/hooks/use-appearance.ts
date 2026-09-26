import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { appearanceService } from "@/api/services/appearance.service";
import type { AppearanceApiResponse, AppearanceUpdate } from "@/lib/types";

export const appearanceKeys = { current: () => ["appearance"] as const };

export function useAppearance(enabled = true) {
  return useQuery({
    queryKey: appearanceKeys.current(),
    queryFn: appearanceService.get,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

function useAppearanceMutation<T>(
  mutationFn: (value: T) => Promise<AppearanceApiResponse>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (response) => {
      queryClient.setQueryData(appearanceKeys.current(), response);
    },
  });
}

export function useUpdateAppearance() {
  return useAppearanceMutation<AppearanceUpdate>(appearanceService.update);
}

export function useUploadAppearancePhoto() {
  return useAppearanceMutation<File>(appearanceService.upload);
}

export function useRemoveAppearancePhoto() {
  return useAppearanceMutation<void>(() => appearanceService.removePhoto());
}

/** Authenticated image fetch; object URL never enters the persistent query cache. */
export function useAppearancePhotoUrl(photoKey: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photoKey) {
      setUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    appearanceService
      .photo()
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoKey]);
  return url;
}
