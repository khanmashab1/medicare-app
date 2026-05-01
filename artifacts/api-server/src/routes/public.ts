import { Router, type IRouter } from "express";
import { admin } from "../lib/supabase";

const router: IRouter = Router();

router.get("/locations", async (_req, res) => {
  const { data, error } = await admin
    .from("doctors")
    .select("province, city")
    .not("province", "is", null)
    .not("city", "is", null);
  if (error) { res.status(500).json({ error: error.message }); return; }
  const map: Record<string, Set<string>> = {};
  for (const r of (data ?? []) as { province: string; city: string }[]) {
    if (!map[r.province]) map[r.province] = new Set();
    map[r.province].add(r.city);
  }
  res.json(
    Object.entries(map).map(([province, cities]) => ({
      province,
      cities: [...cities].sort(),
    })),
  );
});

router.get("/specialties", async (req, res) => {
  const { province, city } = req.query as Record<string, string>;
  if (!province || !city) {
    res.status(400).json({ error: "province and city required" });
    return;
  }
  let q = admin.from("doctors").select("specialty").eq("province", province).eq("city", city);
  const { data, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as { specialty: string }[]) {
    counts[r.specialty] = (counts[r.specialty] ?? 0) + 1;
  }
  res.json(
    Object.entries(counts).map(([specialty, doctor_count]) => ({ specialty, doctor_count })),
  );
});

router.get("/doctors", async (req, res) => {
  const { province, city, specialty } = req.query as Record<string, string>;
  if (!specialty) { res.status(400).json({ error: "specialty required" }); return; }

  let q = admin.from("doctors").select(
    "user_id, specialty, degree, qualifications, bio, fee, rating, experience_years, image_path, city, province, clinic_address, consultation_duration, max_patients_per_day, easypaisa_number, jazzcash_number, bank_name, bank_account_number, bank_account_title",
  ).eq("specialty", specialty);
  if (province) q = q.eq("province", province);
  if (city) q = q.eq("city", city);

  const { data: docs, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!docs || docs.length === 0) {
    const { data: anyDocs } = await admin.from("doctors").select(
      "user_id, specialty, degree, qualifications, bio, fee, rating, experience_years, image_path, city, province, clinic_address, consultation_duration, max_patients_per_day, easypaisa_number, jazzcash_number, bank_name, bank_account_number, bank_account_title",
    ).eq("specialty", specialty);
    if (!anyDocs || anyDocs.length === 0) { res.json([]); return; }
    return void res.json(await enrichWithNames(anyDocs as any[]));
  }
  res.json(await enrichWithNames(docs as any[]));
});

async function enrichWithNames(docs: { user_id: string }[]) {
  const ids = docs.map((d) => d.user_id);
  const { data: profs } = await admin.from("profiles").select("id, name").in("id", ids);
  const nameMap: Record<string, string> = {};
  for (const p of (profs ?? []) as { id: string; name: string }[]) nameMap[p.id] = p.name;
  return docs.map((d) => ({ ...d, name: nameMap[d.user_id] ?? "Doctor" }));
}

router.get("/doctors/:id/availability", async (req, res) => {
  const { id } = req.params;
  const { date } = req.query as Record<string, string>;
  if (!date) { res.status(400).json({ error: "date required" }); return; }

  const [docRes, bookedRes] = await Promise.all([
    admin.from("doctors").select("max_patients_per_day, consultation_duration, delay_minutes").eq("user_id", id).maybeSingle(),
    admin.from("appointments").select("token_number, status").eq("doctor_user_id", id).eq("appointment_date", date).neq("status", "Cancelled"),
  ]);

  const doc = docRes.data as { max_patients_per_day: number; consultation_duration: number; delay_minutes: number } | null;
  const booked = (bookedRes.data ?? []) as { token_number: number }[];

  res.json({
    max_patients_per_day: doc?.max_patients_per_day ?? 30,
    consultation_duration: doc?.consultation_duration ?? 15,
    delay_minutes: doc?.delay_minutes ?? 0,
    booked_tokens: booked.map((b) => b.token_number),
  });
});

router.get("/doctors/:id/schedule", async (req, res) => {
  const { id } = req.params;
  const [schedRes, breaksRes] = await Promise.all([
    admin.from("doctor_schedules").select("day_of_week, start_time, end_time, is_available").eq("doctor_user_id", id),
    admin.from("doctor_breaks").select("break_name, start_time, end_time, applies_to_days, is_active").eq("doctor_user_id", id).eq("is_active", true),
  ]);
  res.json({ schedule: schedRes.data ?? [], breaks: breaksRes.data ?? [] });
});

export default router;
