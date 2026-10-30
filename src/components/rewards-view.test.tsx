import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen, waitFor } from "@/test/test-utils";
import { RewardsView } from "./rewards-view";

setupMswServer();

const overview = {
  members: [
    {
      member: {
        id: "sam",
        name: "Samuel",
        color: "teal",
        rewardsEnabled: true,
      },
      balance: 80,
    },
    {
      member: {
        id: "izzy",
        name: "Isabella",
        color: "purple",
        rewardsEnabled: true,
      },
      balance: 20,
    },
  ],
  rewards: [
    {
      id: "ice",
      name: "Ice cream",
      description: "Choose a flavour",
      pointsCost: 50,
      active: true,
      createdAt: "2026-09-28T10:00:00",
      updatedAt: "2026-09-28T10:00:00",
    },
    {
      id: "movie",
      name: "Movie",
      pointsCost: 75,
      active: false,
      createdAt: "2026-09-28T10:00:00",
      updatedAt: "2026-09-28T10:00:00",
    },
  ],
};

describe("RewardsView", () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_BASE}/rewards`, () =>
        HttpResponse.json({ data: overview }),
      ),
      http.get(`${API_BASE}/rewards/members/:memberId/history`, ({ params }) =>
        HttpResponse.json({
          data:
            params.memberId === "sam"
              ? [
                  {
                    id: "tx",
                    memberId: "sam",
                    pointsDelta: 10,
                    type: "CHORE_COMPLETION",
                    description: "Take bins out",
                    createdAt: "2026-09-28T10:00:00",
                  },
                ]
              : [],
        }),
      ),
    );
  });

  it("shows member balances, available rewards, and readable activity", async () => {
    renderWithUser(<RewardsView />);
    expect(await screen.findByText("80 pts")).toBeInTheDocument();
    expect(screen.getByText("20 pts")).toBeInTheDocument();
    expect(screen.getByText("Ice cream")).toBeInTheDocument();
    expect(screen.queryByText("Movie")).not.toBeInTheDocument();
    expect(await screen.findByText("Take bins out")).toBeInTheDocument();
  });

  it("makes the target explicit and sends only reward/member identifiers", async () => {
    let body: unknown;
    server.use(
      http.post(
        `${API_BASE}/rewards/catalog/ice/redeem`,
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ data: { id: "redemption" } });
        },
      ),
    );
    const { user } = renderWithUser(<RewardsView />);
    await screen.findByText("80 pts");
    await user.click(screen.getByRole("button", { name: /^redeem$/i }));
    expect(
      screen.getByText(/spend 50 points from Samuel/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^redeem$/i }));
    await waitFor(() => expect(body).toEqual({ memberId: "sam" }));
  });

  it("prevents an unaffordable redemption after changing members", async () => {
    const { user } = renderWithUser(<RewardsView />);
    await screen.findByText("80 pts");
    await user.click(screen.getByRole("button", { name: /Isabella/i }));
    expect(screen.getByRole("button", { name: /^redeem$/i })).toBeDisabled();
  });

  it("creates, edits, and changes reward availability from management", async () => {
    const requests: Array<{ method: string; body: unknown }> = [];
    server.use(
      http.post(`${API_BASE}/rewards/catalog`, async ({ request }) => {
        requests.push({ method: "POST", body: await request.json() });
        return HttpResponse.json(
          { data: overview.rewards[0] },
          { status: 201 },
        );
      }),
      http.patch(
        `${API_BASE}/rewards/catalog/:rewardId`,
        async ({ request }) => {
          requests.push({ method: "PATCH", body: await request.json() });
          return HttpResponse.json({ data: overview.rewards[0] });
        },
      ),
    );
    const { user } = renderWithUser(<RewardsView />);
    await screen.findByText("80 pts");
    await user.click(screen.getByRole("button", { name: /manage rewards/i }));

    await user.type(screen.getByLabelText(/^name$/i), "Bike ride");
    await user.clear(screen.getByLabelText(/points cost/i));
    await user.type(screen.getByLabelText(/points cost/i), "30");
    await user.click(screen.getByRole("button", { name: /save reward/i }));
    await waitFor(() =>
      expect(requests).toContainEqual({
        method: "POST",
        body: { name: "Bike ride", description: "", pointsCost: 30 },
      }),
    );

    await user.click(screen.getByRole("button", { name: /deactivate/i }));
    await waitFor(() =>
      expect(requests).toContainEqual({
        method: "PATCH",
        body: { active: false },
      }),
    );

    await user.click(
      screen.getByText("Movie").closest("button") as HTMLButtonElement,
    );
    await user.clear(screen.getByLabelText(/^name$/i));
    await user.type(screen.getByLabelText(/^name$/i), "Family movie");
    await user.click(screen.getByRole("button", { name: /save reward/i }));
    await waitFor(() =>
      expect(requests).toContainEqual({
        method: "PATCH",
        body: { name: "Family movie", description: "", pointsCost: 75 },
      }),
    );
  });

  it("submits a valid adjustment and previews the resulting balance", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_BASE}/rewards/adjustments`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { id: "adjustment" } });
      }),
    );
    const { user } = renderWithUser(<RewardsView />);
    await screen.findByText("80 pts");
    await user.click(screen.getByRole("button", { name: /adjust points/i }));
    await user.type(screen.getByLabelText(/amount/i), "-10");
    await user.type(screen.getByLabelText(/reason/i), "Correction");
    expect(screen.getByText(/new: 70/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /apply adjustment/i }));
    await waitFor(() =>
      expect(body).toEqual({
        memberId: "sam",
        pointsDelta: -10,
        reason: "Correction",
      }),
    );
  });

  it("uses responsive grids without hiding balances or rewards on narrow screens", async () => {
    renderWithUser(<RewardsView />);
    const balances = await screen.findByRole("region", {
      name: /member balances/i,
    });
    expect(balances).toHaveClass("grid", "sm:grid-cols-2", "lg:grid-cols-3");
    expect(screen.getByText("Ice cream")).toBeVisible();
  });
});
