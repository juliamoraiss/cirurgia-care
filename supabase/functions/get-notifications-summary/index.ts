import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const notificationToken = Deno.env.get('NOTIFICATION_TOKEN');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate token if provided
    const url = new URL(req.url);
    const providedToken = url.searchParams.get('token');
    
    const isValidToken = providedToken && providedToken === notificationToken;

    // Get overdue tasks
    const { data: overdueTasks, error: overdueError } = await supabase
      .from('patient_tasks')
      .select(`
        id,
        title,
        due_date,
        task_type,
        patient_id,
        patients!inner (
          id,
          name,
          phone
        )
      `)
      .eq('completed', false)
      .lt('due_date', new Date().toISOString())
      .order('due_date', { ascending: true });

    if (overdueError) {
      console.error('Error fetching overdue tasks:', overdueError);
    }

    // Get today's tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: todayTasks, error: todayError } = await supabase
      .from('patient_tasks')
      .select(`
        id,
        title,
        due_date,
        task_type,
        patient_id,
        patients!inner (
          id,
          name,
          phone
        )
      `)
      .eq('completed', false)
      .gte('due_date', today.toISOString())
      .lt('due_date', tomorrow.toISOString())
      .order('due_date', { ascending: true });

    if (todayError) {
      console.error('Error fetching today tasks:', todayError);
    }

    // Get new patients (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const { data: newPatients, error: patientsError } = await supabase
      .from('patients')
      .select('id, name, procedure, created_at')
      .gte('created_at', last24Hours.toISOString())
      .order('created_at', { ascending: false });

    if (patientsError) {
      console.error('Error fetching new patients:', patientsError);
    }

    // Get upcoming surgeries (today and next 2 days)
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const { data: upcomingSurgeries, error: surgeriesError } = await supabase
      .from('patients')
      .select('id, name, procedure, surgery_date, hospital')
      .not('surgery_date', 'is', null)
      .gte('surgery_date', today.toISOString())
      .lt('surgery_date', dayAfterTomorrow.toISOString())
      .order('surgery_date', { ascending: true });

    if (surgeriesError) {
      console.error('Error fetching upcoming surgeries:', surgeriesError);
    }

    // Get the base URL from environment or use default
    const baseUrl = 'https://medsystem.lovable.app';

    // Format response based on token validation
    const overdueTasksFormatted = (overdueTasks || []).map(task => ({
      patient_name: isValidToken ? (task.patients as any)?.name : '***',
      patient_id: isValidToken ? (task.patients as any)?.id : null,
      task_id: task.id,
      task_title: task.title,
      due_date: task.due_date,
      task_type: task.task_type,
      task_url: `${baseUrl}/tasks`,
    }));

    const todayTasksFormatted = (todayTasks || []).map(task => ({
      patient_name: isValidToken ? (task.patients as any)?.name : '***',
      patient_id: isValidToken ? (task.patients as any)?.id : null,
      task_id: task.id,
      task_title: task.title,
      due_date: task.due_date,
      task_type: task.task_type,
      task_url: `${baseUrl}/tasks`,
    }));

    const newPatientsFormatted = (newPatients || []).map(patient => ({
      name: isValidToken ? patient.name : '***',
      procedure: patient.procedure,
      created_at: patient.created_at,
    }));

    const upcomingSurgeriesFormatted = (upcomingSurgeries || []).map(surgery => ({
      patient_name: isValidToken ? surgery.name : '***',
      procedure: surgery.procedure,
      surgery_date: surgery.surgery_date,
      hospital: isValidToken ? surgery.hospital : '***',
    }));

    // Build summary text
    const summaryParts = [];
    
    if (overdueTasksFormatted.length > 0) {
      summaryParts.push(`⚠️ ${overdueTasksFormatted.length} tarefa${overdueTasksFormatted.length > 1 ? 's' : ''} atrasada${overdueTasksFormatted.length > 1 ? 's' : ''}`);
    }
    
    if (todayTasksFormatted.length > 0) {
      summaryParts.push(`📅 ${todayTasksFormatted.length} tarefa${todayTasksFormatted.length > 1 ? 's' : ''} hoje`);
    }
    
    if (newPatientsFormatted.length > 0) {
      summaryParts.push(`👤 ${newPatientsFormatted.length} novo${newPatientsFormatted.length > 1 ? 's' : ''} paciente${newPatientsFormatted.length > 1 ? 's' : ''}`);
    }
    
    if (upcomingSurgeriesFormatted.length > 0) {
      summaryParts.push(`🏥 ${upcomingSurgeriesFormatted.length} cirurgia${upcomingSurgeriesFormatted.length > 1 ? 's' : ''} próxima${upcomingSurgeriesFormatted.length > 1 ? 's' : ''}`);
    }

    const summary = summaryParts.length > 0 
      ? summaryParts.join(', ')
      : '✅ Tudo em dia!';

    const response = {
      overdue_tasks: {
        count: overdueTasksFormatted.length,
        tasks: overdueTasksFormatted,
      },
      today_tasks: {
        count: todayTasksFormatted.length,
        tasks: todayTasksFormatted,
      },
      new_patients_today: {
        count: newPatientsFormatted.length,
        patients: newPatientsFormatted,
      },
      upcoming_surgeries: {
        count: upcomingSurgeriesFormatted.length,
        surgeries: upcomingSurgeriesFormatted,
      },
      summary,
      authenticated: isValidToken,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-notifications-summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        summary: '❌ Erro ao buscar notificações',
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
