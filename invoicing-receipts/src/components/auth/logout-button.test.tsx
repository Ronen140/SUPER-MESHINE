import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogoutButton } from "./logout-button";

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const signOutMock = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

describe("LogoutButton", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    signOutMock.mockReset();
  });

  it("signs out and redirects to /login on success", async () => {
    signOutMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "התנתקות" }));

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith("/login");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("shows a Hebrew error and does not redirect when sign-out fails", async () => {
    signOutMock.mockResolvedValue({ error: { message: "fetch failed" } });
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "התנתקות" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "בעיית תקשורת מול השרת. בדקו את החיבור לאינטרנט ונסו שוב.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a Hebrew network error instead of failing silently when signOut throws", async () => {
    signOutMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<LogoutButton />);

    await user.click(screen.getByRole("button", { name: "התנתקות" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "בעיית תקשורת מול השרת. בדקו את החיבור לאינטרנט ונסו שוב.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
