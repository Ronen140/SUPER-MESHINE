import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessForm } from "./business-form";

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const setActiveBusinessIdMock = vi.fn();
vi.mock("@/app/(app)/businesses/actions", () => ({
  setActiveBusinessId: (businessId: string) => setActiveBusinessIdMock(businessId),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function jsonResponse(body: unknown, ok: boolean) {
  return { ok, json: async () => body } as Response;
}

async function fillMinimalValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("שם חוקי של העסק"), 'רונן דורמן בע"מ');
  await user.click(screen.getByRole("radio", { name: /עוסק מורשה/ }));
  await user.type(screen.getByLabelText("מספר עוסק / ח.פ"), "123456789");
}

describe("BusinessForm", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    fetchMock.mockReset();
    setActiveBusinessIdMock.mockReset();
    setActiveBusinessIdMock.mockResolvedValue({ ok: true });
  });

  it("shows validation errors and does not call the API when submitted empty", async () => {
    const user = userEvent.setup();
    render(<BusinessForm />);

    await user.click(screen.getByRole("button", { name: "יצירת עסק" }));

    expect(await screen.findByText("יש להזין שם חוקי לעסק.")).toBeInTheDocument();
    expect(screen.getByText("יש לבחור סוג עסק.")).toBeInTheDocument();
    expect(screen.getByText("מספר עוסק/ח.פ חייב להיות בן 9 ספרות.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains the difference between patur and murshe entity types", () => {
    render(<BusinessForm />);

    expect(screen.getByText(/פטור ממע"מ/)).toBeInTheDocument();
    expect(screen.getByText(/גובה ומדווח מע"מ/)).toBeInTheDocument();
    expect(screen.getByText("לא ניתן לשנות את סוג העסק לאחר יצירתו.")).toBeInTheDocument();
  });

  it("creates a business and redirects home on the golden path (no signing-key error)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          business: { id: "biz-1", legal_name: 'רונן דורמן בע"מ', tax_id: "123456789" },
          signingKeyError: null,
        },
        true,
      ),
    );
    const user = userEvent.setup();
    render(<BusinessForm />);

    await fillMinimalValidForm(user);
    await user.click(screen.getByRole("button", { name: "יצירת עסק" }));

    expect(await screen.findByRole("button", { name: "יצירת עסק" })).not.toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/businesses",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          legal_name: 'רונן דורמן בע"מ',
          entity_type: "murshe",
          tax_id: "123456789",
        }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("activates the newly created business before navigating home (F3/F4 wiring)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { business: { id: "biz-42", legal_name: "עסק שני", tax_id: "123456789" }, signingKeyError: null },
        true,
      ),
    );
    const user = userEvent.setup();
    render(<BusinessForm />);

    await fillMinimalValidForm(user);
    await user.click(screen.getByRole("button", { name: "יצירת עסק" }));

    await screen.findByRole("button", { name: "יצירת עסק" });
    // Regression: creating a second (or later) business used to leave whichever
    // business was already active untouched — code-quality review, Issue #1.
    expect(setActiveBusinessIdMock).toHaveBeenCalledWith("biz-42");
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("maps an INV_TAX_ID_EXISTS API error to Hebrew and does not navigate", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'INV_TAX_ID_EXISTS: duplicate key value violates unique constraint "businesses_tax_id_uk"' }, false),
    );
    const user = userEvent.setup();
    render(<BusinessForm />);

    await fillMinimalValidForm(user);
    await user.click(screen.getByRole("button", { name: "יצירת עסק" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "כבר קיים עסק עם מספר עוסק/ח.פ זה במערכת.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("maps an INV_BUSINESS_LIMIT API error to Hebrew", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "INV_BUSINESS_LIMIT: limit reached" }, false));
    const user = userEvent.setup();
    render(<BusinessForm />);

    await fillMinimalValidForm(user);
    await user.click(screen.getByRole("button", { name: "יצירת עסק" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "לא ניתן ליצור יותר מ-10 עסקים למשתמש אחד.",
    );
  });

  it("shows a retry banner instead of navigating when the business is created but keygen fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          business: { id: "biz-1", legal_name: 'רונן דורמן בע"מ', tax_id: "123456789" },
          signingKeyError: "INV_NO_SIGNING_KEY",
        },
        true,
      ),
    );
    const user = userEvent.setup();
    render(<BusinessForm />);

    await fillMinimalValidForm(user);
    await user.click(screen.getByRole("button", { name: "יצירת עסק" }));

    expect(await screen.findByText(/נוצר בהצלחה/)).toBeInTheDocument();
    expect(
      screen.getByText("לעסק אין מפתח חתימה פעיל — לא ניתן להפיק מסמכים כרגע."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    // The business is activated as soon as it's created, even while the signing-key
    // banner is showing — not only once the user eventually navigates away.
    expect(setActiveBusinessIdMock).toHaveBeenCalledWith("biz-1");

    fetchMock.mockResolvedValueOnce(jsonResponse({}, true));
    await user.click(screen.getByRole("button", { name: "נסה שוב" }));

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/keygen",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          business_id: "biz-1",
          legal_name: 'רונן דורמן בע"מ',
          tax_id: "123456789",
        }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("shows a Hebrew network error instead of failing silently when the request throws", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    render(<BusinessForm />);

    await fillMinimalValidForm(user);
    await user.click(screen.getByRole("button", { name: "יצירת עסק" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "בעיית תקשורת מול השרת. בדקו את החיבור לאינטרנט ונסו שוב.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
