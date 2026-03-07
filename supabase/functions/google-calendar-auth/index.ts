import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const payload = await req.json().catch(() => ({}));
    const { action, code, redirect_uri } = payload;

    // Action: get_auth_url - returns the Google OAuth URL
    if (action === "get_auth_url") {
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirect_uri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        access_type: "offline",
        prompt: "consent",
        state: user.id,
      });
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return new Response(
        JSON.stringify({ url: authUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: exchange_code - exchange authorization code for tokens
    if (action === "exchange_code") {
      if (!code || !redirect_uri) {
        return new Response(
          JSON.stringify({ error: "Missing code or redirect_uri" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        console.error("Google token exchange failed:", tokenData);
        return new Response(
          JSON.stringify({
            error:
              tokenData?.error_description ||
              tokenData?.error ||
              "Falha ao trocar o código de autorização",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!tokenData?.access_token || !tokenData?.expires_in) {
        return new Response(
          JSON.stringify({ error: "Resposta inválida do Google OAuth" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Use service role to store tokens
      const supabaseService = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Google may omit refresh_token on subsequent consents; keep previously stored one
      let refreshTokenToStore = tokenData.refresh_token as string | undefined;
      if (!refreshTokenToStore) {
        const { data: existingConnection } = await supabaseService
          .from("google_calendar_connections")
          .select("refresh_token")
          .eq("user_id", user.id)
          .maybeSingle();

        refreshTokenToStore = existingConnection?.refresh_token;
      }

      if (!refreshTokenToStore) {
        return new Response(
          JSON.stringify({
            error:
              "Não foi possível obter refresh_token do Google. Remova o acesso do app nas permissões da conta Google e tente conectar novamente.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: upsertError } = await supabaseService
        .from("google_calendar_connections")
        .upsert({
          user_id: user.id,
          access_token: tokenData.access_token,
          refresh_token: refreshTokenToStore,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) {
        console.error("Failed to store tokens:", upsertError);
        return new Response(
          JSON.stringify({ error: "Falha ao salvar conexão do Google Agenda" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: disconnect - remove connection
    if (action === "disconnect") {
      const supabaseService = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Revoke Google token
      const { data: conn } = await supabaseService
        .from("google_calendar_connections")
        .select("access_token")
        .eq("user_id", user.id)
        .single();

      if (conn?.access_token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${conn.access_token}`, {
          method: "POST",
        });
      }

      await supabaseService
        .from("google_calendar_connections")
        .delete()
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: status - check if connected
    if (action === "status") {
      const supabaseService = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data } = await supabaseService
        .from("google_calendar_connections")
        .select("connected_at, calendar_timezone")
        .eq("user_id", user.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({ connected: !!data, connection: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
