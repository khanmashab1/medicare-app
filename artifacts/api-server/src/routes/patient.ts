import { Router, type IRouter } from "express";
import { admin, userClient } from "../lib/supabase";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import type { Request } from "express";

const router: IRouter = Router();

const auth = (req: Request) => req as AuthRequest;

router.get("/me", requireAuth, async (req, res) => {
  const { user, jwt } = auth(req);
  const sb = userClient(jwt);
  const { data, error } = await sb
    .from("profiles")
    .select("id, name, phone, blood_type, city, date_of_birth, patient_id, age, gender")
    .eq("id", user.id)
    .maybeSingle();
  if (error) { res.status(400).json({ error: error.message }); return; }
  res.json({ ...data, email: user.email });
});

router.get("/stats", requireAuth, async (req, res) => {
  const { user, jwt } = auth(req);
  const sb = userClient(jwt);
  const { data, error } = await sb
    .from("appointments")
    .select("status")
    .eq("patient_user_id", user.id);
  if (error) { res.status(400).json({ error: error.message }); return; }
  const counts = { total: data?.length ?? 0, upcoming: 0, completed: 0, cancelled: 0 };
  for (const a of (data ?? []) as { status: string }[]) {
    if (["Upcoming", "Pending", "In Progress"].includes(a.status)) counts.upcoming++;
    else if (a.status === "Completed") counts.completed++;
    else if (a.status === "Cancelled") counts.cancelled++;
  }
  res.json(counts);
});

router.get("/appointments", requireAuth, async (req, res) => {
  const { user, jwt } = auth(req);
  const sb = userClient(jwt);
  const { data: appts, error } = await sb
    .from("appointments")
    .select("*")
    .eq("patient_user_id", user.id)
    .order("appointment_date", { ascending: false });
  if (error) { res.status(400).json({ error: error.message }); return; }
  if (!appts || appts.length === 0) { res.json([]); return; }

  const docIds = [...new Set((appts as { doctor_user_id: string }[]).map((a) => a.doctor_user_id))];
  const [profsRes, docsRes] = await Promise.all([
    admin.from("profiles").select("id, name").in("id", docIds),
    admin.from("doctors").select("user_id, specialty, image_path, fee, rating").in("user_id", docIds),
  ]);
  const pMap: Record<string, string> = {};
  for (const p of (profsRes.data ?? []) as { id: string; name: string }[]) pMap[p.id] = p.name;
  const dMap: Record<string, { specialty: string; image_path: string; fee: number; rating: number }> = {};
  for (const d of (docsRes.data ?? []) as any[]) dMap[d.user_id] = d;

  res.json(
    (appts as any[]).map((a) => ({
      ...a,
      doctor: {
        name: pMap[a.doctor_user_id] ?? "Doctor",
        specialty: dMap[a.doctor_user_id]?.specialty ?? null,
        image_path: dMap[a.doctor_user_id]?.image_path ?? null,
        fee: dMap[a.doctor_user_id]?.fee ?? null,
        rating: dMap[a.doctor_user_id]?.rating ?? null,
      },
    })),
  );
});

router.post("/appointments", requireAuth, async (req, res) => {
  const { user, jwt } = auth(req);
  const sb = userClient(jwt);
  const {
    doctor_user_id, appointment_date, reason, department,
    payment_method, token_number,
    patient_full_name, patient_phone, patient_email,
  } = req.body ?? {};

  if (!doctor_user_id || !appointment_date || !payment_method || !token_number) {
    res.status(400).json({ error: "doctor_user_id, appointment_date, payment_method, token_number required" });
    return;
  }

  const { data, error } = await sb.from("appointments").insert({
    patient_user_id: user.id,
    doctor_user_id,
    appointment_date,
    token_number,
    reason: reason ?? null,
    department: department ?? null,
    payment_method,
    payment_status: payment_method === "Online" ? "Pending" : "NA",
    patient_full_name: patient_full_name ?? null,
    patient_phone: patient_phone ?? null,
    patient_email: patient_email ?? null,
    status: payment_method === "Online" ? "Pending" : "Upcoming",
  }).select().single();

  if (error) { res.status(400).json({ error: error.message }); return; }
  res.status(201).json(data);
});

router.patch("/appointments/:id/cancel", requireAuth, async (req, res) => {
  const { user, jwt } = auth(req);
  const sb = userClient(jwt);
  const { data, error } = await sb
    .from("appointments")
    .update({ status: "Cancelled" })
    .eq("id", req.params.id)
    .eq("patient_user_id", user.id)
    .in("status", ["Pending", "Upcoming"])
    .select()
    .single();
  if (error) { res.status(400).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Not found or not cancellable" }); return; }
  res.json(data);
});

router.get("/appointments/:id/prescription", requireAuth, async (req, res) => {
  const { user } = auth(req);
  const { data: appt, error } = await admin
    .from("appointments")
    .select("*, doctor_user_id")
    .eq("id", req.params.id)
    .eq("patient_user_id", user.id)
    .maybeSingle();
  if (error || !appt) { res.status(404).json({ error: "Not found" }); return; }

  const [profRes, docRes] = await Promise.all([
    admin.from("profiles").select("id, name, blood_type, date_of_birth, age, gender").eq("id", (appt as any).patient_user_id).maybeSingle(),
    admin.from("profiles").select("id, name").eq("id", (appt as any).doctor_user_id).maybeSingle(),
    ]);
  const docInfoRes = await admin.from("doctors").select("specialty, degree, qualifications, clinic_address, image_path, fee").eq("user_id", (appt as any).doctor_user_id).maybeSingle();

  res.json({
    appointment: appt,
    patient: profRes.data,
    doctor: { ...docRes.data, ...docInfoRes.data },
  });
});

export default router;
