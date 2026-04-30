import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase env vars are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type AppointmentStatus =
  | "Upcoming"
  | "Completed"
  | "Cancelled"
  | "Pending";

export interface Profile {
  id: string;
  name: string | null;
  phone: string | null;
  blood_type: string | null;
  city: string | null;
  province: string | null;
  age: number | null;
  gender: string | null;
  role: string | null;
  patient_id: string | null;
  date_of_birth: string | null;
  status: string | null;
}

export interface Doctor {
  user_id: string;
  name?: string | null;
  specialty: string;
  rating: number | null;
  fee: number | null;
  experience_years: number | null;
  city: string | null;
  province: string | null;
  max_patients_per_day: number | null;
  easypaisa_number: string | null;
  image_path: string | null;
  bio: string | null;
  degree: string | null;
  qualifications: string | null;
  clinic_address: string | null;
  profile?: { name: string | null; city: string | null; province: string | null } | null;
}

export interface Appointment {
  id: string;
  patient_user_id: string;
  doctor_user_id: string;
  appointment_date: string;
  token_number: number;
  department: string | null;
  reason: string | null;
  status: AppointmentStatus;
  payment_method: string | null;
  payment_status: string | null;
  patient_full_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  vitals_weight: string | null;
  vitals_bp: string | null;
  vitals_temperature: string | null;
  vitals_heart_rate: string | null;
  diagnosis: string | null;
  medicines: string | null;
  lab_tests: string | null;
  doctor_comments: string | null;
  allergies: string | null;
  follow_up_date: string | null;
  doctor?: {
    name: string | null;
    specialty: string | null;
    rating: number | null;
    fee: number | null;
    city: string | null;
    province?: string | null;
  } | null;
}

export async function attachDoctorsToAppointments<
  T extends { doctor_user_id: string; doctor?: any },
>(appts: T[]): Promise<T[]> {
  if (appts.length === 0) return appts;
  const ids = Array.from(new Set(appts.map((a) => a.doctor_user_id)));
  const [profilesRes, doctorsRes] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", ids),
    supabase
      .from("doctors")
      .select("user_id, specialty, rating, fee, city, province")
      .in("user_id", ids),
  ]);
  const nameById = new Map<string, string | null>();
  for (const p of (profilesRes.data ?? []) as Array<{
    id: string;
    name: string | null;
  }>) {
    nameById.set(p.id, p.name);
  }
  const docById = new Map<
    string,
    {
      specialty: string | null;
      rating: number | null;
      fee: number | null;
      city: string | null;
      province: string | null;
    }
  >();
  for (const d of (doctorsRes.data ?? []) as Array<{
    user_id: string;
    specialty: string | null;
    rating: number | null;
    fee: number | null;
    city: string | null;
    province: string | null;
  }>) {
    docById.set(d.user_id, {
      specialty: d.specialty,
      rating: d.rating,
      fee: d.fee,
      city: d.city,
      province: d.province,
    });
  }
  return appts.map((a) => {
    const d = docById.get(a.doctor_user_id);
    return {
      ...a,
      doctor: {
        name: nameById.get(a.doctor_user_id) ?? null,
        specialty: d?.specialty ?? null,
        rating: d?.rating ?? null,
        fee: d?.fee ?? null,
        city: d?.city ?? null,
        province: d?.province ?? null,
      },
    };
  });
}

export interface Review {
  id: string;
  patient_user_id: string;
  appointment_id: string | null;
  display_name: string;
  rating: number;
  comment: string;
  status: "Pending" | "Approved" | "Rejected";
  source: string;
  created_at: string;
}
