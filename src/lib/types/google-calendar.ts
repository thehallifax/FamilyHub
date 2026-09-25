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
  calendars: Array<{
    id: string;
    name: string;
    enabled: boolean;
    lastSyncedAt: string | null;
  }>;
}
