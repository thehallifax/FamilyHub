export interface GoogleAuthUrl {
  url: string;
}

export interface GoogleCalendarInfo {
  id: string;
  name: string;
  primary: boolean;
  enabled: boolean;
}

export interface GoogleConnectionStatus {
  configured: boolean;
  connected: boolean;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  syncIssue: string | null;
  calendars: Array<{
    id: string;
    name: string;
    enabled: boolean;
    lastSyncedAt: string | null;
  }>;
}

export interface GoogleSyncResult {
  succeeded: number;
  failedCalendars: string[];
  message: string;
}
