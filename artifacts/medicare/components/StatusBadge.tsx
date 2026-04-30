import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { AppointmentStatus } from "@/lib/supabase";

export function StatusBadge({ status }: { status: AppointmentStatus | string }) {
  const colors = useColors();
  const map: Record<string, { bg: string; fg: string }> = {
    Upcoming: { bg: colors.primaryLight, fg: colors.primaryDark },
    Completed: { bg: colors.greenLight, fg: colors.green },
    Cancelled: { bg: colors.coralLight, fg: colors.coral },
    Pending: { bg: colors.yellowLight, fg: "hsl(38, 80%, 35%)" },
    Approved: { bg: colors.greenLight, fg: colors.green },
    Rejected: { bg: colors.coralLight, fg: colors.coral },
  };
  const c = map[status] ?? { bg: colors.muted, fg: colors.mutedForeground };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.text, { color: c.fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
