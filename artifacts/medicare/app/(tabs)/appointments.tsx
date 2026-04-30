import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { AppButton } from "@/components/PrimaryButton";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useColors } from "@/hooks/useColors";
import { formatDate } from "@/lib/format";
import {
  attachDoctorsToAppointments,
  supabase,
  type Appointment,
  type AppointmentStatus,
} from "@/lib/supabase";

const TABS: AppointmentStatus[] = [
  "Upcoming",
  "Completed",
  "Cancelled",
  "Pending",
];

export default function AppointmentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<AppointmentStatus>("Upcoming");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("patient_user_id", user.id)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      const enriched = await attachDoctorsToAppointments(
        (data ?? []) as Appointment[],
      );
      setAppointments(enriched);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load appointments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<AppointmentStatus, number> = {
      Upcoming: 0,
      Completed: 0,
      Cancelled: 0,
      Pending: 0,
    };
    for (const a of appointments) {
      if (a.status in c) c[a.status]++;
    }
    return c;
  }, [appointments]);

  const filtered = appointments.filter((a) => a.status === activeTab);

  const cancel = async (id: string) => {
    setCancellingId(id);
    const { error } = await supabase
      .from("appointments")
      .update({ status: "Cancelled" })
      .eq("id", id);
    setCancellingId(null);
    setConfirmCancelId(null);
    if (error) {
      toast.show(error.message, "error");
      return;
    }
    toast.show("Appointment cancelled");
    load();
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

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
          My appointments
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {appointments.length} total
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {TABS.map((t) => {
            const isActive = activeTab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setActiveTab(t)}
                style={({ pressed }) => [
                  styles.tab,
                  {
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: isActive ? colors.primary : colors.border,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text
                  style={{
                    color: isActive ? "#fff" : colors.foreground,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 13,
                  }}
                >
                  {t}
                </Text>
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isActive
                        ? "rgba(255,255,255,0.25)"
                        : colors.muted,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: isActive ? "#fff" : colors.mutedForeground,
                      fontSize: 11,
                      fontFamily: "Inter_700Bold",
                    }}
                  >
                    {counts[t]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: bottomPad,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.coralLight, borderColor: colors.coral },
            ]}
          >
            <Ionicons name="alert-circle" size={18} color={colors.coral} />
            <Text style={{ flex: 1, color: colors.coral, marginLeft: 8 }}>
              {error}
            </Text>
            <Pressable onPress={load}>
              <Text
                style={{
                  color: colors.coral,
                  fontFamily: "Inter_700Bold",
                }}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={{ gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={120} radius={16} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <EmptyState
              icon="file-tray-outline"
              title={`No ${activeTab.toLowerCase()} appointments`}
              message="Your records will show up here as you book and complete visits."
            />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filtered.map((a) => (
              <ApptCard
                key={a.id}
                appt={a}
                expanded={expandedId === a.id}
                onToggle={() =>
                  setExpandedId(expandedId === a.id ? null : a.id)
                }
                confirmCancel={confirmCancelId === a.id}
                cancelling={cancellingId === a.id}
                onAskCancel={() => setConfirmCancelId(a.id)}
                onConfirmCancel={() => cancel(a.id)}
                onAbortCancel={() => setConfirmCancelId(null)}
                onViewPrescription={() =>
                  router.push(`/prescription/${a.id}` as any)
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ApptCard({
  appt,
  expanded,
  onToggle,
  confirmCancel,
  cancelling,
  onAskCancel,
  onConfirmCancel,
  onAbortCancel,
  onViewPrescription,
}: {
  appt: Appointment;
  expanded: boolean;
  onToggle: () => void;
  confirmCancel: boolean;
  cancelling: boolean;
  onAskCancel: () => void;
  onConfirmCancel: () => void;
  onAbortCancel: () => void;
  onViewPrescription: () => void;
}) {
  const colors = useColors();
  const doctorName = appt.doctor?.name ?? "Doctor";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardTop}>
        <View
          style={[
            styles.tokenCircle,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={styles.tokenLabel}>TOKEN</Text>
          <Text style={styles.tokenNumber}>#{appt.token_number}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text
            style={[styles.doctorName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            Dr. {doctorName}
          </Text>
          <View style={[styles.specChip, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.specText, { color: colors.primaryDark }]}>
              {appt.doctor?.specialty ?? appt.department ?? "General"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Ionicons
              name="calendar-outline"
              size={13}
              color={colors.mutedForeground}
            />
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              {formatDate(appt.appointment_date)}
            </Text>
          </View>
        </View>
        <StatusBadge status={appt.status} />
      </View>

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => [
            styles.detailsBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.primary}
          />
          <Text
            style={{
              color: colors.primary,
              fontFamily: "Inter_600SemiBold",
              marginLeft: 4,
              fontSize: 13,
            }}
          >
            {expanded ? "Hide details" : "View details"}
          </Text>
        </Pressable>

        {appt.status === "Upcoming" ? (
          confirmCancel ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <AppButton
                label="No"
                size="sm"
                fullWidth={false}
                variant="outline"
                onPress={onAbortCancel}
              />
              <AppButton
                label="Yes, cancel"
                size="sm"
                fullWidth={false}
                variant="danger"
                loading={cancelling}
                onPress={onConfirmCancel}
              />
            </View>
          ) : (
            <AppButton
              label="Cancel"
              size="sm"
              fullWidth={false}
              variant="danger"
              onPress={onAskCancel}
            />
          )
        ) : appt.status === "Completed" ? (
          <Pressable
            onPress={onViewPrescription}
            style={({ pressed }) => [
              styles.rxBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="document-text-outline" size={14} color="#10b981" />
            <Text style={styles.rxBtnText}>Prescription</Text>
          </Pressable>
        ) : null}
      </View>

      {expanded ? <DetailsSection appt={appt} /> : null}
    </View>
  );
}

function DetailsSection({ appt }: { appt: Appointment }) {
  const colors = useColors();
  return (
    <View style={[styles.detailsBlock, { borderTopColor: colors.border }]}>
      <Text style={[styles.detailsHeading, { color: colors.foreground }]}>
        Vitals
      </Text>
      <View style={styles.vitalsGrid}>
        <Vital label="Weight" value={appt.vitals_weight} unit="kg" />
        <Vital label="BP" value={appt.vitals_bp} />
        <Vital label="Temp" value={appt.vitals_temperature} unit="°F" />
        <Vital label="Heart" value={appt.vitals_heart_rate} unit="bpm" />
      </View>

      <Text style={[styles.detailsHeading, { color: colors.foreground, marginTop: 14 }]}>
        Clinical notes
      </Text>
      <DetailRow label="Diagnosis" value={appt.diagnosis} />
      <DetailRow label="Medicines" value={appt.medicines} />
      <DetailRow label="Lab tests" value={appt.lab_tests} />
      <DetailRow label="Doctor's comments" value={appt.doctor_comments} />

      {appt.reason ? (
        <>
          <Text
            style={[styles.detailsHeading, { color: colors.foreground, marginTop: 14 }]}
          >
            Your reason
          </Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>
            {appt.reason}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function Vital({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | null;
  unit?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.vitalCell,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.vitalLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.vitalValue, { color: colors.foreground }]}>
        {value ?? "—"}{value && unit ? ` ${unit}` : ""}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const colors = useColors();
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.detailValue, { color: colors.foreground }]}>
        {value || "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
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
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  tokenCircle: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  tokenNumber: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 1,
  },
  doctorName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  specChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  specText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailsBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  detailsHeading: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  vitalCell: {
    width: "48%",
    flexGrow: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  vitalLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  vitalValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  detailRow: {
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
  },
  rxBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10b981",
    backgroundColor: "#0a2e24",
  },
  rxBtnText: {
    color: "#10b981",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
});
