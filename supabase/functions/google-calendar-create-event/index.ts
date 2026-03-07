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

async function getValidAccessToken(
  connection: any,
  calendarUserId: string,
  clientId: string,
  clientSecret: string,
  supabaseService: any
): Promise<string | null> {
  let accessToken = connection.access_token;
  const tokenExpiry = new Date(connection.token_expires_at);

  if (tokenExpiry <= new Date()) {
    const refreshed = await refreshAccessToken(connection.refresh_token, clientId, clientSecret);
    if (!refreshed) return null;

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

  return accessToken;
}

function authenticateRequest(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
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

    const userId = authenticateRequest(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user exists
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const verifyResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=id&id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers: { apikey: supabaseAnonKey, Authorization: authHeader } }
    );

    if (verifyResponse.status === 401 || verifyResponse.status === 403) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      action, // "create" (default), "update", "delete"
      patient_name,
      procedure,
      hospital,
      surgery_date,
      notes,
      patient_id,
      target_user_id,
      existing_event_id, // Google Calendar event ID for update/delete
    } = body;

    const effectiveAction = action || "create";
    const calendarUserId = target_user_id || userId;

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

    const accessToken = await getValidAccessToken(
      connection, calendarUserId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, supabaseService
    );

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Failed to refresh Google token", connected: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const calendarBaseUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const timezone = connection.calendar_timezone || "America/Sao_Paulo";

    // === DELETE ===
    if (effectiveAction === "delete") {
      if (!existing_event_id) {
        return new Response(
          JSON.stringify({ success: true, message: "No event to delete" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const deleteResponse = await fetch(`${calendarBaseUrl}/${existing_event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // 204 = success, 410 = already deleted
      if (deleteResponse.ok || deleteResponse.status === 204 || deleteResponse.status === 410) {
        // Clear event ID from patient
        if (patient_id) {
          await supabaseService
            .from("patients")
            .update({ google_calendar_event_id: null })
            .eq("id", patient_id);
        }

        return new Response(
          JSON.stringify({ success: true, deleted: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.error(`Delete event failed [${deleteResponse.status}]:`, await deleteResponse.text());
      return new Response(
        JSON.stringify({ error: "Falha ao excluir evento do Google Agenda" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === CREATE or UPDATE ===
    if (!surgery_date || !patient_name) {
      return new Response(
        JSON.stringify({ error: "surgery_date and patient_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const startDate = new Date(surgery_date);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2);

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
      start: { dateTime: startDate.toISOString(), timeZone: timezone },
      end: { dateTime: endDate.toISOString(), timeZone: timezone },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "popup", minutes: 1440 },
        ],
      },
    };

    let url = calendarBaseUrl;
    let method = "POST";

    // If updating an existing event
    if (effectiveAction === "update" && existing_event_id) {
      url = `${calendarBaseUrl}/${existing_event_id}`;
      method = "PUT";
    }

    const calendarResponse = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(calendarEvent),
    });

    if (!calendarResponse.ok) {
      // If update fails (event deleted externally), fall back to create
      if (method === "PUT" && (calendarResponse.status === 404 || calendarResponse.status === 410)) {
        console.log("Event not found, creating new one...");
        const createResponse = await fetch(calendarBaseUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(calendarEvent),
        });

        if (!createResponse.ok) {
          console.error(`Create fallback failed [${createResponse.status}]:`, await createResponse.text());
          return new Response(
            JSON.stringify({ error: "Falha ao criar evento no Google Agenda" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const created = await createResponse.json();
        if (patient_id) {
          await supabaseService
            .from("patients")
            .update({ google_calendar_event_id: created.id })
            .eq("id", patient_id);
        }

        return new Response(
          JSON.stringify({ success: true, event_id: created.id, event_link: created.htmlLink }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errText = await calendarResponse.text();
      console.error(`Google Calendar API error [${calendarResponse.status}]:`, errText);
      return new Response(
        JSON.stringify({ error: "Falha ao criar evento no Google Agenda" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultEvent = await calendarResponse.json();

    // Save event ID to patient record
    if (patient_id) {
      await supabaseService
        .from("patients")
        .update({ google_calendar_event_id: resultEvent.id })
        .eq("id", patient_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: resultEvent.id,
        event_link: resultEvent.htmlLink,
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
