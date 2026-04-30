import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/components/Avatar";
import { AppButton } from "@/components/PrimaryButton";
import { AppInput } from "@/components/Input";
import { Skeleton } from "@/components/Skeleton";
import { StarRating } from "@/components/StarRating";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useColors } from "@/hooks/useColors";
import { formatShortDate, getNext14Days } from "@/lib/format";
import { CITIES_BY_PROVINCE, PROVINCES } from "@/lib/locations";
import { DEFAULT_SPECIALTIES, SPECIALTY_ICONS } from "@/lib/specialties";
import { supabase, type Doctor } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

type Step = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS = [
  "Location",
  "Specialty",
  "Doctor",
  "Date & Token",
  "Confirm",
];

export default function BookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState<Step>(0);

  // Step 0: Location
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Step 1
  const [specialtyCounts, setSpecialtyCounts] = useState<Record<string, number>>({});
  const [loadingSpecs, setLoadingSpecs] = useState(true);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);

  // Step 2
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Step 3
  const dates = useMemo(() => getNext14Days(), []);
  const [selectedDate, setSelectedDate] = useState<string>(dates[0]?.iso ?? "");
  const [bookedTokens, setBookedTokens] = useState<number[]>([]);
  const [doctorInfo, setDoctorInfo] = useState<{
    max_patients_per_day: number;
    easypaisa_number: string | null;
  } | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Online">("Cash");
  const [receiptName, setReceiptName] = useState<string | null>(null);

  // Step 4
  const [reason, setReason] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep(0);
    setSelectedProvince(null);
    setSelectedCity(null);
    setSelectedSpecialty(null);
    setSelectedDoctor(null);
    setSelectedDate(dates[0]?.iso ?? "");
    setSelectedToken(null);
    setBookedTokens([]);
    setDoctorInfo(null);
    setPaymentMethod("Cash");
    setReceiptName(null);
    setReason("");
  }, [dates]);

  useFocusEffect(
    useCallback(() => {
      // pre-fill patient info when screen focuses
      if (profile) {
        setPatientName(profile.name ?? "");
        setPatientEmail(user?.email ?? "");
        setPatientPhone(profile.phone ?? "");
      }
    }, [profile, user]),
  );

  // Load specialty counts for selected location
  useEffect(() => {
    if (!selectedCity) return;
    let mounted = true;
    (async () => {
      setLoadingSpecs(true);
      try {
        const rows = await apiFetch<{ specialty: string | null }[]>(
          `/doctors?city=${encodeURIComponent(selectedCity)}`,
        );
        const counts: Record<string, number> = {};
        for (const sp of DEFAULT_SPECIALTIES) counts[sp] = 0;
        for (const r of rows) {
          if (r.specialty) counts[r.specialty] = (counts[r.specialty] ?? 0) + 1;
        }
        if (!mounted) return;
        setSpecialtyCounts(counts);
      } catch {
        if (!mounted) return;
        // fall back: all specialties at 0
        const counts: Record<string, number> = {};
        for (const sp of DEFAULT_SPECIALTIES) counts[sp] = 0;
        setSpecialtyCounts(counts);
      }
      setLoadingSpecs(false);
    })();
    return () => { mounted = false; };
  }, [selectedCity]);

  // Load doctors when specialty selected (via API server to bypass RLS)
  useEffect(() => {
    if (!selectedSpecialty || !selectedCity) return;
    let mounted = true;
    (async () => {
      setLoadingDoctors(true);
      try {
        type ApiDoctor = Doctor & { profile_name: string | null };
        const rows = await apiFetch<ApiDoctor[]>(
          `/doctors?specialty=${encodeURIComponent(selectedSpecialty)}&city=${encodeURIComponent(selectedCity)}`,
        );
        if (!mounted) return;
        const enriched = rows.map((d) => ({
          ...d,
          profile: {
            name: d.profile_name ?? null,
            city: d.city,
            province: d.province,
          },
        }));
        setDoctors(enriched);
      } catch {
        if (!mounted) return;
        setDoctors([]);
      }
      setLoadingDoctors(false);
    })();
    return () => { mounted = false; };
  }, [selectedSpecialty, selectedCity]);

  // Load tokens when doctor + date selected
  useEffect(() => {
    if (!selectedDoctor || !selectedDate) return;
    let mounted = true;
    (async () => {
      setLoadingTokens(true);
      setSelectedToken(null);
      try {
        const tokens = await apiFetch<number[]>(
          `/booked-tokens?doctor_user_id=${encodeURIComponent(selectedDoctor.user_id)}&date=${encodeURIComponent(selectedDate)}`,
        );
        if (!mounted) return;
        setBookedTokens(Array.isArray(tokens) ? tokens : []);
      } catch {
        if (!mounted) return;
        setBookedTokens([]);
      }
      // Use doctor info already loaded into selectedDoctor
      setDoctorInfo({
        max_patients_per_day: selectedDoctor.max_patients_per_day ?? 20,
        easypaisa_number: selectedDoctor.easypaisa_number ?? null,
      });
      setLoadingTokens(false);
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDoctor, selectedDate]);

  const submit = async () => {
    if (!user?.id || !selectedDoctor || !selectedToken) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));
    const { error } = await supabase.from("appointments").insert({
      patient_user_id: user.id,
      doctor_user_id: selectedDoctor.user_id,
      appointment_date: selectedDate,
      token_number: selectedToken,
      department: selectedSpecialty,
      reason,
      status: paymentMethod === "Online" ? "Pending" : "Upcoming",
      payment_method: paymentMethod,
      payment_status: paymentMethod === "Online" ? "Pending" : "NA",
      patient_full_name: patientName,
      patient_email: patientEmail,
      patient_phone: patientPhone,
    });
    setSubmitting(false);
    if (error) {
      toast.show(error.message, "error");
      return;
    }
    toast.show("Appointment booked successfully!");
    reset();
    router.push("/(tabs)/appointments");
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  const canNext =
    (step === 0 && !!selectedProvince && !!selectedCity) ||
    (step === 1 && !!selectedSpecialty) ||
    (step === 2 && !!selectedDoctor) ||
    (step === 3 && !!selectedToken) ||
    step === 4;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Book appointment
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Step {step + 1} of 4 · {STEP_LABELS[step]}
        </Text>
        <View style={styles.progressRow}>
          {STEP_LABELS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                {
                  backgroundColor:
                    i <= step ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: bottomPad,
        }}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <Step0Location
            province={selectedProvince}
            city={selectedCity}
            onProvince={(p) => {
              setSelectedProvince(p);
              setSelectedCity(null);
            }}
            onCity={setSelectedCity}
          />
        ) : step === 1 ? (
          <Step1
            loading={loadingSpecs}
            counts={specialtyCounts}
            selected={selectedSpecialty}
            onSelect={setSelectedSpecialty}
            location={`${selectedCity}, ${selectedProvince}`}
          />
        ) : step === 2 ? (
          <Step2
            loading={loadingDoctors}
            doctors={doctors}
            selected={selectedDoctor}
            onSelect={setSelectedDoctor}
          />
        ) : step === 3 ? (
          <Step3
            dates={dates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            loading={loadingTokens}
            booked={bookedTokens}
            max={doctorInfo?.max_patients_per_day ?? 0}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
            paymentMethod={paymentMethod}
            onPayment={setPaymentMethod}
            easypaisaNumber={doctorInfo?.easypaisa_number ?? null}
            receiptName={receiptName}
            onReceipt={setReceiptName}
          />
        ) : (
          <Step4
            specialty={selectedSpecialty ?? ""}
            doctor={selectedDoctor}
            date={selectedDate}
            token={selectedToken}
            paymentMethod={paymentMethod}
            reason={reason}
            onReason={setReason}
            patientName={patientName}
            onName={setPatientName}
            patientEmail={patientEmail}
            onEmail={setPatientEmail}
            patientPhone={patientPhone}
            onPhone={setPatientPhone}
          />
        )}
      </ScrollView>

      {/* Footer nav */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 80,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <View style={{ flexDirection: "row", gap: 10 }}>
          {step > 0 ? (
            <AppButton
              label="Back"
              variant="outline"
              fullWidth={false}
              style={{ flex: 1 }}
              onPress={() => setStep(((step - 1) as Step) ?? 0)}
            />
          ) : null}
          {step < 4 ? (
            <AppButton
              label="Continue"
              fullWidth={false}
              style={{ flex: 1 }}
              disabled={!canNext}
              onPress={() => setStep(((step + 1) as Step) ?? 4)}
              icon={
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              }
            />
          ) : (
            <AppButton
              label="Confirm Appointment"
              fullWidth={false}
              style={{ flex: 1 }}
              loading={submitting}
              disabled={!reason || !patientName}
              onPress={submit}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function Step0Location({
  province,
  city,
  onProvince,
  onCity,
}: {
  province: string | null;
  city: string | null;
  onProvince: (p: string) => void;
  onCity: (c: string) => void;
}) {
  const colors = useColors();
  const cities = province ? CITIES_BY_PROVINCE[province] ?? [] : [];
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Where do you need care?
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
        We'll show doctors near you.
      </Text>

      <View style={styles.locSectionHeader}>
        <Ionicons name="location" size={16} color={colors.primary} />
        <Text style={[styles.locSectionTitle, { color: colors.foreground }]}>
          Select Province
        </Text>
      </View>
      <View style={styles.locGrid}>
        {PROVINCES.map((p) => {
          const isSel = province === p;
          return (
            <Pressable
              key={p}
              onPress={() => onProvince(p)}
              style={({ pressed }) => [
                styles.locPill,
                {
                  backgroundColor: isSel ? colors.primaryLight : colors.card,
                  borderColor: isSel ? colors.primary : colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: isSel ? colors.primaryDark : colors.foreground,
                  fontFamily: isSel ? "Inter_600SemiBold" : "Inter_500Medium",
                  fontSize: 13,
                }}
                numberOfLines={1}
              >
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {province ? (
        <>
          <View style={styles.locSectionHeader}>
            <Ionicons name="location" size={16} color={colors.primary} />
            <Text style={[styles.locSectionTitle, { color: colors.foreground }]}>
              Select City
            </Text>
          </View>
          <View style={styles.locGrid}>
            {cities.map((c) => {
              const isSel = city === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => onCity(c)}
                  style={({ pressed }) => [
                    styles.locPill,
                    {
                      backgroundColor: isSel
                        ? colors.primaryLight
                        : colors.card,
                      borderColor: isSel ? colors.primary : colors.border,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isSel ? colors.primaryDark : colors.foreground,
                      fontFamily: isSel
                        ? "Inter_600SemiBold"
                        : "Inter_500Medium",
                      fontSize: 13,
                    }}
                    numberOfLines={1}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

function Step1({
  loading,
  counts,
  selected,
  onSelect,
  location,
}: {
  loading: boolean;
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (s: string) => void;
  location: string;
}) {
  const colors = useColors();
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        What kind of doctor do you need?
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
        Showing specialties available in {location}.
      </Text>

      {loading ? (
        <View style={styles.specGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={110} radius={16} style={styles.specCell} />
          ))}
        </View>
      ) : (
        <View style={styles.specGrid}>
          {DEFAULT_SPECIALTIES.map((sp) => {
            const isSel = selected === sp;
            const iconName = (SPECIALTY_ICONS[sp] ?? "medkit") as
              | keyof typeof Ionicons.glyphMap;
            return (
              <Pressable
                key={sp}
                onPress={() => onSelect(sp)}
                style={({ pressed }) => [
                  styles.specCell,
                  {
                    backgroundColor: isSel ? colors.primaryLight : colors.card,
                    borderColor: isSel ? colors.primary : colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.specIconWrap,
                    {
                      backgroundColor: isSel
                        ? colors.primary
                        : colors.primaryLight,
                    },
                  ]}
                >
                  <Ionicons
                    name={iconName}
                    size={20}
                    color={isSel ? "#fff" : colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.specName,
                    {
                      color: isSel ? colors.primaryDark : colors.foreground,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {sp}
                </Text>
                <Text
                  style={[
                    styles.specCount,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {counts[sp] ?? 0} doctors
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Step2({
  loading,
  doctors,
  selected,
  onSelect,
}: {
  loading: boolean;
  doctors: Doctor[];
  selected: Doctor | null;
  onSelect: (d: Doctor) => void;
}) {
  const colors = useColors();
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Pick a doctor
      </Text>
      <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
        {doctors.length} {doctors.length === 1 ? "doctor" : "doctors"} available
      </Text>

      {loading ? (
        <View style={{ gap: 12 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={140} radius={16} />
          ))}
        </View>
      ) : doctors.length === 0 ? (
        <Text
          style={{
            color: colors.mutedForeground,
            textAlign: "center",
            marginTop: 32,
          }}
        >
          No doctors found for this specialty.
        </Text>
      ) : (
        <View style={{ gap: 12 }}>
          {doctors.map((d) => {
            const name = d.profile?.name ?? d.name ?? "Doctor";
            const isSel = selected?.user_id === d.user_id;
            return (
              <Pressable
                key={d.user_id}
                onPress={() => onSelect(d)}
                style={({ pressed }) => [
                  styles.doctorCard,
                  {
                    backgroundColor: isSel ? colors.primaryLight : colors.card,
                    borderColor: isSel ? colors.primary : colors.border,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  },
                ]}
              >
                <View style={{ flexDirection: "row" }}>
                  <Avatar name={name} size={56} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text
                      style={[styles.doctorName, { color: colors.foreground }]}
                    >
                      Dr. {name}
                    </Text>
                    <Text
                      style={[styles.doctorSpec, { color: colors.primaryDark }]}
                    >
                      {d.specialty}
                    </Text>
                    <View style={{ flexDirection: "row", marginTop: 6, alignItems: "center", gap: 8 }}>
                      <StarRating value={d.rating ?? 4.5} size={13} showValue />
                    </View>
                  </View>
                  <View
                    style={[
                      styles.availChip,
                      { backgroundColor: colors.greenLight },
                    ]}
                  >
                    <View
                      style={[
                        styles.availDot,
                        { backgroundColor: colors.green },
                      ]}
                    />
                    <Text
                      style={[styles.availText, { color: colors.green }]}
                    >
                      Available
                    </Text>
                  </View>
                </View>
                <View
                  style={[styles.doctorMeta, { borderTopColor: colors.border }]}
                >
                  <DoctorMeta
                    icon="briefcase-outline"
                    text={`${d.experience_years ?? 0} yrs exp`}
                  />
                  <DoctorMeta
                    icon="cash-outline"
                    text={`Rs. ${d.fee?.toLocaleString() ?? "—"}`}
                  />
                  <DoctorMeta
                    icon="location-outline"
                    text={`${d.profile?.city ?? d.city ?? "—"}`}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function DoctorMeta({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={13} color={colors.mutedForeground} />
      <Text
        style={{
          fontSize: 12,
          color: colors.mutedForeground,
          fontFamily: "Inter_500Medium",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function Step3({
  dates,
  selectedDate,
  onSelectDate,
  loading,
  booked,
  max,
  selectedToken,
  onSelectToken,
  paymentMethod,
  onPayment,
  easypaisaNumber,
  receiptName,
  onReceipt,
}: {
  dates: { date: Date; iso: string }[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
  loading: boolean;
  booked: number[];
  max: number;
  selectedToken: number | null;
  onSelectToken: (n: number) => void;
  paymentMethod: "Cash" | "Online";
  onPayment: (p: "Cash" | "Online") => void;
  easypaisaNumber: string | null;
  receiptName: string | null;
  onReceipt: (s: string | null) => void;
}) {
  const colors = useColors();
  const tokens = Array.from({ length: max }, (_, i) => i + 1);
  const available = tokens.length - booked.length;

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Pick a date
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
      >
        {dates.map((d) => {
          const isSel = selectedDate === d.iso;
          return (
            <Pressable
              key={d.iso}
              onPress={() => onSelectDate(d.iso)}
              style={({ pressed }) => [
                styles.datePill,
                {
                  backgroundColor: isSel ? colors.primary : colors.card,
                  borderColor: isSel ? colors.primary : colors.border,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Text
                style={{
                  color: isSel ? "#fff" : colors.mutedForeground,
                  fontSize: 11,
                  fontFamily: "Inter_500Medium",
                  textTransform: "uppercase",
                }}
              >
                {d.date.toLocaleDateString(undefined, { weekday: "short" })}
              </Text>
              <Text
                style={{
                  color: isSel ? "#fff" : colors.foreground,
                  fontSize: 18,
                  fontFamily: "Inter_700Bold",
                  marginTop: 2,
                }}
              >
                {d.date.getDate()}
              </Text>
              <Text
                style={{
                  color: isSel ? "#fff" : colors.mutedForeground,
                  fontSize: 10,
                  fontFamily: "Inter_500Medium",
                  marginTop: 2,
                }}
              >
                {d.date.toLocaleDateString(undefined, { month: "short" })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionGap} />

      <View style={styles.tokensHeader}>
        <Text style={[styles.stepTitle, { color: colors.foreground }]}>
          Select a token
        </Text>
        <Text
          style={{
            color: available > 0 ? colors.green : colors.coral,
            fontFamily: "Inter_600SemiBold",
            fontSize: 13,
          }}
        >
          {available} slots available
        </Text>
      </View>

      {loading ? (
        <View style={styles.tokenGrid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} width={56} height={56} radius={12} />
          ))}
        </View>
      ) : tokens.length === 0 ? (
        <Text style={{ color: colors.mutedForeground, marginTop: 12 }}>
          No tokens available for this doctor on selected date.
        </Text>
      ) : (
        <View style={styles.tokenGrid}>
          {tokens.map((n) => {
            const isBooked = booked.includes(n);
            const isSel = selectedToken === n;
            return (
              <Pressable
                key={n}
                disabled={isBooked}
                onPress={() => onSelectToken(n)}
                style={({ pressed }) => [
                  styles.tokenCell,
                  {
                    backgroundColor: isSel
                      ? colors.primary
                      : isBooked
                        ? colors.muted
                        : colors.card,
                    borderColor: isSel
                      ? colors.primary
                      : isBooked
                        ? colors.border
                        : colors.border,
                    opacity: isBooked ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    color: isSel
                      ? "#fff"
                      : isBooked
                        ? colors.mutedForeground
                        : colors.foreground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 16,
                  }}
                >
                  {n}
                </Text>
                {isBooked ? (
                  <Text
                    style={{
                      fontSize: 9,
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                      marginTop: 2,
                    }}
                  >
                    booked
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.sectionGap} />

      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Payment method
      </Text>
      <View style={styles.payRow}>
        {(["Cash", "Online"] as const).map((m) => {
          const isSel = paymentMethod === m;
          return (
            <Pressable
              key={m}
              onPress={() => onPayment(m)}
              style={({ pressed }) => [
                styles.payCell,
                {
                  backgroundColor: isSel ? colors.primaryLight : colors.card,
                  borderColor: isSel ? colors.primary : colors.border,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <Ionicons
                name={m === "Cash" ? "cash-outline" : "phone-portrait-outline"}
                size={20}
                color={isSel ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={{
                  marginTop: 6,
                  color: isSel ? colors.primaryDark : colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {m === "Cash" ? "Cash" : "Easypaisa"}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 11,
                  marginTop: 2,
                }}
              >
                {m === "Cash" ? "Pay at clinic" : "Online payment"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {paymentMethod === "Online" ? (
        <View
          style={[
            styles.payInfo,
            { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}
        >
          <Text style={{ color: colors.primaryDark, fontFamily: "Inter_600SemiBold" }}>
            Send payment to
          </Text>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 18,
              color: colors.primaryDark,
              marginTop: 4,
            }}
          >
            {easypaisaNumber ?? "—"}
          </Text>
          <Pressable
            onPress={() =>
              onReceipt(receiptName ? null : `receipt-${Date.now()}.png`)
            }
            style={({ pressed }) => [
              styles.uploadBtn,
              {
                backgroundColor: pressed ? colors.primary : colors.card,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons
              name={receiptName ? "checkmark-circle" : "cloud-upload-outline"}
              size={18}
              color={receiptName ? colors.green : colors.primary}
            />
            <Text
              style={{
                marginLeft: 8,
                color: colors.primary,
                fontFamily: "Inter_600SemiBold",
              }}
            >
              {receiptName ? "Receipt attached" : "Upload payment receipt"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Step4({
  specialty,
  doctor,
  date,
  token,
  paymentMethod,
  reason,
  onReason,
  patientName,
  onName,
  patientEmail,
  onEmail,
  patientPhone,
  onPhone,
}: {
  specialty: string;
  doctor: Doctor | null;
  date: string;
  token: number | null;
  paymentMethod: "Cash" | "Online";
  reason: string;
  onReason: (s: string) => void;
  patientName: string;
  onName: (s: string) => void;
  patientEmail: string;
  onEmail: (s: string) => void;
  patientPhone: string;
  onPhone: (s: string) => void;
}) {
  const colors = useColors();
  const doctorName = doctor?.profile?.name ?? doctor?.name ?? "—";
  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>
        Review & confirm
      </Text>

      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <SummaryRow label="Doctor" value={`Dr. ${doctorName}`} />
        <SummaryRow label="Specialty" value={specialty} />
        <SummaryRow label="Date" value={formatShortDate(date)} />
        <SummaryRow label="Token" value={token != null ? `#${token}` : "—"} />
        <SummaryRow label="Fee" value={`Rs. ${doctor?.fee ?? "—"}`} />
        <SummaryRow
          label="Payment"
          value={paymentMethod === "Cash" ? "Cash at clinic" : "Easypaisa"}
        />
      </View>

      <View style={{ height: 18 }} />

      <View style={{ gap: 14 }}>
        <AppInput
          label="Reason for visit"
          value={reason}
          onChangeText={onReason}
          multiline
          placeholder="Briefly describe your symptoms or reason for visit"
        />
        <AppInput
          label="Patient name"
          value={patientName}
          onChangeText={onName}
          autoCapitalize="words"
        />
        <AppInput
          label="Email"
          value={patientEmail}
          onChangeText={onEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AppInput
          label="Phone"
          value={patientPhone}
          onChangeText={onPhone}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
        {label}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 4,
  },
  stepTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  stepSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    marginBottom: 14,
  },
  locSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: 10,
  },
  locSectionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  locGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  locPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  specCell: {
    width: "50%",
    aspectRatio: 1.05,
    padding: 8,
    margin: 0,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  specIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  specName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  specCount: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  doctorCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  doctorName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  doctorSpec: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  availChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  doctorMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  datePill: {
    width: 64,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  sectionGap: {
    height: 22,
  },
  tokensHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  tokenGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tokenCell: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  payRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  payCell: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    alignItems: "center",
  },
  payInfo: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  uploadBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
