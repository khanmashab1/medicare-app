import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import { Platform } from "react-native";

import { useColors } from "@/hooks/useColors";

export function BrandLogo({
  size = 22,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  const colors = useColors();
  return (
    <View style={[styles.row, style]}>
      <View
        style={[
          styles.iconWrap,
          {
            width: size + 14,
            height: size + 14,
            borderRadius: (size + 14) / 2,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="medkit" size={size - 2} color="#fff" />
      </View>
      <GradientText
        text="MediCare+"
        size={size}
        from={colors.primary}
        to={colors.secondary}
      />
    </View>
  );
}

export function GradientText({
  text,
  size = 22,
  from,
  to,
}: {
  text: string;
  size?: number;
  from: string;
  to: string;
}) {
  if (Platform.OS === "web") {
    return (
      <Text
        style={{
          fontSize: size,
          fontFamily: "Inter_700Bold",
          letterSpacing: -0.4,
          backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent",
        } as any}
      >
        {text}
      </Text>
    );
  }
  return (
    <MaskedView
      maskElement={
        <Text
          style={{
            fontSize: size,
            fontFamily: "Inter_700Bold",
            letterSpacing: -0.4,
            backgroundColor: "transparent",
          }}
        >
          {text}
        </Text>
      }
    >
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text
          style={{
            fontSize: size,
            fontFamily: "Inter_700Bold",
            letterSpacing: -0.4,
            opacity: 0,
          }}
        >
          {text}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
