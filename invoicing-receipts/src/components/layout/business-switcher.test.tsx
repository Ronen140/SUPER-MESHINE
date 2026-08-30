import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessSwitcher } from "./business-switcher";

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn() }),
}));

const setActiveBusinessIdMock = vi.fn();
vi.mock("@/app/(app)/businesses/actions", () => ({
  setActiveBusinessId: (businessId: string) => setActiveBusinessIdMock(businessId),
}));

const oneBusiness = [
  { id: "biz-1", legal_name: 'רונן דורמן בע"מ', display_name: null, entity_type: "murshe" as const, accent_color: "#047857" },
];

const twoBusinesses = [
  ...oneBusiness,
  { id: "biz-2", legal_name: "חברת הנוער", display_name: "מועדון הנוער", entity_type: "patur" as const, accent_color: "#b45309" },
];

describe("BusinessSwitcher", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    setActiveBusinessIdMock.mockReset();
  });

  it("shows a create-first-business CTA when the user has no businesses", () => {
    render(<BusinessSwitcher businesses={[]} activeBusinessId={null} />);

    const link = screen.getByRole("link", { name: /עסק ראשון/ });
    expect(link).toHaveAttribute("href", "/businesses/new");
  });

  it("shows the single business statically, without a dropdown, plus a link to create another", () => {
    render(<BusinessSwitcher businesses={oneBusiness} activeBusinessId="biz-1" />);

    expect(screen.getByText('רונן דורמן בע"מ')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^עסק פעיל:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /עסק חדש/ })).toHaveAttribute(
      "href",
      "/businesses/new",
    );
  });

  it("exposes the active business's name in the trigger's accessible name (not just static text)", () => {
    render(<BusinessSwitcher businesses={twoBusinesses} activeBusinessId="biz-1" />);

    // Regression: an aria-label with no business name in it overrides the visible text
    // for screen readers entirely (code-quality review, Issue #2).
    expect(
      screen.getByRole("button", { name: /עסק פעיל: רונן דורמן בע"מ/ }),
    ).toBeInTheDocument();
  });

  it("shows a dropdown with both businesses, marks the active one, and switches on selection", async () => {
    setActiveBusinessIdMock.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BusinessSwitcher businesses={twoBusinesses} activeBusinessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: /^עסק פעיל:/ }));

    expect(screen.getAllByText('רונן דורמן בע"מ').length).toBeGreaterThan(0);
    const otherItem = await screen.findByText("מועדון הנוער");
    await user.click(otherItem);

    await waitFor(() => expect(setActiveBusinessIdMock).toHaveBeenCalledWith("biz-2"));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("does not call the switch action when re-selecting the already-active business", async () => {
    const user = userEvent.setup();
    render(<BusinessSwitcher businesses={twoBusinesses} activeBusinessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: /^עסק פעיל:/ }));
    const items = await screen.findAllByText('רונן דורמן בע"מ');
    // The last match is the dropdown item (first is the trigger's own label).
    await user.click(items[items.length - 1] as HTMLElement);

    expect(setActiveBusinessIdMock).not.toHaveBeenCalled();
  });

  it("shows a link to create a new business inside the dropdown", async () => {
    const user = userEvent.setup();
    render(<BusinessSwitcher businesses={twoBusinesses} activeBusinessId="biz-1" />);

    await user.click(screen.getByRole("button", { name: /^עסק פעיל:/ }));

    // Rendered via DropdownMenuItem asChild -> Radix gives it role="menuitem",
    // not the anchor's default "link" role.
    expect(await screen.findByRole("menuitem", { name: /עסק חדש/ })).toHaveAttribute(
      "href",
      "/businesses/new",
    );
  });
});
