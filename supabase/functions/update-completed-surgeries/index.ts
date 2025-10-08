import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all patients with scheduled surgeries in the past
    const now = new Date().toISOString()
    
    const { data: patients, error: fetchError } = await supabase
      .from('patients')
      .select('id, name, surgery_date')
      .eq('status', 'scheduled')
      .lt('surgery_date', now)
      .not('surgery_date', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    if (!patients || patients.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No surgeries to update', count: 0 }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Update all patients to completed status
    const patientIds = patients.map(p => p.id)
    
    const { error: updateError } = await supabase
      .from('patients')
      .update({ status: 'completed' })
      .in('id', patientIds)

    if (updateError) {
      throw updateError
    }

    console.log(`Updated ${patients.length} surgeries to completed status`)

    return new Response(
      JSON.stringify({ 
        message: 'Successfully updated surgeries', 
        count: patients.length,
        patients: patients.map(p => ({ id: p.id, name: p.name }))
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error updating surgeries:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
