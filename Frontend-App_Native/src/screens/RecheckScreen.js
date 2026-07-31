import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Badge, InfoRow, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";
import { fmtDateOnly, fmtDate } from "../lib/format";
import { referralTypes } from "../lib/enums";

/**
 * Tái tầm soát — ngày tái khám kế tiếp, tính từ lần khám hoàn tất gần nhất
 * (ClosedAt + số tháng hẹn tái khám). Không có đặt/hủy: bệnh nhân đến khám
 * trực tiếp trong giờ làm việc.
 */
export default function RecheckScreen() {
  const data = useData();
  const [refreshing, setRefreshing] = useState(false);
  const recheck = useAsync(() => data.recheck.mine(), []);

  const onRefresh = async () => { setRefreshing(true); await recheck.reload(); setRefreshing(false); };
  const r = recheck.data && recheck.data.hasRecheck !== false ? recheck.data : null;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <LoadState loading={recheck.loading} error={recheck.error} onRetry={recheck.reload}>
        {!r ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={48} color={colors.faint} />
            <Text style={styles.emptyTitle}>Chưa có lịch tái khám</Text>
            <Text style={styles.emptyText}>
              Lịch tái tầm soát sẽ được xác định sau lần khám tiếp theo của bạn tại phòng khám.
            </Text>
          </Card>
        ) : (
          <>
            <Card style={[styles.hero, r.isOverdue && styles.heroOverdue]}>
              <Ionicons
                name={r.isOverdue ? "alert-circle" : "calendar"}
                size={40}
                color={r.isOverdue ? colors.alert : colors.primary}
              />
              <Text style={styles.heroLabel}>Ngày tái tầm soát</Text>
              <Text style={[styles.heroDate, r.isOverdue && { color: colors.alert }]}>{fmtDateOnly(r.dueDate)}</Text>
              <Badge text={r.statusLabel} kind={r.isOverdue ? "alert" : "primary"} />
            </Card>

            <Card>
              <Text style={styles.sectionTitle}>Căn cứ tính lịch</Text>
              <InfoRow label="Lần khám gần nhất" value={fmtDate(r.lastVisitClosedAt)} />
              <InfoRow label="Hẹn tái khám sau" value={`${r.recheckMonths} tháng`} />
              <InfoRow
                label="Mức võng mạc đã xác nhận"
                value={r.lastConfirmedGradeLabel || "Chưa có"}
              />
              {r.referral != null && r.referral > 0 && (
                <InfoRow label="Chỉ định chuyển tuyến" value={referralTypes[r.referral]} />
              )}
            </Card>

            <View style={styles.noteBox}>
              <Ionicons name="information-circle-outline" size={20} color={colors.muted} />
              <Text style={styles.noteText}>
                Bạn đến khám trực tiếp trong giờ làm việc, không cần đặt lịch trước.
                Vui lòng mang theo giấy tờ tùy thân và sổ khám.
              </Text>
            </View>
          </>
        )}
      </LoadState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyCard: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { ...font.h2, color: colors.ink, marginTop: spacing.md },
  emptyText: { ...font.body, color: colors.muted, textAlign: "center", marginTop: spacing.sm, lineHeight: 21 },

  hero: { alignItems: "center", paddingVertical: spacing.xl, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  heroOverdue: { backgroundColor: colors.alertSoft, borderColor: colors.alertSoft },
  heroLabel: { ...font.body, color: colors.muted, marginTop: spacing.sm },
  heroDate: { fontSize: 32, fontWeight: "700", color: colors.primary, marginVertical: spacing.sm },

  sectionTitle: { ...font.h3, color: colors.ink, marginBottom: spacing.sm },
  noteBox: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.canvas, borderRadius: 12, alignItems: "flex-start" },
  noteText: { ...font.small, color: colors.muted, flex: 1, lineHeight: 20 },
});
