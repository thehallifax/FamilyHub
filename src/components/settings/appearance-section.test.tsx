import { fireEvent } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach } from "vitest";
import { defaultAppearance } from "@/lib/types";
import {
  API_BASE,
  seedMockAppearance,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import { renderWithUser, screen, waitFor } from "@/test/test-utils";
import { AppearanceSection } from "./appearance-section";

describe("AppearanceSection", () => {
  setupMswServer();
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:test-photo");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads default settings and saves an accent and gradient", async () => {
    const { user } = renderWithUser(<AppearanceSection />);
    expect(
      await screen.findByRole("button", { name: "Purple" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Blue" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Lagoon" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Lagoon" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Gradient", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("uploads a photo, enables photo mode, and preserves it when switching backgrounds", async () => {
    const { user } = renderWithUser(<AppearanceSection />);
    const photoMode = await screen.findByRole("button", {
      name: "Family photo",
    });
    expect(photoMode).toBeDisabled();
    await user.upload(
      screen.getByLabelText("Choose family photo"),
      new File(["fake-png"], "family.png", { type: "image/png" }),
    );
    await waitFor(() => expect(photoMode).toBeEnabled());
    expect(await screen.findByRole("status")).toHaveTextContent("Photo ready");
    await user.click(photoMode);
    await waitFor(() =>
      expect(photoMode).toHaveAttribute("aria-pressed", "true"),
    );
    await user.click(
      screen.getByRole("button", { name: "Default", exact: true }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Default", exact: true }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(photoMode).toBeEnabled();
  });

  it("shows upload errors without changing appearance", async () => {
    server.use(
      http.post(`${API_BASE}/family/appearance/photo`, () =>
        HttpResponse.json(
          { message: "Image content is invalid" },
          { status: 400 },
        ),
      ),
    );
    const { user } = renderWithUser(<AppearanceSection />);
    await user.upload(
      screen.getByLabelText("Choose family photo"),
      new File(["fake"], "bad.png", { type: "image/png" }),
    );
    expect(
      await screen.findByText("Image content is invalid"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Family photo" })).toBeDisabled();
  });

  it("saves background strength after a touch drag", async () => {
    seedMockAppearance({ ...defaultAppearance, backgroundMode: "GRADIENT" });
    renderWithUser(<AppearanceSection />);
    const slider = await screen.findByLabelText(/background strength/i);
    fireEvent.change(slider, { target: { value: "80" } });
    fireEvent.pointerUp(slider);
    await waitFor(() =>
      expect(screen.getByText("Background strength: 80%")).toBeInTheDocument(),
    );
  });
});
