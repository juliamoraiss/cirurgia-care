import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { hasShareIntent, readShareIntentFromSearch } from "@/lib/shareIntent";

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

// Capture WhatsApp/iOS share intent BEFORE any auth redirect happens.
// On iOS PWAs the app may open at "/" (start_url) with share params, and
// when the user is logged out the auth redirect would otherwise drop them.
(() => {
  try {
    const payload = readShareIntentFromSearch(window.location.search);
    if (hasShareIntent(payload)) {
      const serialized = JSON.stringify({ ...payload, at: Date.now() });
      sessionStorage.setItem("pending_share_surgery", serialized);
    }
  } catch {
    /* ignore */
  }
})();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
