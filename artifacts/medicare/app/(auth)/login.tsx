import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/PrimaryButton";
import { AppInput } from "@/components/Input";
import { BrandLogo } from "@/components/BrandHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    if (mode === "register" && !name) {
      setError("Please enter your name");
      return;
    }
    setLoading(true);
    const res =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, name);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      toast.show(res.error, "error");
    } else {
      toast.show(
        mode === "login" ? "Welcome back!" : "Account created — welcome!",
      );
    }
  };

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const bottomPad =
    Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom + 16;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primaryLight, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFill, { height: 360 }]}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad + 24, paddingBottom: bottomPad + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <BrandLogo size={26} />
        </View>

        <View style={{ height: 24 }} />

        <Text style={[styles.heading, { color: colors.foreground }]}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          {mode === "login"
            ? "Sign in to manage your healthcare"
            : "Join MediCare+ to book appointments"}
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.primary,
            },
          ]}
        >
          {mode === "register" ? (
            <View style={{ marginBottom: 14 }}>
              <AppInput
                label="Full name"
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>
          ) : null}

          <View style={{ marginBottom: 14 }}>
            <AppInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={{ marginBottom: 18 }}>
            <AppInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </View>

          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: colors.coralLight, borderColor: colors.coral },
              ]}
            >
              <Ionicons
                name="alert-circle"
                size={16}
                color={colors.coral}
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: colors.coral, fontSize: 13, flex: 1 }}>
                {error}
              </Text>
            </View>
          ) : null}

          <AppButton
            label={mode === "login" ? "Sign In" : "Create Account"}
            onPress={submit}
            loading={loading}
          />

          <View style={{ height: 14 }} />

          <Pressable
            onPress={() => {
              setError(null);
              setMode(mode === "login" ? "register" : "login");
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              alignSelf: "center",
            })}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
              {mode === "login"
                ? "New to MediCare+? "
                : "Already have an account? "}
              <Text
                style={{
                  color: colors.primary,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {mode === "login" ? "Register" : "Sign in"}
              </Text>
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 22,
  },
  brandRow: {
    alignItems: "center",
    marginTop: 8,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginTop: 4,
  },
  subheading: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    marginBottom: 22,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 12,
  },
});
