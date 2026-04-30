import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "outline" | "ghost" | "danger";

export function AppButton({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
  icon,
  style,
  fullWidth = true,
  size = "md",
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const heightMap = { sm: 36, md: 48, lg: 54 };
  const fontMap = { sm: 13, md: 15, lg: 16 };

  const handlePress = () => {
    if (isDisabled) return;
    if (variant === "primary") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const baseStyle: ViewStyle = {
    height: heightMap[size],
    borderRadius: 14,
    paddingHorizontal: 18,
    width: fullWidth ? "100%" : undefined,
    alignSelf: fullWidth ? "stretch" : "flex-start",
    opacity: isDisabled ? 0.55 : 1,
  };

  if (variant === "primary") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          baseStyle,
          { transform: [{ scale: pressed ? 0.98 : 1 }] },
          style,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
        />
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.row}>
              {icon}
              <Text
                style={[
                  styles.label,
                  { color: "#fff", fontSize: fontMap[size] },
                ]}
              >
                {label}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  if (variant === "outline") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          baseStyle,
          {
            backgroundColor: pressed ? colors.primaryLight : colors.card,
            borderWidth: 1.5,
            borderColor: colors.primary,
          },
          style,
        ]}
      >
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.row}>
              {icon}
              <Text
                style={[
                  styles.label,
                  { color: colors.primary, fontSize: fontMap[size] },
                ]}
              >
                {label}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  if (variant === "danger") {
    return (
      <Pressable
        onPress={handlePress}
        disabled={isDisabled}
        style={({ pressed }) => [
          baseStyle,
          {
            backgroundColor: pressed ? colors.coralLight : colors.card,
            borderWidth: 1.5,
            borderColor: colors.coral,
          },
          style,
        ]}
      >
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator color={colors.coral} />
          ) : (
            <Text
              style={[styles.label, { color: colors.coral, fontSize: fontMap[size] }]}
            >
              {label}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        baseStyle,
        { opacity: pressed ? 0.6 : isDisabled ? 0.55 : 1 },
        style,
      ]}
    >
      <View style={styles.center}>
        <Text
          style={[
            styles.label,
            { color: colors.primary, fontSize: fontMap[size] },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
