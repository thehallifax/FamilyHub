import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  CalendarEventResponse,
  CreateEventRequest,
  GoogleAuthUrl,
  GoogleCalendarInfo,
  GoogleConnectionStatus,
  GoogleSyncResult,
  GoogleWriteDestinations,
} from "@/lib/types";

export const googleCalendarService = {
  async getWriteDestinations(): Promise<ApiResponse<GoogleWriteDestinations>> {
    return httpClient.get<ApiResponse<GoogleWriteDestinations>>(
      "/google/events/destinations",
    );
  },

  async createEvent(request: {
    sourceOwnerMemberId: string;
    syncedCalendarId: string;
    clientRequestId: string;
    event: CreateEventRequest;
  }): Promise<ApiResponse<CalendarEventResponse>> {
    return httpClient.post<ApiResponse<CalendarEventResponse>>(
      "/google/events",
      request,
    );
  },

  async deleteEvent(eventId: string): Promise<void> {
    return httpClient.delete(`/google/events/${eventId}`);
  },

  async updateEvent(
    eventId: string,
    event: CreateEventRequest,
  ): Promise<ApiResponse<CalendarEventResponse>> {
    return httpClient.put<ApiResponse<CalendarEventResponse>>(
      `/google/events/${eventId}`,
      { event },
    );
  },
  async getAuthUrl(memberId: string): Promise<ApiResponse<GoogleAuthUrl>> {
    return httpClient.get<ApiResponse<GoogleAuthUrl>>("/google/auth", {
      params: { memberId },
    });
  },

  async getConnectionStatus(
    memberId: string,
  ): Promise<ApiResponse<GoogleConnectionStatus>> {
    return httpClient.get<ApiResponse<GoogleConnectionStatus>>(
      `/google/status/${memberId}`,
    );
  },

  async getCalendars(
    memberId: string,
  ): Promise<ApiResponse<GoogleCalendarInfo[]>> {
    return httpClient.get<ApiResponse<GoogleCalendarInfo[]>>(
      `/google/calendars/${memberId}`,
    );
  },

  async updateCalendars(
    memberId: string,
    calendarIds: string[],
  ): Promise<ApiResponse<GoogleCalendarInfo[]>> {
    return httpClient.put<ApiResponse<GoogleCalendarInfo[]>>(
      `/google/calendars/${memberId}`,
      { calendarIds },
    );
  },

  async syncCalendar(memberId: string): Promise<ApiResponse<GoogleSyncResult>> {
    return httpClient.post<ApiResponse<GoogleSyncResult>>(
      `/google/sync/${memberId}`,
      undefined,
      { timeout: 120000 },
    );
  },

  async disconnect(memberId: string): Promise<void> {
    return httpClient.delete(`/google/disconnect/${memberId}`);
  },
};
