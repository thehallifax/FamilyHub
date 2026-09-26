import { httpClient } from "@/api/client";
import type { AppearanceApiResponse, AppearanceUpdate } from "@/lib/types";

export const appearanceService = {
  get: () => httpClient.get<AppearanceApiResponse>("/family/appearance"),
  update: (request: AppearanceUpdate) =>
    httpClient.put<AppearanceApiResponse>("/family/appearance", request),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return httpClient.postForm<AppearanceApiResponse>(
      "/family/appearance/photo",
      form,
    );
  },
  photo: () => httpClient.getBlob("/family/appearance/photo"),
  removePhoto: () =>
    httpClient.delete<AppearanceApiResponse>("/family/appearance/photo"),
};
