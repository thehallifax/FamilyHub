import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { GoogleCalendarSection } from "./google-calendar-section";

const MEMBER_ID = "member-123";

setupMswServer();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("GoogleCalendarSection", () => {
  describe("disconnected state", () => {
    beforeEach(() => {
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: { configured: false, connected: false, calendars: [] },
            message: null,
          }),
        ),
      );
    });

    it("disables connect when integration is unconfigured and never requests an OAuth URL", async () => {
      let authRequests = 0;
      server.use(
        http.get(`${API_BASE}/google/auth`, () => {
          authRequests += 1;
          return HttpResponse.json({ data: { url: "https://example.com" } });
        }),
      );
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );

      const button = await screen.findByRole("button", {
        name: /connect google calendar/i,
      });
      expect(button).toBeDisabled();
      expect(
        screen.getByText(/not configured on this server/i),
      ).toBeInTheDocument();
      await userEvent.click(button);
      expect(authRequests).toBe(0);
    });

    it("allows Connect when configured and handles OAuth API failure without redirect", async () => {
      let authRequests = 0;
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: { configured: true, connected: false, calendars: [] },
          }),
        ),
        http.get(`${API_BASE}/google/auth`, () => {
          authRequests += 1;
          return HttpResponse.json(
            { message: "OAuth unavailable" },
            { status: 500 },
          );
        }),
      );
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );
      const button = await screen.findByRole("button", {
        name: /connect google calendar/i,
      });
      expect(button).toBeEnabled();
      await userEvent.click(button);
      await waitFor(() => expect(authRequests).toBe(1));
      expect(sessionStorage.getItem("google-auth-return")).toBeNull();
    });

    it("fails closed when status cannot be loaded", async () => {
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({ message: "unavailable" }, { status: 500 }),
        ),
      );
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );
      const button = await screen.findByRole("button", {
        name: /connect google calendar/i,
      });
      expect(button).toBeDisabled();
      expect(
        screen.getByText(/availability could not be checked/i),
      ).toBeInTheDocument();
    });

    it("disables connect button when member has no email", async () => {
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail=""
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );

      const button = await screen.findByRole("button", {
        name: /connect google calendar/i,
      });
      expect(button).toBeDisabled();
      expect(screen.getByText(/add an email/i)).toBeInTheDocument();
    });
  });

  describe("connected state", () => {
    beforeEach(() => {
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: {
              configured: true,
              connected: true,
              lastSuccessfulSyncAt: "2026-03-20T10:00:00Z",
              calendars: [
                {
                  id: "primary",
                  name: "Main Calendar",
                  enabled: true,
                  lastSyncedAt: "2026-03-20T10:00:00Z",
                },
              ],
            },
            message: null,
          }),
        ),
      );
    });

    it("shows connected status and action buttons", async () => {
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );

      expect(await screen.findByText(/connected/i)).toBeInTheDocument();
      expect(screen.getByText(/Last synced/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /choose calendars/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sync now/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /disconnect/i }),
      ).toBeInTheDocument();
    });

    it("surfaces background failure and requests manual sync", async () => {
      let syncRequests = 0;
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: {
              configured: true,
              connected: true,
              syncIssue: "Some Google calendars could not sync. Retry.",
              calendars: [
                {
                  id: "primary",
                  name: "Main",
                  enabled: true,
                  lastSyncedAt: null,
                },
              ],
            },
          }),
        ),
        http.post(`${API_BASE}/google/sync/${MEMBER_ID}`, () => {
          syncRequests += 1;
          return HttpResponse.json({
            data: {
              succeeded: 1,
              failedCalendars: [],
              message: "Google calendars synced successfully.",
            },
          });
        }),
      );
      render(
        <>
          <GoogleCalendarSection
            memberId={MEMBER_ID}
            memberEmail="test@example.com"
            memberName="Alice"
          />
          <Toaster />
        </>,
        { wrapper: createWrapper() },
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Some Google calendars could not sync",
      );
      await userEvent.click(screen.getByRole("button", { name: /sync now/i }));
      await waitFor(() => expect(syncRequests).toBe(1));
      expect(await screen.findByText("Sync complete")).toBeInTheDocument();
    });

    it("reports partial manual sync failure without claiming success", async () => {
      server.use(
        http.post(`${API_BASE}/google/sync/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: {
              succeeded: 1,
              failedCalendars: ["Work"],
              message: "Could not sync Work. Retry.",
            },
          }),
        ),
      );
      render(
        <>
          <GoogleCalendarSection
            memberId={MEMBER_ID}
            memberEmail="test@example.com"
            memberName="Alice"
          />
          <Toaster />
        </>,
        { wrapper: createWrapper() },
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /sync now/i }),
      );
      expect(
        await screen.findByText("Sync needs attention"),
      ).toBeInTheDocument();
      expect(screen.getByText(/Could not sync Work/)).toBeInTheDocument();
    });

    it("keeps Sync Now pending and reports transport failure", async () => {
      let finishRequest: (() => void) | undefined;
      server.use(
        http.post(`${API_BASE}/google/sync/${MEMBER_ID}`, async () => {
          await new Promise<void>((resolve) => {
            finishRequest = resolve;
          });
          return HttpResponse.json(
            { message: "Google unavailable" },
            { status: 503 },
          );
        }),
      );
      render(
        <>
          <GoogleCalendarSection
            memberId={MEMBER_ID}
            memberEmail="test@example.com"
            memberName="Alice"
          />
          <Toaster />
        </>,
        { wrapper: createWrapper() },
      );
      await userEvent.click(
        await screen.findByRole("button", { name: /sync now/i }),
      );
      expect(
        await screen.findByRole("button", { name: /syncing/i }),
      ).toBeDisabled();
      await waitFor(() => expect(finishRequest).toBeTypeOf("function"));
      finishRequest?.();
      expect(await screen.findByText("Sync failed")).toBeInTheDocument();
    });

    it("warns when a previously connected integration is no longer configured", async () => {
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: { configured: false, connected: true, calendars: [] },
          }),
        ),
      );
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );
      expect(
        await screen.findByText(/not configured on this server/i),
      ).toBeInTheDocument();
      expect(screen.getByText("Connected")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /disconnect/i }),
      ).toBeInTheDocument();
    });
  });
});
