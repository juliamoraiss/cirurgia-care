import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    console.error("Token refresh failed:", await response.text());
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

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let userId: string | null = null;
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsData?.claims?.sub) {
      userId = claimsData.claims.sub as string;
    }

    if (!userId) {
      const supabaseServiceAuth = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: userData, error: userError } = await supabaseServiceAuth.auth.getUser(token);
      if (userData?.user?.id) {
        userId = userData.user.id;
      }

      if (!userId) {
        console.error("Auth validation failed", {
          claimsError: claimsError?.message,
          userError: userError?.message,
        });
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const user = { id: userId };

    const {
      patient_name,
      procedure,
      hospital,
      surgery_date,
      notes,
      patient_id,
      target_user_id,
    } = await req.json();

    if (!surgery_date || !patient_name) {
      return new Response(
        JSON.stringify({ error: "surgery_date and patient_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calendarUserId = target_user_id || user.id;

    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Google Calendar connection
    const { data: connection, error: connError } = await supabaseService
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", calendarUserId)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: "Google Calendar not connected", connected: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = connection.access_token;

    // Refresh token if expired
    const tokenExpiry = new Date(connection.token_expires_at);
    if (tokenExpiry <= new Date()) {
      const refreshed = await refreshAccessToken(
        connection.refresh_token,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );

      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google token", connected: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        .eq("user_id", calendarUserId);
    }

    // Build event
    const startDate = new Date(surgery_date);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2); // Default 2h duration

    const summary = `Cirurgia - ${patient_name} - ${procedure || "Procedimento"}`;
    const location = hospital || undefined;

    const descriptionParts: string[] = [];
    descriptionParts.push(`Paciente: ${patient_name}`);
    if (procedure) descriptionParts.push(`Procedimento: ${procedure}`);
    if (hospital) descriptionParts.push(`Hospital: ${hospital}`);
    if (notes) descriptionParts.push(`\nObservações:\n${notes}`);
    descriptionParts.push(`\n— Criado automaticamente pelo MedSystem`);

    const calendarEvent = {
      summary,
      location,
      description: descriptionParts.join("\n"),
      start: {
        dateTime: startDate.toISOString(),
        timeZone: connection.calendar_timezone || "America/Sao_Paulo",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: connection.calendar_timezone || "America/Sao_Paulo",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 1440 }, // 1 day before
        ],
      },
    };

    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    if (!calendarResponse.ok) {
      const errText = await calendarResponse.text();
      console.error(`Google Calendar API error [${calendarResponse.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: "Falha ao criar evento no Google Agenda" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createdEvent = await calendarResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        event_id: createdEvent.id,
        event_link: createdEvent.htmlLink,
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
