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
import { Ionicons } from "@expo/vector-icons";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { AppButton } from "@/components/PrimaryButton";
import { AppInput } from "@/components/Input";
import { Skeleton } from "@/components/Skeleton";
import { StarRating, InteractiveStars } from "@/components/StarRating";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useColors } from "@/hooks/useColors";
import { formatShortDate } from "@/lib/format";
import {
  attachDoctorsToAppointments,
  supabase,
  type Appointment,
  type Review,
} from "@/lib/supabase";

type Pending = Appointment;

export default function ReviewsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const toast = useToast();

  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [approvedReviews, setApprovedReviews] = useState<Review[]>([]);
  const [pendingReview, setPendingReview] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openFormFor, setOpenFormFor] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const [mineRes, completedRes, approvedRes] = await Promise.all([
        supabase
          .from("reviews")
          .select("*")
          .eq("patient_user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("*")
          .eq("patient_user_id", user.id)
          .eq("status", "Completed"),
        supabase
          .from("reviews")
          .select("*")
          .eq("status", "Approved")
          .order("created_at", { ascending: false }),
      ]);

      const mine = (mineRes.data ?? []) as Review[];
      const completedRaw = (completedRes.data ?? []) as Pending[];
      const completed = await attachDoctorsToAppointments(completedRaw);
      const approved = (approvedRes.data ?? []) as Review[];

      setMyReviews(mine);
      setApprovedReviews(approved);
      const reviewedIds = new Set(
        mine.map((r) => r.appointment_id).filter(Boolean) as string[],
      );
      setPendingReview(completed.filter((a) => !reviewedIds.has(a.id)));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load reviews");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (profile?.name && !formName) setFormName(profile.name);
  }, [profile?.name, formName]);

  const submitReview = async (appt: Pending) => {
    if (!user?.id) return;
    if (formRating < 1) {
      toast.show("Please select a rating", "error");
      return;
    }
    if (!formComment.trim()) {
      toast.show("Please write a short comment", "error");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      patient_user_id: user.id,
      appointment_id: appt.id,
      display_name: formName || profile?.name || "Anonymous",
      rating: formRating,
      comment: formComment.trim(),
      status: "Pending",
      source: "internal",
    });
    setSubmitting(false);
    if (error) {
      toast.show(error.message, "error");
      return;
    }
    setOpenFormFor(null);
    setFormComment("");
    setFormRating(5);
    toast.show("Review submitted — pending approval");
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
          Reviews
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Share and explore patient experiences
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
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
        ) : null}

        {/* Section 1: Rate your experience */}
        <SectionTitle title="Rate your experience" />
        {loading ? (
          <Skeleton height={90} radius={16} />
        ) : pendingReview.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <EmptyState
              icon="checkmark-done-outline"
              title="No reviews pending"
              message="After a completed visit, you can leave a review here."
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {pendingReview.map((a) => {
              const open = openFormFor === a.id;
              const doctorName = a.doctor?.name ?? "Doctor";
              return (
                <View
                  key={a.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: open ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <Avatar name={doctorName} size={40} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.cardTitle,
                          { color: colors.foreground },
                        ]}
                      >
                        Dr. {doctorName}
                      </Text>
                      <Text
                        style={{
                          color: colors.mutedForeground,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {a.doctor?.specialty ?? "—"} ·{" "}
                        {formatShortDate(a.appointment_date)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setOpenFormFor(open ? null : a.id);
                        if (!open) {
                          setFormRating(5);
                          setFormComment("");
                        }
                      }}
                      style={({ pressed }) => [
                        styles.writeBtn,
                        {
                          backgroundColor: open
                            ? colors.muted
                            : colors.primaryLight,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: open ? colors.foreground : colors.primary,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        {open ? "Close" : "Write review"}
                      </Text>
                    </Pressable>
                  </View>

                  {open ? (
                    <View style={{ marginTop: 14, gap: 12 }}>
                      <AppInput
                        label="Display name"
                        value={formName}
                        onChangeText={setFormName}
                      />
                      <View>
                        <Text
                          style={[
                            styles.formLabel,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          Rating
                        </Text>
                        <InteractiveStars
                          value={formRating}
                          onChange={setFormRating}
                          size={28}
                        />
                      </View>
                      <AppInput
                        label="Comment"
                        value={formComment}
                        onChangeText={setFormComment}
                        multiline
                        placeholder="Share what stood out about your visit"
                      />
                      <AppButton
                        label="Submit review"
                        loading={submitting}
                        onPress={() => submitReview(a)}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 24 }} />

        {/* Section 2: My reviews */}
        <SectionTitle title="My reviews" count={myReviews.length} />
        {loading ? (
          <Skeleton height={90} radius={16} />
        ) : myReviews.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="You haven't written any reviews yet"
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {myReviews.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <StarRating value={r.rating} size={16} />
                  <StatusBadge status={r.status} />
                </View>
                <Text
                  style={[
                    styles.reviewComment,
                    { color: colors.foreground },
                  ]}
                >
                  {r.comment}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  {formatShortDate(r.created_at)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />

        {/* Section 3: What patients say */}
        <SectionTitle
          title="What patients say"
          count={approvedReviews.length}
        />
        {loading ? (
          <Skeleton height={120} radius={16} />
        ) : approvedReviews.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <EmptyState
              icon="people-outline"
              title="No public reviews yet"
              message="Be the first to share your experience."
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {approvedReviews.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <Avatar name={r.display_name} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      style={[styles.cardTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {r.display_name}
                    </Text>
                    <View style={{ marginTop: 2 }}>
                      <StarRating value={r.rating} size={13} />
                    </View>
                  </View>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontSize: 12,
                    }}
                  >
                    {formatShortDate(r.created_at)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.reviewComment,
                    { color: colors.foreground, marginTop: 10 },
                  ]}
                >
                  {r.comment}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  const colors = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {count != null ? (
        <View
          style={[styles.sectionBadge, { backgroundColor: colors.primaryLight }]}
        >
          <Text
            style={{
              color: colors.primaryDark,
              fontFamily: "Inter_700Bold",
              fontSize: 11,
            }}
          >
            {count}
          </Text>
        </View>
      ) : null}
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
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  sectionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  writeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    lineHeight: 20,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
});
