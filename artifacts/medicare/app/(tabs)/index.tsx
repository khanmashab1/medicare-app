import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/components/Avatar";
import { BrandLogo } from "@/components/BrandHeader";
import { EmptyState } from "@/components/EmptyState";
import { AppButton } from "@/components/PrimaryButton";
import { Skeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useColors } from "@/hooks/useColors";
import { formatDate, formatShortDate, getGreeting } from "@/lib/format";
import {
  attachDoctorsToAppointments,
  supabase,
  type Appointment,
} from "@/lib/supabase";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const toast = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleLogout = async () => {
    await signOut();
    toast.show("Signed out");
  };

  const total = appointments.length;
  const upcoming = appointments.filter(
    (a) => a.status === "Upcoming" || a.status === "Pending",
  ).length;
  const completed = appointments.filter((a) => a.status === "Completed").length;
  const cancelled = appointments.filter((a) => a.status === "Cancelled").length;

  const upcomingList = appointments
    .filter((a) => a.status === "Upcoming" || a.status === "Pending")
    .slice(0, 3);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : insets.bottom + 80;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 12,
          paddingBottom: bottomPad,
          paddingHorizontal: 18,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <BrandLogo size={20} />
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutBtn,
              {
                backgroundColor: pressed ? colors.coralLight : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.coral} />
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ marginTop: 22 }}>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {today}
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {getGreeting()},{" "}
            <Text style={{ color: colors.primary }}>
              {profile?.name ?? "there"}
            </Text>{" "}
            <Text style={{ fontSize: 24 }}>👋</Text>
          </Text>
        </View>

        {/* Profile card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.primary,
            },
          ]}
        >
          <View style={styles.profileTop}>
            <Avatar name={profile?.name ?? "User"} size={56} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text
                style={[styles.profileName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {profile?.name ?? "Your profile"}
              </Text>
              <Text
                style={[styles.profileSub, { color: colors.mutedForeground }]}
                numberOfLines={1}
              >
                {profile?.email ?? user?.email ?? "—"}
              </Text>
            </View>
          </View>
          <View style={[styles.profileGrid, { borderTopColor: colors.border }]}>
            <ProfileField
              icon="call-outline"
              label="Phone"
              value={profile?.phone}
            />
            <ProfileField
              icon="water-outline"
              label="Blood"
              value={profile?.blood_type}
            />
            <ProfileField
              icon="location-outline"
              label="City"
              value={profile?.city}
            />
            <ProfileField
              icon="person-outline"
              label="Age"
              value={profile?.age != null ? String(profile.age) : null}
            />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard
            label="Total"
            value={total}
            icon="calendar"
            color={colors.primary}
            bg={colors.primaryLight}
            loading={loading}
          />
          <StatCard
            label="Upcoming"
            value={upcoming}
            icon="time"
            color={colors.secondary}
            bg={colors.secondaryLight}
            loading={loading}
          />
        </View>
        <View style={[styles.statsRow, { marginTop: 10 }]}>
          <StatCard
            label="Completed"
            value={completed}
            icon="checkmark-circle"
            color={colors.green}
            bg={colors.greenLight}
            loading={loading}
          />
          <StatCard
            label="Cancelled"
            value={cancelled}
            icon="close-circle"
            color={colors.coral}
            bg={colors.coralLight}
            loading={loading}
          />
        </View>

        {/* Upcoming */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Upcoming Appointments
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/appointments")}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
              See all
            </Text>
          </Pressable>
        </View>

        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : loading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={84} radius={16} />
            <Skeleton height={84} radius={16} />
          </View>
        ) : upcomingList.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <EmptyState
              icon="calendar-outline"
              title="No upcoming appointments"
              message="Tap Book to schedule a visit with a doctor."
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {upcomingList.map((a) => (
              <UpcomingItem key={a.id} appt={a} />
            ))}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actions}>
          <AppButton
            label="Book Appointment"
            onPress={() => router.push("/(tabs)/book")}
            icon={<Ionicons name="add-circle" size={18} color="#fff" />}
          />
          <View style={{ height: 10 }} />
          <AppButton
            label="View All Appointments"
            variant="outline"
            onPress={() => router.push("/(tabs)/appointments")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
}) {
  const colors = useColors();
  return (
    <View style={styles.profileField}>
      <Ionicons name={icon} size={14} color={colors.mutedForeground} />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text
          style={[styles.fieldValue, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
  loading,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  loading?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      {loading ? (
        <Skeleton width={40} height={22} radius={6} style={{ marginTop: 8 }} />
      ) : (
        <Text style={[styles.statValue, { color: colors.foreground }]}>
          {value}
        </Text>
      )}
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function UpcomingItem({ appt }: { appt: Appointment }) {
  const colors = useColors();
  const doctorName = appt.doctor?.name ?? "Doctor";
  return (
    <View
      style={[
        styles.apptCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Avatar name={doctorName} size={44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={[styles.apptDoctor, { color: colors.foreground }]}
          numberOfLines={1}
        >
          Dr. {doctorName}
        </Text>
        <View style={[styles.specChip, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.specText, { color: colors.primaryDark }]}>
            {appt.doctor?.specialty ?? appt.department ?? "General"}
          </Text>
        </View>
        <Text style={[styles.apptMeta, { color: colors.mutedForeground }]}>
          {formatShortDate(appt.appointment_date)} · Token #{appt.token_number}
        </Text>
      </View>
      <StatusBadge status={appt.status} />
    </View>
  );
}

function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.errorBox,
        { backgroundColor: colors.coralLight, borderColor: colors.coral },
      ]}
    >
      <Ionicons name="alert-circle" size={18} color={colors.coral} />
      <Text style={[styles.errorMsg, { color: colors.coral }]}>{message}</Text>
      <Pressable onPress={onRetry} hitSlop={6}>
        <Text style={[styles.retryBtn, { color: colors.coral }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginTop: 4,
  },
  profileCard: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  profileSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  profileField: {
    width: "50%",
    flexDirection: "row",
    paddingVertical: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  apptCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  apptDoctor: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  specChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  specText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  apptMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
  },
  actions: {
    marginTop: 22,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  errorMsg: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  retryBtn: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
