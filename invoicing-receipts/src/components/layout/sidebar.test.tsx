import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

vi.mock("@/app/(app)/businesses/actions", () => ({
  setActiveBusinessId: vi.fn(),
}));

describe("Sidebar", () => {
  it("renders בית as a real, working navigation link", () => {
    render(<Sidebar businesses={[]} activeBusinessId={null} />);

    const homeLink = screen.getByRole("link", { name: "בית" });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("does not link to Phase 1 screens (מסמכים/לקוחות) that don't exist yet in F1", () => {
    render(<Sidebar businesses={[]} activeBusinessId={null} />);

    // Explicitly not real links — spec-review flagged /documents and /customers
    // as scope creep for F1 (vault/Reviews/spec/2026-08-30-invoicing-f1-f2.md).
    expect(screen.queryByRole("link", { name: /מסמכים/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /לקוחות/ })).not.toBeInTheDocument();

    expect(screen.getByText("מסמכים")).toBeInTheDocument();
    expect(screen.getByText("לקוחות")).toBeInTheDocument();
    expect(screen.getAllByText("בקרוב")).toHaveLength(2);
  });

  it("wires businesses/activeBusinessId through to the business switcher", () => {
    render(
      <Sidebar
        businesses={[
          {
            id: "biz-1",
            legal_name: "עסק בדיקה",
            display_name: null,
            entity_type: "murshe",
            accent_color: "#047857",
          },
        ]}
        activeBusinessId="biz-1"
      />,
    );

    expect(screen.getByText("עסק בדיקה")).toBeInTheDocument();
  });
});
