import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export function AppInput({
  label,
  error,
  multiline,
  ...rest
}: TextInputProps & { label?: string; error?: string | null }) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ width: "100%" }}>
      {label ? (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        multiline={multiline}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: error
              ? colors.coral
              : focused
                ? colors.primary
                : colors.border,
            minHeight: multiline ? 96 : 48,
            paddingTop: multiline ? 12 : 0,
            textAlignVertical: multiline ? "top" : "center",
          },
          rest.style,
        ]}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.coral }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
