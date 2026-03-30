import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BusySlot {
  start: string;
  end: string;
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number } | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Token refresh failed:", err);
    return null;
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "Google OAuth credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Manual JWT validation for Lovable Cloud compatibility
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, "+").replace(/_/g, "/")));
      userId = typeof payload?.sub === "string" ? payload.sub : null;
    } catch {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token by probing the REST API
    const verifyResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&id=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: authHeader,
        },
      }
    );

    if (verifyResponse.status === 401 || verifyResponse.status === 403) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = { id: userId };

    const { time_min, time_max, target_user_id } = await req.json();
    console.log(`[availability] userId=${userId}, target_user_id=${target_user_id || 'self'}, time_min=${time_min}, time_max=${time_max}`);

    if (!time_min || !time_max) {
      return new Response(
        JSON.stringify({ error: "time_min and time_max are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow admins to check other users' availability
    const queryUserId = target_user_id || user.id;

    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the user's Google Calendar connection
    const { data: connection, error: connError } = await supabaseService
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", queryUserId)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Google Calendar not connected", connected: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = connection.access_token;

    // Check if token is expired, refresh if needed
    const tokenExpiry = new Date(connection.token_expires_at);
    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(
        connection.refresh_token,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );

      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google token. Please reconnect.", connected: false }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabaseService
        .from("google_calendar_connections")
        .update({
          access_token: accessToken,
          token_expires_at: newExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", queryUserId);
    }

    // Fetch events from Google Calendar (only start/end times)
    const params = new URLSearchParams({
      timeMin: time_min,
      timeMax: time_max,
      singleEvents: "true",
      orderBy: "startTime",
      fields: "items(start,end,status,transparency)",
    });

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!calendarResponse.ok) {
      const errText = await calendarResponse.text();
      console.error(`Google Calendar API error [${calendarResponse.status}]:`, errText);
      
      if (calendarResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: "Google token expired. Please reconnect.", connected: false }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to fetch calendar data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calendarData = await calendarResponse.json();

    // Extract only busy slots - no event details
    const busySlots: BusySlot[] = (calendarData.items || [])
      .filter((event: any) => {
        // Skip cancelled events
        if (event.status === "cancelled") return false;
        // Skip transparent events (free/available)
        if (event.transparency === "transparent") return false;
        return true;
      })
      .map((event: any) => {
        // Handle all-day events
        if (event.start?.date) {
          return {
            start: new Date(event.start.date).toISOString(),
            end: new Date(event.end.date).toISOString(),
            allDay: true,
          };
        }
        return {
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          allDay: false,
        };
      });

    // Merge overlapping busy slots
    const merged = mergeBusySlots(busySlots);

    return new Response(
      JSON.stringify({
        busy_slots: merged,
        timezone: connection.calendar_timezone,
        fetched_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function mergeBusySlots(slots: any[]): any[] {
  if (slots.length === 0) return [];

  const sorted = [...slots].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const merged: any[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (new Date(current.start) <= new Date(last.end)) {
      last.end =
        new Date(current.end) > new Date(last.end) ? current.end : last.end;
      last.allDay = last.allDay || current.allDay;
    } else {
      merged.push(current);
    }
  }

  return merged;
}
