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

    // Send notifications via Firebase Cloud Messaging
    const fcmServerKey = Deno.env.get('FIREBASE_SERVER_KEY');
    
    if (!fcmServerKey) {
      console.error('FIREBASE_SERVER_KEY not configured');
      throw new Error('Firebase server key not configured');
    }

    const results = await Promise.all(
      tokens.map(async ({ token, platform }) => {
        try {
          const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `key=${fcmServerKey}`,
            },
            body: JSON.stringify({
              to: token,
              notification: {
                title,
                body,
              },
              data: data || {},
              priority: 'high',
            }),
          });

          const result = await response.json();
          console.log(`Notification sent to ${platform}:`, result);
          return { token, success: response.ok, result };
        } catch (error) {
          console.error(`Error sending to ${platform}:`, error);
          return { token, success: false, error: (error as Error).message };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;

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
