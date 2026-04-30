import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

export function StarRating({
  value,
  size = 16,
  showValue = false,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
}) {
  const colors = useColors();
  const rounded = Math.round(value);
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rounded ? "star" : "star-outline"}
          size={size}
          color={i <= rounded ? colors.gold : colors.border}
        />
      ))}
      {showValue ? (
        <Text
          style={[styles.value, { fontSize: size - 2, color: colors.foreground }]}
        >
          {value.toFixed(1)}
        </Text>
      ) : null}
    </View>
  );
}

export function InteractiveStars({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable
          key={i}
          onPress={() => onChange(i)}
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons
            name={i <= value ? "star" : "star-outline"}
            size={size}
            color={i <= value ? colors.gold : colors.border}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  value: {
    marginLeft: 6,
    fontFamily: "Inter_600SemiBold",
  },
});
