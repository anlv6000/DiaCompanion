import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Badge } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDateOnly, fmtTime } from "../lib/format";
import { medicationStatuses } from "../lib/enums";

/**
 * Trang chủ — bảng tổng quan cho bệnh nhân:
 *  - Lời chào + ngày tái khám kế tiếp.
 *  - Thuốc cần uống hôm nay (tóm tắt).
 *  - Lối tắt tới các mục thường dùng.
 */
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const data = useData();

  const recheck = useAsync(() => data.recheck.mine(), []);
  const meds = useAsync(() => data.medication.today(), []);

  // Làm mới chấm đỏ thông báo mỗi khi quay lại màn này.
  useFocusEffect(useCallback(() => { data.refreshUnread(); }, [data]));

  const recheckData = recheck.data && recheck.data.hasRecheck !== false ? recheck.data : null;
  const medList = meds.data || [];
  const takenCount = medList.filter((m) => m.status === 1).length;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([recheck.reload(), meds.reload(), data.refreshUnread()]);
    setRefreshing(false);
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Lời chào */}
      <View style={styles.greet}>
        <View>
          <Text style={styles.hello}>Xin chào,</Text>
          <Text style={styles.name}>{user?.fullName || "bạn"}</Text>
        </View>
        <TouchableOpacity style={styles.bell} onPress={() => navigation.navigate("Notifications")}>
          <Ionicons name="notifications-outline" size={24} color={colors.ink} />
          {data.unreadCount > 0 && <View style={styles.dot} />}
        </TouchableOpacity>
      </View>

      {/* Tái khám kế tiếp */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("Recheck")}>
        <Card style={styles.recheckCard}>
          <View style={styles.recheckHead}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={styles.recheckTitle}>Tái tầm soát kế tiếp</Text>
          </View>
          {recheck.loading ? (
            <Text style={styles.muted}>Đang tải…</Text>
          ) : recheckData ? (
            <>
              <Text style={styles.recheckDate}>{fmtDateOnly(recheckData.dueDate)}</Text>
              <Badge
                text={recheckData.statusLabel}
                kind={recheckData.isOverdue ? "alert" : "primary"}
              />
            </>
          ) : (
            <Text style={styles.muted}>
              Chưa có lịch tái khám. Lịch sẽ được xác định sau lần khám tiếp theo.
            </Text>
          )}
        </Card>
      </TouchableOpacity>

      {/* Thuốc hôm nay */}
      <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("Medication")}>
        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.recheckHead}>
              <Ionicons name="medkit-outline" size={20} color={colors.primary} />
              <Text style={styles.recheckTitle}>Thuốc hôm nay</Text>
            </View>
            {medList.length > 0 && (
              <Badge text={`${takenCount}/${medList.length} đã uống`} kind={takenCount === medList.length ? "ok" : "warn"} />
            )}
          </View>
          {meds.loading ? (
            <Text style={styles.muted}>Đang tải…</Text>
          ) : medList.length === 0 ? (
            <Text style={styles.muted}>Hôm nay không có lịch uống thuốc.</Text>
          ) : (
            medList.slice(0, 3).map((m) => (
              <View key={m.id} style={styles.medRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{m.drugName}</Text>
                  <Text style={styles.medDose}>{m.dose} · {fmtTime(m.scheduledAt)}</Text>
                </View>
                <Badge text={medicationStatuses[m.status]?.label || "—"} kind={medicationStatuses[m.status]?.kind || "muted"} />
              </View>
            ))
          )}
          {medList.length > 3 && <Text style={styles.more}>+{medList.length - 3} liều khác…</Text>}
        </Card>
      </TouchableOpacity>

      {/* Lối tắt */}
      <Text style={styles.sectionLabel}>Lối tắt</Text>
      <View style={styles.shortcuts}>
        <Shortcut icon="add-circle-outline" label="Ghi chỉ số" onPress={() => navigation.navigate("Metrics", { openCreate: true })} />
        <Shortcut icon="restaurant-outline" label="Nhật ký" onPress={() => navigation.navigate("Lifestyle")} />
        <Shortcut icon="warning-outline" label="Báo triệu chứng" onPress={() => navigation.navigate("Symptoms", { openCreate: true })} />
        <Shortcut icon="book-outline" label="Bài viết sức khỏe" onPress={() => navigation.navigate("Blog")} />
      </View>
    </Screen>
  );
}

function Shortcut({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.shortcutIcon}><Ionicons name={icon} size={24} color={colors.primary} /></View>
      <Text style={styles.shortcutLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  greet: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  hello: { ...font.body, color: colors.muted },
  name: { ...font.h1, color: colors.ink },
  bell: { padding: spacing.sm },
  dot: { position: "absolute", top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.alert },

  recheckCard: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  recheckHead: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  recheckTitle: { ...font.h3, color: colors.ink, marginLeft: 8 },
  recheckDate: { ...font.h1, color: colors.primary, marginBottom: spacing.sm },
  muted: { ...font.body, color: colors.muted, lineHeight: 21 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  medRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.hairline, marginTop: 8 },
  medName: { ...font.body, color: colors.ink, fontWeight: "600" },
  medDose: { ...font.small, color: colors.muted, marginTop: 2 },
  more: { ...font.small, color: colors.primary, marginTop: 8 },

  sectionLabel: { ...font.h3, color: colors.ink, marginTop: spacing.md, marginBottom: spacing.md },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  shortcut: {
    width: "47%", backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    alignItems: "center", borderWidth: 1, borderColor: colors.hairline,
  },
  shortcutIcon: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  shortcutLabel: { ...font.small, color: colors.ink, fontWeight: "600", textAlign: "center" },
});
