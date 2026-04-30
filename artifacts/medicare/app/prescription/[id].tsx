import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import QRCode from "react-native-qrcode-svg";

import { supabase } from "@/lib/supabase";

const TEAL = "#10b981";
const TEAL_DARK = "#059669";
const BG = "#111827";
const CARD = "#1f2937";
const BORDER = "#374151";
const TEXT = "#f9fafb";
const MUTED = "#9ca3af";
const WARN = "#f59e0b";

interface Medicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
}

function fmtFrequency(v: string) {
  const map: Record<string, string> = {
    once: "Once daily",
    twice: "Twice daily",
    thrice: "Three times daily",
    "3x": "Three times daily",
    "2x": "Twice daily",
    "4x": "Four times daily",
    sos: "As needed (SOS)",
  };
  return map[v?.toLowerCase()] ?? v ?? "—";
}

function fmtDuration(v: string) {
  return (v ?? "—").replace(/_/g, " ");
}

function fmtTiming(v: string) {
  const map: Record<string, string> = {
    after_meal: "After meal",
    before_meal: "Before meal",
    with_meal: "With meal",
    empty_stomach: "Empty stomach",
    at_bedtime: "At bedtime",
    morning: "Morning",
    evening: "Evening",
    night: "Night",
  };
  return map[v?.toLowerCase()] ?? (v ?? "—").replace(/_/g, " ");
}

function parseMedicines(raw: string | null): Medicine[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as Medicine[];
  } catch {}
  return [];
}

export default function PrescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appt, setAppt] = useState<any>(null);
  const [doctor, setDoctor] = useState<any>(null);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const { data: apptData, error: apptErr } = await supabase
        .from("appointments")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (apptErr || !apptData) throw apptErr ?? new Error("Appointment not found");

      const [docRes, profRes] = await Promise.all([
        supabase.from("doctors").select("*").eq("user_id", apptData.doctor_user_id).maybeSingle(),
        supabase.from("profiles").select("id, name").eq("id", apptData.doctor_user_id).maybeSingle(),
      ]);

      setAppt(apptData);
      setDoctor(docRes.data);
      setDoctorProfile(profRes.data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load prescription");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 0) : insets.top;
  const bottomPad = insets.bottom + 20;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  if (error || !appt) {
    return (
      <View style={[styles.center, { backgroundColor: BG, paddingTop: topPad }]}>
        <Ionicons name="alert-circle-outline" size={48} color={TEAL} />
        <Text style={[styles.errorText, { marginTop: 12 }]}>{error ?? "Not found"}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const medicines = parseMedicines(appt.medicines);
  const labTests = appt.lab_tests
    ? appt.lab_tests.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];
  const doctorName = doctorProfile?.name ?? "Doctor";
  const prescriptionDate = appt.appointment_date
    ? new Date(appt.appointment_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  const qrValue = `https://medicareplus.app/prescription/${id}`;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Back button */}
      <View
        style={[
          styles.navBar,
          { paddingTop: topPad + 8, backgroundColor: BG },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.navBack}>
          <Ionicons name="arrow-back" size={22} color={TEXT} />
          <Text style={styles.navBackText}>Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Prescription</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header banner */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Ionicons name="medical" size={22} color={TEAL} />
            </View>
            <View>
              <Text style={styles.headerBrand}>MediCare++</Text>
              <Text style={styles.headerTagline}>Healthcare Excellence</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerPrescNo}>Prescription #1</Text>
            <Text style={styles.headerDate}>{prescriptionDate}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Physician + Patient row */}
          <View style={styles.topCards}>
            {/* Prescribing Physician */}
            <View style={[styles.infoCard, { marginRight: 6 }]}>
              <Text style={styles.infoCardLabel}>PRESCRIBING PHYSICIAN</Text>
              <View style={styles.infoCardDivider} />
              {doctor?.image_path ? (
                <Image
                  source={{ uri: doctor.image_path }}
                  style={styles.doctorAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.doctorAvatarFallback}>
                  <Ionicons name="person" size={20} color={TEAL} />
                </View>
              )}
              <Text style={styles.infoCardName}>Dr. {doctorName}</Text>
              {doctor?.specialty ? (
                <Text style={styles.infoCardSub}>{doctor.specialty}</Text>
              ) : null}
              {doctor?.degree ? (
                <Text style={[styles.infoCardSub, { color: MUTED }]}>{doctor.degree}</Text>
              ) : null}
            </View>

            {/* Patient Details */}
            <View style={[styles.infoCard, { marginLeft: 6 }]}>
              <Text style={styles.infoCardLabel}>PATIENT DETAILS</Text>
              <View style={styles.infoCardDivider} />
              <Text style={styles.infoCardName}>
                {appt.patient_full_name ?? "—"}
              </Text>
              {appt.patient_phone ? (
                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={12} color={MUTED} />
                  <Text style={styles.infoCardSub}> {appt.patient_phone}</Text>
                </View>
              ) : null}
              {appt.allergies ? (
                <View style={styles.allergyRow}>
                  <Ionicons name="warning-outline" size={12} color={WARN} />
                  <Text style={styles.allergyText}> Allergies: {appt.allergies}</Text>
                </View>
              ) : null}
              {appt.vitals_weight || appt.vitals_bp ? (
                <View style={{ marginTop: 8 }}>
                  {appt.vitals_weight ? (
                    <Text style={styles.infoCardSub}>Weight: {appt.vitals_weight} kg</Text>
                  ) : null}
                  {appt.vitals_bp ? (
                    <Text style={styles.infoCardSub}>BP: {appt.vitals_bp}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>

          {/* Diagnosis */}
          {appt.diagnosis ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={16} color={TEAL} />
                <Text style={styles.sectionTitle}>Diagnosis</Text>
              </View>
              <Text style={styles.sectionValue}>{appt.diagnosis}</Text>
            </View>
          ) : null}

          {/* Rx separator */}
          {medicines.length > 0 ? (
            <View style={styles.rxRow}>
              <Text style={styles.rxSymbol}>℞</Text>
              <View style={styles.rxLine} />
            </View>
          ) : null}

          {/* Medications */}
          {medicines.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="medical-outline" size={16} color={TEAL} />
                <Text style={styles.sectionTitle}>Prescribed Medications</Text>
              </View>
              <View style={styles.table}>
                {/* Table header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, styles.tableHeadText, { flex: 0.3 }]}>#</Text>
                  <Text style={[styles.tableCell, styles.tableHeadText, { flex: 2 }]}>Medicine</Text>
                  <Text style={[styles.tableCell, styles.tableHeadText, { flex: 1 }]}>Dosage</Text>
                  <Text style={[styles.tableCell, styles.tableHeadText, { flex: 1.2 }]}>Freq.</Text>
                  <Text style={[styles.tableCell, styles.tableHeadText, { flex: 1 }]}>Duration</Text>
                  <Text style={[styles.tableCell, styles.tableHeadText, { flex: 1 }]}>Timing</Text>
                </View>
                {medicines.map((m, i) => (
                  <View
                    key={i}
                    style={[
                      styles.tableRow,
                      { backgroundColor: i % 2 === 0 ? CARD : "transparent" },
                    ]}
                  >
                    <Text style={[styles.tableCell, styles.tableCellText, { flex: 0.3 }]}>
                      {i + 1}.
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellText, { flex: 2 }]}>
                      {m.name}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellText, { flex: 1 }]}>
                      {m.dosage}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellText, { flex: 1.2 }]}>
                      {fmtFrequency(m.frequency)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellText, { flex: 1 }]}>
                      {fmtDuration(m.duration)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellText, { flex: 1 }]}>
                      {fmtTiming(m.timing)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Lab Tests */}
          {labTests.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flask-outline" size={16} color={TEAL} />
                <Text style={styles.sectionTitle}>Recommended Lab Tests</Text>
              </View>
              <View style={{ gap: 6 }}>
                {labTests.map((t: string, i: number) => (
                  <View key={i} style={styles.labRow}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={TEAL} />
                    <Text style={styles.labText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Doctor Comments */}
          {appt.doctor_comments ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Notes</Text>
              <Text style={styles.sectionValue}>{appt.doctor_comments}</Text>
            </View>
          ) : null}

          {/* Follow up */}
          {appt.follow_up_date ? (
            <View style={[styles.section, { backgroundColor: "#0f2a1e", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: TEAL_DARK }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar-outline" size={14} color={TEAL} />
                <Text style={[styles.sectionTitle, { color: TEAL }]}>Follow-up Date</Text>
              </View>
              <Text style={[styles.sectionValue, { color: TEAL }]}>
                {new Date(appt.follow_up_date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
          ) : null}

          {/* Footer: QR + Stamp */}
          <View style={styles.footer}>
            {/* QR Code */}
            <View style={styles.qrBlock}>
              <View style={styles.qrWrapper}>
                <QRCode
                  value={qrValue}
                  size={80}
                  color={TEXT}
                  backgroundColor={CARD}
                />
              </View>
              <Text style={styles.qrLabel}>Scan to verify</Text>
            </View>

            {/* Doctor Stamp */}
            <View style={styles.stampBlock}>
              <View style={styles.stampCircle}>
                {doctor?.image_path ? (
                  <Image
                    source={{ uri: doctor.image_path }}
                    style={styles.stampImg}
                    contentFit="cover"
                  />
                ) : null}
                <View style={styles.stampOverlay}>
                  <Text style={styles.stampText}>MediCare++</Text>
                </View>
              </View>
              <View style={styles.signLine} />
              <Text style={styles.stampDoctorName}>Dr. {doctorName}</Text>
            </View>
          </View>
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.bottomBarLeft}>
            Valid for 30 days. For emergencies, contact your healthcare provider.
          </Text>
          <Text style={styles.bottomBarRight}>MediCare++</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: {
    color: TEXT,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  navBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 70,
  },
  navBackText: {
    color: TEXT,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  navTitle: {
    color: TEXT,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  header: {
    backgroundColor: "#0a2e24",
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0f3d2e",
    borderWidth: 2,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: {
    color: TEXT,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  headerTagline: {
    color: TEAL,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerPrescNo: {
    color: TEXT,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  headerDate: {
    color: MUTED,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 14,
  },
  topCards: {
    flexDirection: "row",
  },
  infoCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  infoCardLabel: {
    color: TEAL,
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  infoCardDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 8,
  },
  doctorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: TEAL,
  },
  doctorAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0f2a1e",
    borderWidth: 2,
    borderColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  infoCardName: {
    color: TEXT,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    letterSpacing: -0.2,
  },
  infoCardSub: {
    color: MUTED,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  allergyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    backgroundColor: "#2a1f0a",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  allergyText: {
    color: WARN,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionTitle: {
    color: TEXT,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  sectionValue: {
    color: MUTED,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  rxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 2,
  },
  rxSymbol: {
    color: TEAL,
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    lineHeight: 32,
  },
  rxLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: BORDER,
  },
  table: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeader: {
    backgroundColor: "#0f2a1e",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  tableHeadText: {
    color: TEAL,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableCellText: {
    color: TEXT,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  labRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  labText: {
    color: TEXT,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  qrBlock: {
    alignItems: "center",
    gap: 6,
  },
  qrWrapper: {
    padding: 6,
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  qrLabel: {
    color: MUTED,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  stampBlock: {
    alignItems: "center",
    gap: 4,
  },
  stampCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#6b7280",
    borderStyle: "dashed",
    backgroundColor: "#1a2535",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  stampImg: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0.3,
  },
  stampOverlay: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  stampText: {
    color: "#6b7280",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  signLine: {
    width: 100,
    height: 1,
    backgroundColor: MUTED,
    marginTop: 4,
  },
  stampDoctorName: {
    color: TEXT,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
  bottomBar: {
    marginTop: 16,
    backgroundColor: "#0a2e24",
    borderTopWidth: 1,
    borderTopColor: TEAL_DARK,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bottomBarLeft: {
    color: MUTED,
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    flex: 1,
  },
  bottomBarRight: {
    color: TEAL,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    marginLeft: 10,
  },
});
