import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { Layout } from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientForm from "./pages/PatientForm";
import PatientExams from "./pages/PatientExams";
import Calendar from "./pages/Calendar";
import UserManagement from "./pages/UserManagement";
import Tasks from "./pages/Tasks";
import PaidTraffic from "./pages/PaidTraffic";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import TestNotifications from "./pages/TestNotifications";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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
    return <Navigate to="/auth" replace />;
  }

  return <Layout>{children}</Layout>;
}

// Componente para inicializar push notifications
function AppWithNotifications() {
  // Chama o hook aqui para registrar assim que o app abre
  usePushNotifications();

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
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
        path="/paid-traffic"
        element={
          <ProtectedRoute>
            <PaidTraffic />
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-notifications"
        element={
          <ProtectedRoute>
            <TestNotifications />
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
          <AppWithNotifications />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;