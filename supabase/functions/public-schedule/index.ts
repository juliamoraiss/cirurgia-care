import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, token, slot } = await req.json();

    if (!token || typeof token !== "string") {
      return json({ error: "Token inválido" }, 400);
    }

    // Use service role to bypass RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate the token
    const { data: link, error: linkError } = await supabase
      .from("scheduling_links")
      .select("*")
      .eq("token", token)
      .single();

    if (linkError || !link) {
      return json({ error: "Link não encontrado" }, 404);
    }

    if (link.used_at) {
      return json({ error: "Este link já foi utilizado", status: "used" }, 410);
    }

    if (new Date(link.expires_at) < new Date()) {
      return json({ error: "Este link expirou", status: "expired" }, 410);
    }

    // Get patient info (minimal data)
    const { data: patient } = await supabase
      .from("patients")
      .select("id, name, procedure, hospital")
      .eq("id", link.patient_id)
      .single();

    if (!patient) {
      return json({ error: "Paciente não encontrado" }, 404);
    }

    // Get doctor name
    const { data: doctorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", link.doctor_id)
      .single();

    if (action === "get_slots") {
      // Get doctor's surgery availability
      const { data: availability } = await supabase
        .from("surgery_availability")
        .select("*")
        .eq("doctor_id", link.doctor_id)
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");

      if (!availability || availability.length === 0) {
        return json({
          patient_name: patient.name,
          procedure: patient.procedure,
          hospital: patient.hospital,
          doctor_name: doctorProfile?.full_name || "Médico",
          slots: [],
          message: "Nenhum horário disponível no momento",
        });
      }

      // Get existing surgeries for the next 30 days
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { data: existingSurgeries } = await supabase
        .from("patients")
        .select("surgery_date")
        .eq("responsible_user_id", link.doctor_id)
        .not("surgery_date", "is", null)
        .gte("surgery_date", now.toISOString())
        .lte("surgery_date", thirtyDaysLater.toISOString());

      // Get schedule blocks for the doctor
      const { data: scheduleBlocks } = await supabase
        .from("schedule_blocks")
        .select("start_date, end_date")
        .eq("doctor_id", link.doctor_id)
        .gte("end_date", now.toISOString().split("T")[0]);

      // Build available slots for the next 30 days
      const slots: { date: string; time: string; datetime: string }[] = [];

      for (let d = 1; d <= 30; d++) {
        const date = new Date(now);
        date.setDate(date.getDate() + d);
        const dayOfWeek = date.getDay();

        const daySlots = availability.filter(
          (a: any) => a.day_of_week === dayOfWeek
        );

        for (const slot of daySlots) {
          // Count surgeries already on this day for this slot config
          const dateStr = date.toISOString().split("T")[0];

          const surgeriesOnDay = (existingSurgeries || []).filter((s: any) => {
            const sDate = new Date(s.surgery_date).toISOString().split("T")[0];
            return sDate === dateStr;
          });

          if (surgeriesOnDay.length >= slot.max_surgeries_per_day) {
            continue;
          }

          // Generate time slots based on start_time, end_time, and duration
          const [startH, startM] = slot.start_time.split(":").map(Number);
          const [endH, endM] = slot.end_time.split(":").map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          const duration = slot.default_duration_minutes;

          for (let t = startMinutes; t + duration <= endMinutes; t += duration) {
            const slotH = Math.floor(t / 60);
            const slotM = t % 60;
            const timeStr = `${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}`;

            // Check if this specific time slot is already taken
            const slotDatetime = `${dateStr}T${timeStr}:00`;
            const isTaken = (existingSurgeries || []).some((s: any) => {
              const sTime = new Date(s.surgery_date);
              const sStr = `${sTime.getFullYear()}-${String(sTime.getMonth() + 1).padStart(2, "0")}-${String(sTime.getDate()).padStart(2, "0")}T${String(sTime.getHours()).padStart(2, "0")}:${String(sTime.getMinutes()).padStart(2, "0")}:00`;
              return sStr === slotDatetime;
            });

            if (!isTaken) {
              // Build full ISO datetime in Brasilia timezone (UTC-3)
              const fullDatetime = new Date(`${dateStr}T${timeStr}:00-03:00`).toISOString();
              slots.push({
                date: dateStr,
                time: timeStr,
                datetime: fullDatetime,
              });
            }
          }
        }
      }

      return json({
        patient_name: patient.name,
        procedure: patient.procedure,
        hospital: patient.hospital,
        doctor_name: doctorProfile?.full_name || "Médico",
        slots,
      });
    }

    if (action === "confirm") {
      if (!slot || typeof slot !== "string") {
        return json({ error: "Horário não informado" }, 400);
      }

      // Re-check link is still valid (race condition protection)
      const { data: freshLink } = await supabase
        .from("scheduling_links")
        .select("used_at")
        .eq("token", token)
        .single();

      if (freshLink?.used_at) {
        return json({ error: "Este link já foi utilizado" }, 410);
      }

      // Update patient surgery_date and status
      const { error: updateError } = await supabase
        .from("patients")
        .update({
          surgery_date: slot,
          status: "surgery_scheduled",
        })
        .eq("id", link.patient_id);

      if (updateError) {
        console.error("Error updating patient:", updateError);
        return json({ error: "Erro ao agendar cirurgia" }, 500);
      }

      // Mark link as used
      await supabase
        .from("scheduling_links")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      // Try to sync with Google Calendar
      try {
        const { data: calConnection } = await supabase
          .from("google_calendar_connections")
          .select("*")
          .eq("user_id", link.doctor_id)
          .single();

        if (calConnection) {
          // Call the existing google-calendar-create-event function internally
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

          await fetch(`${supabaseUrl}/functions/v1/google-calendar-create-event`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              action: "create",
              patient_name: patient.name,
              procedure: patient.procedure,
              hospital: patient.hospital,
              surgery_date: slot,
              patient_id: patient.id,
              target_user_id: link.doctor_id,
            }),
          });
        }
      } catch (calError) {
        console.warn("Could not sync Google Calendar:", calError);
      }

      const scheduledDate = new Date(slot);
      return json({
        success: true,
        message: "Cirurgia agendada com sucesso!",
        scheduled_date: scheduledDate.toISOString(),
        hospital: patient.hospital,
      });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err) {
    console.error("Error in public-schedule:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
