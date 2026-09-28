import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { googleCalendarService } from "@/api/services";
import { assertOnlineForWrite } from "@/lib/offline/read-only-guard";
import type { ApiResponse, GoogleCalendarInfo } from "@/lib/types";
import { calendarKeys } from "./use-calendar";

export const googleCalendarKeys = {
  all: ["google-calendar"] as const,
  status: (memberId: string) =>
    [...googleCalendarKeys.all, "status", memberId] as const,
  calendars: (memberId: string) =>
    [...googleCalendarKeys.all, "calendars", memberId] as const,
  destinations: () => [...googleCalendarKeys.all, "destinations"] as const,
};

export function useGoogleWriteDestinations(enabled = true) {
  return useQuery({
    queryKey: googleCalendarKeys.destinations(),
    queryFn: () => googleCalendarService.getWriteDestinations(),
    enabled,
    staleTime: 0,
  });
}

export function useCreateGoogleEvent(callbacks?: GoogleMutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: googleCalendarService.createEvent,
    onMutate: () => assertOnlineForWrite(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

export function useDeleteGoogleEvent(callbacks?: GoogleMutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: googleCalendarService.deleteEvent,
    onMutate: () => assertOnlineForWrite(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => callbacks?.onError?.(error),
  });
}

export function useUpdateGoogleEvent(callbacks?: GoogleMutationCallbacks) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      event,
      scope,
      occurrenceDate,
    }: {
      id: string;
      event: Parameters<typeof googleCalendarService.updateEvent>[1]["event"];
      scope?: "THIS_EVENT" | "ENTIRE_SERIES";
      occurrenceDate?: string;
    }) =>
      googleCalendarService.updateEvent(id, {
        event,
        scope,
        occurrenceDate,
      }),
    onMutate: () => assertOnlineForWrite(),
    onSuccess: () => callbacks?.onSuccess?.(),
    onError: (error: ApiException) => callbacks?.onError?.(error),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() }),
  });
}

// Queries

export function useGoogleConnectionStatus(memberId: string) {
  return useQuery({
    queryKey: googleCalendarKeys.status(memberId),
    queryFn: () => googleCalendarService.getConnectionStatus(memberId),
    enabled: !!memberId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useGoogleCalendars(memberId: string, enabled = true) {
  return useQuery({
    queryKey: googleCalendarKeys.calendars(memberId),
    queryFn: () => googleCalendarService.getCalendars(memberId),
    enabled: !!memberId && enabled,
  });
}

// Mutations

interface GoogleMutationCallbacks<T = void> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiException) => void;
}

export function useUpdateGoogleCalendars(
  callbacks?: GoogleMutationCallbacks<ApiResponse<GoogleCalendarInfo[]>>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      calendarIds,
    }: {
      memberId: string;
      calendarIds: string[];
    }) => googleCalendarService.updateCalendars(memberId, calendarIds),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: googleCalendarKeys.calendars(variables.memberId),
      });
      queryClient.invalidateQueries({
        queryKey: googleCalendarKeys.status(variables.memberId),
      });
      queryClient.invalidateQueries({
        queryKey: calendarKeys.events(),
      });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useSyncGoogleCalendar(callbacks?: GoogleMutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      googleCalendarService.syncCalendar(memberId),
    onSuccess: (_data, memberId) => {
      queryClient.invalidateQueries({
        queryKey: googleCalendarKeys.status(memberId),
      });
      queryClient.invalidateQueries({
        queryKey: calendarKeys.events(),
      });
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDisconnectGoogle(callbacks?: GoogleMutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      googleCalendarService.disconnect(memberId),
    onSuccess: (_data, memberId) => {
      queryClient.invalidateQueries({
        queryKey: googleCalendarKeys.status(memberId),
      });
      queryClient.invalidateQueries({
        queryKey: calendarKeys.events(),
      });
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}
