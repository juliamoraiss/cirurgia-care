import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useSearchParams, Navigate } from "react-router-dom";
import {
  buildShareIntentQuery,
  hasShareIntent,
  peekPendingShareIntent,
  readShareIntentFromSearch,
  buildShareRedirectPath,
  getShareIntentRawText,
} from "@/lib/shareIntent";

// Mock auth — sempre logado e aprovado para simular o pós-login no iOS PWA.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1" },
    session: {},
    loading: false,
    isApproved: true,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    getPostAuthRedirectPath: () => {
      const pending = peekPendingShareIntent();
      return pending ? buildShareRedirectPath(pending) : "/";
    },
  }),
}));

// Reproduz HomeOrShareCapture e ProtectedRoute do App.tsx, isolando-os
// para testar a lógica de fallback sem montar o app inteiro.
function HomeOrShareCapture({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const incoming = readShareIntentFromSearch(location.search);
  if (hasShareIntent(incoming)) {
    return <Navigate to={`/share-cirurgia?${buildShareIntentQuery(incoming)}`} replace />;
  }
  const pending = peekPendingShareIntent();
  if (pending) return <Navigate to={buildShareRedirectPath(pending)} replace />;
  return <>{children}</>;
}

function FakeShareCirurgia() {
  const [searchParams] = useSearchParams();
  const fromUrl = readShareIntentFromSearch(`?${searchParams.toString()}`);
  const payload = hasShareIntent(fromUrl) ? fromUrl : peekPendingShareIntent() ?? fromUrl;
  const text = getShareIntentRawText(payload);
  return (
    <div>
      <span data-testid="path">/share-cirurgia</span>
      <textarea data-testid="raw" defaultValue={text} />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomeOrShareCapture>
            <div data-testid="dashboard">Dashboard</div>
          </HomeOrShareCapture>
        }
      />
      <Route path="/share-cirurgia" element={<FakeShareCirurgia />} />
    </Routes>
  );
}

describe("iOS PWA fallback: redirect '/' + query vazia", () => {
  beforeEach(() => sessionStorage.clear());

  it("entra em '/' sem query e ainda assim cai em /share-cirurgia com o texto", () => {
    sessionStorage.setItem(
      "pending_share_surgery",
      JSON.stringify({ text: "Paciente João, Rinoplastia 12/06" })
    );

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId("path").textContent).toBe("/share-cirurgia");
    const raw = screen.getByTestId("raw") as HTMLTextAreaElement;
    expect(raw.value).toContain("Rinoplastia");
    // Dashboard NÃO deve renderizar
    expect(screen.queryByTestId("dashboard")).toBeNull();
  });

  it("sem share pendente nem query, mantém o usuário em '/'", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });

  it("ShareCirurgia preenche o texto via sessionStorage quando a URL chega sem query", () => {
    sessionStorage.setItem(
      "pending_share_surgery",
      JSON.stringify({ text: "Mensagem sem query" })
    );
    render(
      <MemoryRouter initialEntries={["/share-cirurgia"]}>
        <App />
      </MemoryRouter>
    );
    const raw = screen.getByTestId("raw") as HTMLTextAreaElement;
    expect(raw.value).toBe("Mensagem sem query");
  });
});
