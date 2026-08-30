import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const signInWithPasswordMock = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { signInWithPassword: signInWithPasswordMock } }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    signInWithPasswordMock.mockReset();
  });

  it("shows validation errors and does not call Supabase when submitted empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm redirectTo="/" />);

    await user.click(screen.getByRole("button", { name: "התחברות" }));

    expect(await screen.findByText("נא להזין כתובת אימייל תקינה.")).toBeInTheDocument();
    expect(screen.getByText("יש להזין סיסמה.")).toBeInTheDocument();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it("submits valid credentials and redirects to redirectTo on success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<LoginForm redirectTo="/documents" />);

    await user.type(screen.getByLabelText("אימייל"), "ronen@example.com");
    await user.type(screen.getByLabelText("סיסמה"), "s3cret!");
    await user.click(screen.getByRole("button", { name: "התחברות" }));

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "ronen@example.com",
      password: "s3cret!",
    });
    expect(pushMock).toHaveBeenCalledWith("/documents");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("shows a Hebrew error and stays on the page when Supabase rejects the credentials", async () => {
    signInWithPasswordMock.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const user = userEvent.setup();
    render(<LoginForm redirectTo="/" />);

    await user.type(screen.getByLabelText("אימייל"), "ronen@example.com");
    await user.type(screen.getByLabelText("סיסמה"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "התחברות" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("אימייל או סיסמה שגויים.");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
