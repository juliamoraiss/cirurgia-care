import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Preserve Google OAuth code BEFORE Supabase client can consume it
(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  if (code && state === "google_calendar") {
    sessionStorage.setItem("google_calendar_code", code);
    // Clean URL immediately to prevent Supabase from intercepting
    window.history.replaceState({}, "", window.location.pathname);
  }
})();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
