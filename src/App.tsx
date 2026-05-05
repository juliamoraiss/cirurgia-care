import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";

function RedirectSchedule() {
  const { token } = useParams<{ token: string }>();
  return <Navigate to={`/agendar/${token}`} replace />;
}

// Captura compartilhamentos vindos do iOS Shortcut / share_target
// que caem em "/" com ?text=, ?title= ou ?url= e leva para /share-cirurgia.
// Também consome um intent salvo em sessionStorage (caso a URL tenha sido
// limpa por redirect de auth no iOS PWA).
function HomeOrShareCapture({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.get("text") || params.get("title") || params.get("url")) {
    return <Navigate to={`/share-cirurgia${location.search}`} replace />;
  }
  try {
    const pending = sessionStorage.getItem("pending_share_surgery");
    if (pending) {
      const data = JSON.parse(pending);
      const sp = new URLSearchParams();
      if (data.text) sp.set("text", data.text);
      if (data.title) sp.set("title", data.title);
      if (data.url) sp.set("url", data.url);
      sessionStorage.removeItem("pending_share_surgery");
      return <Navigate to={`/share-cirurgia?${sp.toString()}`} replace />;
    }
  } catch {
    /* ignore */
  }
  return <>{children}</>;
}
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./components/ThemeProvider";
import { Layout } from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientForm from "./pages/PatientForm";
import PatientExams from "./pages/PatientExams";
import Calendar from "./pages/Calendar";
import UserManagement from "./pages/UserManagement";
import PendingUsers from "./pages/PendingUsers";
import PendingApproval from "./pages/PendingApproval";
import Tasks from "./pages/Tasks";
import PaidTraffic from "./pages/PaidTraffic";
import SurgeryAvailability from "./pages/SurgeryAvailability";
import NotFound from "./pages/NotFound";
import PublicSchedule from "./pages/PublicSchedule";
import ShareCirurgia from "./pages/ShareCirurgia";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const redirectTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  if (!isApproved) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/pending-approval" element={<PendingApproval />} />
      <Route
        path="/"
        element={
          <HomeOrShareCapture>
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </HomeOrShareCapture>
        }
      />
      <Route
        path="/patients"
        element={
          <ProtectedRoute>
            <Patients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/new"
        element={
          <ProtectedRoute>
            <PatientForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id"
        element={
          <ProtectedRoute>
            <PatientForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:id/exams"
        element={
          <ProtectedRoute>
            <PatientExams />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <Calendar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pending-users"
        element={
          <ProtectedRoute>
            <PendingUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/paid-traffic"
        element={
          <ProtectedRoute>
            <PaidTraffic />
          </ProtectedRoute>
        }
      />
      <Route
        path="/surgery-availability"
        element={
          <ProtectedRoute>
            <SurgeryAvailability />
          </ProtectedRoute>
        }
      />
      <Route path="/agendar/:token" element={<PublicSchedule />} />
      <Route path="/schedule/:token" element={<RedirectSchedule />} />
      <Route
        path="/share-cirurgia"
        element={
          <ProtectedRoute>
            <ShareCirurgia />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <AppRoutes />
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;