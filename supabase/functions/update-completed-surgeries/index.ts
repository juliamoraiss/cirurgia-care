import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting surgery status update...')

    // 1. Atualizar status de cirurgias concluídas (data/hora já passou)
    const now = new Date().toISOString()
    
    const { data: completedSurgeries, error: updateError } = await supabase
      .from('patients')
      .update({ status: 'completed' })
      .eq('status', 'authorized')
      .not('surgery_date', 'is', null)
      .lt('surgery_date', now)
      .select()

    if (updateError) {
      console.error('Error updating completed surgeries:', updateError)
      throw updateError
    }

    console.log(`Updated ${completedSurgeries?.length || 0} surgeries to completed status`)

    // 2. Criar tarefas de lembrete pré-operatório (1 dia antes da cirurgia)
    const oneDayFromNow = new Date()
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1)
    oneDayFromNow.setHours(0, 0, 0, 0)

    const twoDaysFromNow = new Date()
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2)
    twoDaysFromNow.setHours(0, 0, 0, 0)

    const { data: upcomingSurgeries, error: fetchError } = await supabase
      .from('patients')
      .select('id, name, procedure, hospital, surgery_date')
      .eq('status', 'authorized')
      .not('surgery_date', 'is', null)
      .gte('surgery_date', oneDayFromNow.toISOString())
      .lt('surgery_date', twoDaysFromNow.toISOString())

    if (fetchError) {
      console.error('Error fetching upcoming surgeries:', fetchError)
      throw fetchError
    }

    console.log(`Found ${upcomingSurgeries?.length || 0} surgeries in the next 24 hours`)

    // Criar tarefas de pré-operatório para cirurgias que ainda não têm
    if (upcomingSurgeries && upcomingSurgeries.length > 0) {
      for (const surgery of upcomingSurgeries) {
        // Verificar se já existe tarefa de pré-op para este paciente (completa ou não)
        const { data: existingTask } = await supabase
          .from('patient_tasks')
          .select('id')
          .eq('patient_id', surgery.id)
          .eq('task_type', 'pre_op_instructions')
          .maybeSingle()

        if (!existingTask) {
          // Criar tarefa para o dia antes da cirurgia (sem horário específico - meia-noite)
          const taskDueDate = new Date(surgery.surgery_date)
          taskDueDate.setDate(taskDueDate.getDate() - 1)
          taskDueDate.setHours(0, 0, 0, 0) // Meia-noite do dia anterior

          const { error: taskError } = await supabase
            .from('patient_tasks')
            .insert({
              patient_id: surgery.id,
              task_type: 'pre_op_instructions',
              title: 'Enviar instruções pré-operatórias',
              description: `Enviar instruções ao paciente ${surgery.name} para a cirurgia de ${surgery.procedure}`,
              due_date: taskDueDate.toISOString(),
              created_by: '00000000-0000-0000-0000-000000000000', // System user
            })

          if (taskError) {
            console.error(`Error creating pre-op task for patient ${surgery.id}:`, taskError)
          } else {
            console.log(`Created pre-op task for patient ${surgery.name}`)
          }
        }
      }
    }

    // 3. Criar tarefas pós-operatórias para cirurgias recém concluídas
    if (completedSurgeries && completedSurgeries.length > 0) {
      for (const surgery of completedSurgeries) {
        // Verificar se já existe tarefa pós-op para este paciente (completa ou não)
        const { data: existingTask } = await supabase
          .from('patient_tasks')
          .select('id')
          .eq('patient_id', surgery.id)
          .eq('task_type', 'post_op_instructions')
          .maybeSingle()

        if (!existingTask) {
          // Criar tarefa para o mesmo dia da cirurgia, 5 horas após
          const taskDueDate = new Date(surgery.surgery_date)
          taskDueDate.setHours(taskDueDate.getHours() + 5) // 5 horas após a cirurgia

          const { error: taskError } = await supabase
            .from('patient_tasks')
            .insert({
              patient_id: surgery.id,
              task_type: 'post_op_instructions',
              title: 'Enviar recomendações pós-operatórias',
              description: `Enviar recomendações ao paciente ${surgery.name}`,
              due_date: taskDueDate.toISOString(),
              created_by: '00000000-0000-0000-0000-000000000000', // System user
            })

          if (taskError) {
            console.error(`Error creating post-op task for patient ${surgery.id}:`, taskError)
          } else {
            console.log(`Created post-op task for patient ${surgery.name}`)
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        completedSurgeriesCount: completedSurgeries?.length || 0,
        upcomingSurgeriesCount: upcomingSurgeries?.length || 0,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in update-completed-surgeries function:', error)
    return new Response(
      JSON.stringify({ error: 'Erro ao processar atualização de cirurgias. Tente novamente.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
