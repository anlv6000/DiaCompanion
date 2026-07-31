import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useData } from "../contexts/DataContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, GradeBadge, LoadState, SectionTitle } from "../components/ui";
import { MiniChart } from "../components/MiniChart";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDate, num } from "../lib/format";

/**
 * Diễn tiến bệnh — biểu đồ mức võng mạc đã xác nhận theo thời gian, kèm HbA1c.
 * Chỉ hiện kết quả bác sĩ đã duyệt (không có kết quả AI thô).
 */
export default function ProgressionScreen() {
  const data = useData();
  const [months, setMonths] = useState(24);
  const prog = useAsync(() => data.progression.mine(months), [months]);

  const points = prog.data?.points || [];
  const drPoints = points.map((p) => ({ x: p.date, y: p.confirmedGrade }));
  const hba1cPoints = points.map((p) => ({ x: p.date, y: p.hbA1c })).filter((p) => p.y != null);

  return (
    <Screen>
      <View style={styles.rangeRow}>
        {[6, 12, 24].map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMonths(m)}
            style={[styles.rangeChip, months === m && styles.rangeChipActive]}
          >
            <Text style={[styles.rangeText, months === m && styles.rangeTextActive]}>{m} tháng</Text>
          </TouchableOpacity>
        ))}
      </View>

      <LoadState
        loading={prog.loading} error={prog.error}
        empty={!points.length} emptyText="Chưa có kết quả đã xác nhận trong khoảng thời gian này."
        onRetry={prog.reload}
      >
        <Card>
          <SectionTitle>Mức võng mạc (R0–R4)</SectionTitle>
          <MiniChart points={drPoints} color={colors.primary} />
        </Card>

        {hba1cPoints.length >= 2 && (
          <Card>
            <SectionTitle>HbA1c (%)</SectionTitle>
            <MiniChart points={hba1cPoints} color={colors.warn} unit="%" />
          </Card>
        )}

        {prog.data?.trendWarning ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>{prog.data.trendWarning}</Text>
          </View>
        ) : null}

        <Card>
          <SectionTitle>Chi tiết theo lần khám</SectionTitle>
          {points.map((p, i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailDate}>{fmtDate(p.date)}</Text>
              <GradeBadge grade={p.confirmedGrade} />
              <Text style={styles.detailHba1c}>{p.hbA1c != null ? `HbA1c ${num(p.hbA1c)}%` : "—"}</Text>
            </View>
          ))}
        </Card>
      </LoadState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  rangeChip: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeText: { ...font.small, color: colors.muted, fontWeight: "600" },
  rangeTextActive: { color: colors.white },

  warnBox: { padding: spacing.md, backgroundColor: colors.warnSoft, borderRadius: 12, marginBottom: spacing.md },
  warnText: { ...font.body, color: colors.warn, lineHeight: 21 },

  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  detailDate: { ...font.body, color: colors.ink, flex: 1 },
  detailHba1c: { ...font.small, color: colors.muted, flex: 1, textAlign: "right" },
});
