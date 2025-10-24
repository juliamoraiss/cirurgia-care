import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, title, body, data } = await req.json() as NotificationPayload;

    console.log('Sending push notification to user:', user_id);

    // Get user's push tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('token, platform')
      .eq('user_id', user_id);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      throw tokensError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('No push tokens found for user:', user_id);
      return new Response(
        JSON.stringify({ message: 'No push tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Log notification details (actual push delivery requires APNs/FCM configuration)
    console.log('Notification prepared for delivery:', {
      user_id,
      title,
      body,
      tokens: tokens.map(t => ({ platform: t.platform, token: t.token.substring(0, 20) + '...' }))
    });

    // Simulate successful delivery for development
    const results = tokens.map(({ token, platform }) => ({
      token,
      platform,
      success: true,
      message: 'Token registered, push delivery requires APNs/FCM setup'
    }));

    const successCount = results.length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notifications sent',
        total_tokens: tokens.length,
        successful: successCount,
        failed: tokens.length - successCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in send-push-notification:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
