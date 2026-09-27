export interface GoogleAuthUrl {
  url: string;
}

export interface GoogleCalendarInfo {
  id: string;
  name: string;
  primary: boolean;
  enabled: boolean;
  accessRole?: string;
  writable?: boolean;
}

export interface GoogleWriteDestination {
  syncedCalendarId: string;
  memberId: string;
  memberName: string;
  calendarName: string;
  accessRole: string;
}

export interface GoogleWriteDestinations {
  destinations: GoogleWriteDestination[];
  reconnectMemberIds: string[];
  unavailableMemberIds: string[];
}

export interface GoogleConnectionStatus {
  configured: boolean;
  connected: boolean;
  writeAuthorized?: boolean;
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
