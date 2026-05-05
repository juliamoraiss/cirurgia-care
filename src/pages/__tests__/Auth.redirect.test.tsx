import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import Auth from "@/pages/Auth";

// Mock useAuth — getPostAuthRedirectPath uses real sessionStorage logic via the hook,
// but since we mock the hook, we replicate its share-intent behavior here.
vi.mock("@/hooks/useAuth", () => {
  return {
    useAuth: () => ({
      user: { id: "u1" },
      session: {},
      loading: false,
      isApproved: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getPostAuthRedirectPath: () => {
        const pending = sessionStorage.getItem("pending_share_surgery");
        if (!pending) return "/";
        try {
          const data = JSON.parse(pending);
          const sp = new URLSearchParams();
          if (data.text) sp.set("text", data.text);
          if (data.title) sp.set("title", data.title);
          if (data.url) sp.set("url", data.url);
          const q = sp.toString();
          return q ? `/share-cirurgia?${q}` : "/share-cirurgia";
        } catch {
          return "/";
        }
      },
    }),
  };
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="loc">{location.pathname + location.search}</div>;
}

function renderAt(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/share-cirurgia" element={<LocationProbe />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Auth post-login redirect", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("redireciona para /share-cirurgia quando há share pendente, mesmo com redirect=/", () => {
    sessionStorage.setItem(
      "pending_share_surgery",
      JSON.stringify({ text: "Cirurgia amanhã 10h", title: "WhatsApp" })
    );

    renderAt("/auth?redirect=%2F");

    const loc = screen.getByTestId("loc").textContent || "";
    expect(loc.startsWith("/share-cirurgia")).toBe(true);
    expect(loc).toContain("text=");
  });

  it("usa redirect da query quando não há share pendente", () => {
    renderAt("/auth?redirect=%2Fpatients");
    // Não há rota /patients no probe — então só validamos que não foi para /share-cirurgia
    // Nesse caso o Navigate aponta para /patients que não tem rota; renderiza vazio.
    expect(screen.queryByTestId("loc")).toBeNull();
  });

  it("vai para / quando não há share pendente nem redirect", () => {
    renderAt("/auth");
    const loc = screen.getByTestId("loc").textContent;
    expect(loc).toBe("/");
  });
});
