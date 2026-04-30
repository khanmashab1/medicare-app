import { Router, type IRouter } from "express";

const router: IRouter = Router();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function sbHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

router.get("/doctors", async (req, res) => {
  try {
    const { specialty, city } = req.query as Record<string, string>;
    let url = `${SUPABASE_URL}/rest/v1/doctors?select=*`;
    if (specialty) url += `&specialty=eq.${encodeURIComponent(specialty)}`;
    if (city) url += `&city=eq.${encodeURIComponent(city)}`;

    const drRes = await fetch(url, { headers: sbHeaders() });
    const doctors = (await drRes.json()) as Array<Record<string, unknown>>;

    if (!Array.isArray(doctors) || doctors.length === 0) {
      let fallbackUrl = `${SUPABASE_URL}/rest/v1/doctors?select=*`;
      if (specialty) fallbackUrl += `&specialty=eq.${encodeURIComponent(specialty)}`;
      const fbRes = await fetch(fallbackUrl, { headers: sbHeaders() });
      const fallback = (await fbRes.json()) as Array<Record<string, unknown>>;
      if (!Array.isArray(fallback)) {
        res.json([]);
        return;
      }
      const ids = fallback.map((d) => d.user_id as string).join(",");
      if (!ids) { res.json([]); return; }
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,name&id=in.(${ids})`,
        { headers: sbHeaders() },
      );
      const profiles = (await profRes.json()) as Array<{ id: string; name: string | null }>;
      const nameById = new Map(profiles.map((p) => [p.id, p.name]));
      res.json(fallback.map((d) => ({ ...d, profile_name: nameById.get(d.user_id as string) ?? null })));
      return;
    }

    const ids = doctors.map((d) => d.user_id as string).join(",");
    const profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,name&id=in.(${ids})`,
      { headers: sbHeaders() },
    );
    const profiles = (await profRes.json()) as Array<{ id: string; name: string | null }>;
    const nameById = new Map(profiles.map((p) => [p.id, p.name]));
    res.json(doctors.map((d) => ({ ...d, profile_name: nameById.get(d.user_id as string) ?? null })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.get("/booked-tokens", async (req, res) => {
  try {
    const { doctor_user_id, date } = req.query as Record<string, string>;
    if (!doctor_user_id || !date) {
      res.status(400).json({ error: "doctor_user_id and date required" });
      return;
    }
    const url =
      `${SUPABASE_URL}/rest/v1/appointments?select=token_number` +
      `&doctor_user_id=eq.${encodeURIComponent(doctor_user_id)}` +
      `&appointment_date=eq.${encodeURIComponent(date)}` +
      `&status=neq.Cancelled`;
    const apptRes = await fetch(url, { headers: sbHeaders() });
    const rows = (await apptRes.json()) as Array<{ token_number: number }>;
    res.json(Array.isArray(rows) ? rows.map((r) => r.token_number) : []);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
