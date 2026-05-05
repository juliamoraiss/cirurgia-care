// Integration tests for the check_surgery_collision trigger.
// Verifies that the 1-hour collision window blocks insert/update of conflicting surgeries.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEYS") ??
  "";

if (!SERVICE_KEY) {
  console.warn("[collision_test] No service role key in env — skipping integration tests.");
}

const admin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : (null as any);

const skip = !SERVICE_KEY;

async function pickUserId(): Promise<string> {
  const { data, error } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "doctor", "dentist"])
    .limit(1);
  if (error) throw error;
  assert(data && data.length > 0, "No user available to use as responsible_user_id");
  return data[0].user_id;
}

const TAG = `__collision_test_${crypto.randomUUID().slice(0, 8)}`;

async function cleanup() {
  await admin.from("patients").delete().ilike("name", `${TAG}%`);
}

async function insertPatient(name: string, surgery_date: string | null, userId: string) {
  return await admin
    .from("patients")
    .insert({
      name,
      procedure: "Rinoplastia",
      surgery_date,
      status: surgery_date ? "surgery_scheduled" : "awaiting_authorization",
      responsible_user_id: userId,
      created_by: userId,
      origem: "whatsapp",
    })
    .select("id")
    .single();
}

Deno.test("surgery collision: blocks insert within 1h window for same patient", async () => {
  const userId = await pickUserId();
  await cleanup();
  try {
    const base = new Date(Date.UTC(2030, 0, 15, 13, 0, 0)); // 10:00 SP
    const name = `${TAG} Maria Silva`;

    const first = await insertPatient(name, base.toISOString(), userId);
    assertEquals(first.error, null, `First insert should succeed: ${first.error?.message}`);

    // 30 minutes later → should fail
    const within = new Date(base.getTime() + 30 * 60_000).toISOString();
    const second = await insertPatient(name, within, userId);
    assert(second.error, "Second insert within 1h should fail");
    assert(
      second.error!.message.includes("SURGERY_COLLISION"),
      `Expected SURGERY_COLLISION error, got: ${second.error!.message}`,
    );
    assert(
      second.error!.message.includes("1h"),
      `Error should mention 1h window, got: ${second.error!.message}`,
    );
  } finally {
    await cleanup();
  }
});

Deno.test("surgery collision: allows insert exactly 1h apart (boundary)", async () => {
  const userId = await pickUserId();
  await cleanup();
  try {
    const base = new Date(Date.UTC(2030, 1, 10, 13, 0, 0));
    const name = `${TAG} Joao Pereira`;

    const first = await insertPatient(name, base.toISOString(), userId);
    assertEquals(first.error, null);

    // Exactly 60 min later → strict `<` window means equal is allowed
    const boundary = new Date(base.getTime() + 60 * 60_000).toISOString();
    const second = await insertPatient(name, boundary, userId);
    assertEquals(second.error, null, `Boundary (=1h) should be allowed: ${second.error?.message}`);
  } finally {
    await cleanup();
  }
});

Deno.test("surgery collision: ignores accents/case when matching same patient", async () => {
  const userId = await pickUserId();
  await cleanup();
  try {
    const base = new Date(Date.UTC(2030, 2, 20, 13, 0, 0));
    const first = await insertPatient(`${TAG} José Antônio`, base.toISOString(), userId);
    assertEquals(first.error, null);

    const within = new Date(base.getTime() + 15 * 60_000).toISOString();
    const second = await insertPatient(`${TAG} JOSE ANTONIO`, within, userId);
    assert(second.error && second.error.message.includes("SURGERY_COLLISION"));
  } finally {
    await cleanup();
  }
});

Deno.test("surgery collision: different patients in same window are allowed", async () => {
  const userId = await pickUserId();
  await cleanup();
  try {
    const base = new Date(Date.UTC(2030, 3, 5, 13, 0, 0));
    const first = await insertPatient(`${TAG} Carlos Lima`, base.toISOString(), userId);
    assertEquals(first.error, null);

    const within = new Date(base.getTime() + 15 * 60_000).toISOString();
    const second = await insertPatient(`${TAG} Renata Souza`, within, userId);
    assertEquals(second.error, null, `Different patient should be allowed: ${second.error?.message}`);
  } finally {
    await cleanup();
  }
});

Deno.test("surgery collision: blocks UPDATE that moves date into 1h window of other surgery", async () => {
  const userId = await pickUserId();
  await cleanup();
  try {
    const baseA = new Date(Date.UTC(2030, 4, 12, 13, 0, 0));
    const name = `${TAG} Ana Beatriz`;

    const a = await insertPatient(name, baseA.toISOString(), userId);
    assertEquals(a.error, null);

    const farAway = new Date(baseA.getTime() + 5 * 60 * 60_000).toISOString();
    const b = await insertPatient(name, farAway, userId);
    assertEquals(b.error, null);

    // Move B to 20 min after A → should fail
    const conflict = new Date(baseA.getTime() + 20 * 60_000).toISOString();
    const upd = await admin
      .from("patients")
      .update({ surgery_date: conflict })
      .eq("id", b.data!.id)
      .select("id")
      .single();
    assert(upd.error, "Update into 1h window should fail");
    assert(upd.error!.message.includes("SURGERY_COLLISION"));
  } finally {
    await cleanup();
  }
});
