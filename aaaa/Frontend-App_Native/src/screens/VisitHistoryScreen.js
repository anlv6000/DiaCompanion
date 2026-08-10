import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Badge, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { visitStatuses } from "../lib/enums";

/**
 * Lịch sử lượt khám của bệnh nhân (GET /api/visits/me).
 * Mỗi lượt hiển thị ngày khám, bác sĩ, trạng thái. Bấm vào để xem kết quả chi
 * tiết (kết luận, chuyển tuyến, thời gian tái khám) và gửi phản hồi.
 */
export default function VisitHistoryScreen({ navigation }) {
  const data = useData();
  const [refreshing, setRefreshing] = useState(false);
  const visits = useAsync(() => data.visits.list({ pageSize: 50 }), []);

  const onRefresh = async () => {
    setRefreshing(true);
    await visits.reload();
    setRefreshing(false);
  };

  const items = visits.data?.items || visits.data || [];

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <LoadState
        loading={visits.loading}
        error={visits.error}
        empty={!items.length}
        emptyText="Chưa có lượt khám nào."
        onRetry={visits.reload}
      >
        {items.map((visit) => {
          const st = visitStatuses[visit.status] || visitStatuses[0];
          const closed = visit.status === 1;
          return (
            <TouchableOpacity
              key={visit.id}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("VisitDetail", { id: visit.id })}
            >
              <Card style={styles.card}>
                <View style={styles.head}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{fmtDate(visit.visitDate)}</Text>
                    <Text style={styles.meta}>
                      {visit.doctorName || "Chưa phân công bác sĩ"}
                    </Text>
                  </View>
                  <Badge text={st.label} kind={st.kind} />
                </View>

                {closed && visit.conclusion ? (
                  <Text style={styles.summary} numberOfLines={2}>
                    {visit.conclusion}
                  </Text>
                ) : (
                  <Text style={styles.summaryMuted}>
                    {closed
                      ? "Lượt khám đã đóng."
                      : "Lượt khám đang diễn ra."}
                  </Text>
                )}

                <View style={styles.footer}>
                  <Text style={styles.link}>Xem kết quả</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </LoadState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  title: { ...font.h3, color: colors.ink },
  meta: { ...font.small, color: colors.muted, marginTop: 4 },
  summary: { ...font.body, color: colors.ink, marginTop: spacing.sm, lineHeight: 21 },
  summaryMuted: { ...font.body, color: colors.muted, marginTop: spacing.sm },
  footer: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: spacing.md, alignSelf: "flex-end",
  },
  link: { ...font.small, color: colors.primary, fontWeight: "600" },
});
