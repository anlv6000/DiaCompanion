import React from "react";
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
  TextInput, ScrollView, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";

/* ---------- Nút bấm ---------- */
export function Button({ title, onPress, kind = "primary", busy = false, disabled = false, icon, style }) {
  const isPrimary = kind === "primary";
  const isDanger = kind === "danger";
  const isGhost = kind === "ghost";
  const bg = isPrimary ? colors.primary : isDanger ? colors.alert : isGhost ? "transparent" : colors.surface;
  const fg = isPrimary || isDanger ? colors.white : isGhost ? colors.primary : colors.ink;
  const off = disabled || busy;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.8}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: off ? 0.5 : 1 },
        isGhost && { borderWidth: 0 },
        !isPrimary && !isDanger && !isGhost && styles.btnOutline,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.btnRow}>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 6 }} />}
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ---------- Thẻ ---------- */
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{children}</Text>
      {right}
    </View>
  );
}

/* ---------- Ô nhập có nhãn ---------- */
export function Field({ label, children, hint, required }) {
  return (
    <View style={styles.field}>
      {label && (
        <Text style={styles.fieldLabel}>
          {label}{required && <Text style={{ color: colors.alert }}> *</Text>}
        </Text>
      )}
      {children}
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      style={styles.input}
      {...props}
    />
  );
}

/* ---------- Nhãn trạng thái ---------- */
export function Badge({ text, kind = "muted" }) {
  const map = {
    ok: [colors.okSoft, colors.ok],
    warn: [colors.warnSoft, colors.warn],
    alert: [colors.alertSoft, colors.alert],
    defer: [colors.deferSoft, colors.defer],
    primary: [colors.primarySoft, colors.primary],
    muted: [colors.canvas, colors.muted],
  };
  const [bg, fg] = map[kind] || map.muted;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/* ---------- Huy hiệu mức DR (0-4) ---------- */
export function GradeBadge({ grade }) {
  if (grade === null || grade === undefined) return <Text style={styles.dash}>—</Text>;
  const bg = colors.grade[grade] || colors.muted;
  return (
    <View style={[styles.gradeBadge, { backgroundColor: bg }]}>
      <Text style={styles.gradeBadgeText}>R{grade}</Text>
    </View>
  );
}

/* ---------- Trạng thái tải / lỗi / rỗng ---------- */
export function LoadState({ loading, error, empty, emptyText, onRetry, children }) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.faint} />
        <Text style={styles.stateText}>{error.message || "Đã xảy ra lỗi khi tải dữ liệu."}</Text>
        {onRetry && <Button title="Thử lại" kind="outline" onPress={onRetry} style={{ marginTop: spacing.md }} />}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Ionicons name="file-tray-outline" size={40} color={colors.faint} />
        <Text style={styles.stateText}>{emptyText || "Chưa có dữ liệu."}</Text>
      </View>
    );
  }
  return children;
}

/* ---------- Khung màn có kéo để làm mới ---------- */
export function Screen({ children, refreshing, onRefresh, scroll = true, style }) {
  if (!scroll) {
    return <View style={[styles.screen, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, style]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
      }
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/* ---------- Dòng thông tin nhãn — giá trị ---------- */
export function InfoRow({ label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value ?? "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  screenContent: { padding: spacing.lg, paddingBottom: spacing.xxl },

  btn: {
    minHeight: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnOutline: { borderWidth: 1, borderColor: colors.hairline },
  btnRow: { flexDirection: "row", alignItems: "center" },
  btnText: { ...font.h3 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.hairline,
  },

  sectionTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sectionTitleText: { ...font.h2, color: colors.ink },

  field: { marginBottom: spacing.md },
  fieldLabel: { ...font.small, color: colors.muted, marginBottom: 6, fontWeight: "600" },
  fieldHint: { ...font.tiny, color: colors.faint, marginTop: 4 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    ...font.body, color: colors.ink, minHeight: 48,
  },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  badgeText: { ...font.tiny, fontWeight: "700" },

  gradeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, alignSelf: "flex-start" },
  gradeBadgeText: { ...font.small, color: colors.white, fontWeight: "700" },
  dash: { ...font.body, color: colors.faint },

  center: { alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  stateText: { ...font.body, color: colors.muted, marginTop: spacing.md, textAlign: "center" },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },
  infoLabel: { ...font.body, color: colors.muted, flex: 1 },
  infoValue: { ...font.body, color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },
});
