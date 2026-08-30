import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupForm } from "./signup-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const signUpMock = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { signUp: signUpMock } }),
}));

describe("SignupForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    signUpMock.mockReset();
  });

  it("shows validation errors and does not call Supabase when submitted empty", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));

    expect(await screen.findByText("השם קצר מדי — נדרשים לפחות 2 תווים.")).toBeInTheDocument();
    expect(screen.getByText("נא להזין כתובת אימייל תקינה.")).toBeInTheDocument();
    expect(screen.getByText("הסיסמה קצרה מדי — נדרשים לפחות 6 תווים.")).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows a mismatch error when password and confirmation differ", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("שם מלא"), "רונן דורמן");
    await user.type(screen.getByLabelText("אימייל"), "ronen@example.com");
    await user.type(screen.getByLabelText("סיסמה"), "s3cret!");
    await user.type(screen.getByLabelText("אימות סיסמה"), "different!");
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));

    expect(await screen.findByText("הסיסמאות אינן תואמות.")).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("submits valid data with full_name metadata and redirects to / on success", async () => {
    signUpMock.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("שם מלא"), "רונן דורמן");
    await user.type(screen.getByLabelText("אימייל"), "ronen@example.com");
    await user.type(screen.getByLabelText("סיסמה"), "s3cret!");
    await user.type(screen.getByLabelText("אימות סיסמה"), "s3cret!");
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));

    expect(signUpMock).toHaveBeenCalledWith({
      email: "ronen@example.com",
      password: "s3cret!",
      options: { data: { full_name: "רונן דורמן" } },
    });
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("shows a Hebrew error when Supabase rejects a duplicate signup", async () => {
    signUpMock.mockResolvedValue({ error: { message: "User already registered" } });
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.type(screen.getByLabelText("שם מלא"), "רונן דורמן");
    await user.type(screen.getByLabelText("אימייל"), "ronen@example.com");
    await user.type(screen.getByLabelText("סיסמה"), "s3cret!");
    await user.type(screen.getByLabelText("אימות סיסמה"), "s3cret!");
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "כבר קיים משתמש עם כתובת האימייל הזו. נסו להתחבר.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
