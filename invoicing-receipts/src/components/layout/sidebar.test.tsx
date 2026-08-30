import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

describe("Sidebar", () => {
  it("renders בית as a real, working navigation link", () => {
    render(<Sidebar />);

    const homeLink = screen.getByRole("link", { name: "בית" });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("does not link to Phase 1 screens (מסמכים/לקוחות) that don't exist yet in F1", () => {
    render(<Sidebar />);

    // Explicitly not real links — spec-review flagged /documents and /customers
    // as scope creep for F1 (vault/Reviews/spec/2026-08-30-invoicing-f1-f2.md).
    expect(screen.queryByRole("link", { name: /מסמכים/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /לקוחות/ })).not.toBeInTheDocument();

    expect(screen.getByText("מסמכים")).toBeInTheDocument();
    expect(screen.getByText("לקוחות")).toBeInTheDocument();
    expect(screen.getAllByText("בקרוב")).toHaveLength(2);
  });
});
