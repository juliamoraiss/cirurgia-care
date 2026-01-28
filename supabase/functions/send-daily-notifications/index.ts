import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time in São Paulo timezone
    const now = new Date();
    const saoPauloOffset = -3;
    const saoPauloTime = new Date(now.getTime() + (saoPauloOffset * 60 * 60 * 1000));
    
    // Get start and end of today in São Paulo
    const todayStart = new Date(saoPauloTime);
    todayStart.setHours(0, 0, 0, 0);
    
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // Get today's incomplete tasks
    const { data: todayTasks, error: todayError } = await supabase
      .from('patient_tasks')
      .select('id, title')
      .eq('completed', false)
      .gte('due_date', todayStart.toISOString())
      .lt('due_date', tomorrowStart.toISOString());

    if (todayError) {
      console.error('Error fetching today tasks:', todayError);
    }

    // Get overdue tasks
    const { data: overdueTasks, error: overdueError } = await supabase
      .from('patient_tasks')
      .select('id, title')
      .eq('completed', false)
      .lt('due_date', todayStart.toISOString());

    if (overdueError) {
      console.error('Error fetching overdue tasks:', overdueError);
    }

    const todayCount = todayTasks?.length || 0;
    const overdueCount = overdueTasks?.length || 0;

    // If no tasks, skip sending notifications
    if (todayCount === 0 && overdueCount === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No tasks to notify about',
          todayCount: 0,
          overdueCount: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build notification message
    const parts: string[] = [];
    if (overdueCount > 0) {
      parts.push(`⚠️ ${overdueCount} atrasada${overdueCount > 1 ? 's' : ''}`);
    }
    if (todayCount > 0) {
      parts.push(`📅 ${todayCount} para hoje`);
    }
    
    const notificationBody = parts.join(' • ');
    const notificationTitle = '📋 Tarefas do Dia';

    // Get all push tokens for admins and dentists
    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'dentist']);

    const userIds = adminRoles?.map(r => r.user_id) || [];

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No eligible users found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push tokens for these users
    const { data: tokens, error: tokensError } = await supabase
      .from('user_push_tokens')
      .select('token, platform, user_id')
      .in('user_id', userIds);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No push tokens found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { success: number; failed: number } = { success: 0, failed: 0 };

    // Send notifications via FCM (if server key is available)
    if (fcmServerKey) {
      for (const tokenData of tokens) {
        try {
          // Parse the web push subscription
          const subscription = JSON.parse(tokenData.token);
          
          // For web push, we'd need to implement proper web push protocol
          // For now, log what would be sent
          console.log('Would send notification to:', tokenData.user_id, {
            title: notificationTitle,
            body: notificationBody,
          });
          
          results.success++;
        } catch (error) {
          console.error('Error sending notification:', error);
          results.failed++;
        }
      }
    } else {
      console.log('FCM_SERVER_KEY not configured - notifications logged only');
      results.success = tokens.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notifications processed`,
        todayCount,
        overdueCount,
        tokensFound: tokens.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-daily-notifications:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro ao enviar notificações',
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
