import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useData } from "../contexts/DataContext";
import { useAsync } from "../lib/hooks";
import {
  Screen,
  Card,
  Badge,
  LoadState,
  Button,
  SectionTitle,
  InfoRow,
} from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { visitStatuses, referralTypes, metricContexts } from "../lib/enums";

/**
 * Chi tiết một lượt khám (GET /api/visits/me/{id}).
 * Hiển thị kết luận của bác sĩ, hướng chuyển tuyến, và thời gian hẹn tái khám.
 * Khi lượt đã đóng, bệnh nhân có thể gửi phản hồi.
 */
export default function VisitDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const data = useData();
  const [refreshing, setRefreshing] = useState(false);
  const visit = useAsync(() => data.visits.get(id), [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await visit.reload();
    setRefreshing(false);
  };

  const v = visit.data;
  const closed = v?.status === 1;
  const st = v ? visitStatuses[v.status] || visitStatuses[0] : null;

  // Ngày tái khám dự kiến = ngày đóng + số tháng hẹn.
  let recheckDate = null;
  if (v?.closedAt && v?.recheckMonths) {
    const d = new Date(v.closedAt);
    d.setMonth(d.getMonth() + v.recheckMonths);
    recheckDate = d.toISOString();
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <LoadState
        loading={visit.loading}
        error={visit.error}
        empty={!v}
        emptyText="Không tìm thấy lượt khám."
        onRetry={visit.reload}
      >
        {v && (
          <>
            <Card style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.date}>{fmtDate(v.visitDate)}</Text>
                {st && <Badge text={st.label} kind={st.kind} />}
              </View>
              <InfoRow label="Bác sĩ" value={v.doctorName || "—"} />
              <InfoRow label="Số ảnh đáy mắt" value={String(v.imageCount ?? 0)} />
              {closed && (
                <InfoRow label="Đóng lúc" value={fmtDate(v.closedAt, true)} />
              )}
            </Card>

            <VisitHealthMetrics healthMetrics={v.healthMetrics} />

            {closed ? (
              <>
                <SectionTitle>Kết luận của bác sĩ</SectionTitle>
                <Card style={styles.card}>
                  <Text style={styles.conclusion}>
                    {v.conclusion || "Bác sĩ chưa ghi kết luận."}
                  </Text>
                </Card>

                <SectionTitle>Hướng xử trí</SectionTitle>
                <Card style={styles.card}>
                  <InfoRow
                    label="Chuyển tuyến"
                    value={referralTypes[v.referral ?? 0]}
                  />
                  <InfoRow
                    label="Hẹn tái khám"
                    value={
                      v.recheckMonths
                        ? `Sau ${v.recheckMonths} tháng`
                        : "Không hẹn cụ thể"
                    }
                  />
                  {recheckDate && (
                    <InfoRow
                      label="Ngày tái khám dự kiến"
                      value={fmtDate(recheckDate)}
                      valueColor={colors.primary}
                    />
                  )}
                </Card>

                <Button
                  title="Gửi phản hồi cho lượt khám này"
                  icon="chatbubble-ellipses-outline"
                  onPress={() =>
                    navigation.navigate("VisitFeedback", { visit: v })
                  }
                  style={{ marginTop: spacing.md }}
                />
              </>
            ) : (
              <Card style={styles.card}>
                <Text style={styles.pending}>
                  Lượt khám đang diễn ra. Kết luận và thời gian tái khám sẽ hiển
                  thị sau khi bác sĩ đóng lượt.
                </Text>
              </Card>
            )}
          </>
        )}
      </LoadState>
    </Screen>
  );
}


function VisitHealthMetrics({ healthMetrics }) {
  if (!healthMetrics) return null;
  const glucose = healthMetrics.glucose;
  const hba1c = healthMetrics.hbA1c;
  const bp = healthMetrics.bloodPressure;
  if (!glucose && !hba1c && !bp) return null;

  return (
    <>
      <SectionTitle>Chỉ số tại lượt khám</SectionTitle>
      <Card style={styles.card}>
        {glucose && (
          <InfoRow
            label="Đường huyết"
            value={`${glucose.value} ${glucose.unit}${glucose.context ? ` · ${metricContexts[glucose.context] || ""}` : ""}`}
            valueColor={glucose.isAbnormal ? colors.alert : undefined}
          />
        )}
        {hba1c && (
          <InfoRow
            label="HbA1c"
            value={`${hba1c.value} ${hba1c.unit}`}
            valueColor={hba1c.isAbnormal ? colors.alert : undefined}
          />
        )}
        {bp && (
          <InfoRow
            label="Huyết áp"
            value={`${bp.systolicValue ?? "—"}/${bp.diastolicValue ?? "—"} ${bp.unit}`}
            valueColor={bp.isAbnormal ? colors.alert : undefined}
          />
        )}
        {(glucose?.note || hba1c?.note || bp?.note) && (
          <View style={styles.metricNotes}>
            {glucose?.note ? <Text style={styles.metricNote}>Đường huyết: {glucose.note}</Text> : null}
            {hba1c?.note ? <Text style={styles.metricNote}>HbA1c: {hba1c.note}</Text> : null}
            {bp?.note ? <Text style={styles.metricNote}>Huyết áp: {bp.note}</Text> : null}
          </View>
        )}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, marginBottom: spacing.sm },
  head: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: spacing.sm,
  },
  date: { ...font.h2, color: colors.ink },
  conclusion: { ...font.body, color: colors.ink, lineHeight: 22 },
  pending: { ...font.body, color: colors.muted, lineHeight: 22 },
  metricNotes: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline },
  metricNote: { ...font.small, color: colors.muted, marginTop: 4 },
});
