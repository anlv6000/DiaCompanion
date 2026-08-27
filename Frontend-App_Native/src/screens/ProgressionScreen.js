import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useData } from "../contexts/DataContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, GradeBadge, LoadState, SectionTitle } from "../components/ui";
import { MiniChart } from "../components/MiniChart";
import { colors, gradeLabels } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDate, num } from "../lib/format";

/**
 * Diễn tiến bệnh — chỉ dùng mức DR đã được bác sĩ xác nhận.
 * Trục DR luôn cố định R0..R4 để người bệnh không hiểu nhầm độ dốc khi chỉ có
 * hai mức dữ liệu (bản cũ tự co min/max nên R2 -> R0 trông quá cực đoan).
 */
export default function ProgressionScreen() {
  const data = useData();
  const [months, setMonths] = useState(24);
  const prog = useAsync(() => data.progression.mine(months), [months]);

  const points = prog.data?.points || [];
  const drPoints = points
    .filter((p) => p.confirmedGrade != null)
    .map((p) => ({ x: p.date, y: p.confirmedGrade }));
  const hba1cPoints = points
    .map((p) => ({ x: p.date, y: p.hbA1c }))
    .filter((p) => p.y != null);

  const graded = points.filter((p) => p.confirmedGrade != null);
  const firstGrade = graded[0]?.confirmedGrade;
  const latest = graded.length ? graded[graded.length - 1] : null;
  const latestGrade = latest?.confirmedGrade;

  const comparison = (() => {
    if (firstGrade == null || latestGrade == null || graded.length < 2) return null;
    if (latestGrade > firstGrade) return {
      text: `Mức gần nhất cao hơn: R${firstGrade} → R${latestGrade}`,
      kind: "worse",
    };
    if (latestGrade < firstGrade) return {
      text: `Mức gần nhất thấp hơn: R${firstGrade} → R${latestGrade}`,
      kind: "better",
    };
    return { text: `Mức võng mạc ổn định ở R${latestGrade}`, kind: "same" };
  })();

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
        loading={prog.loading}
        error={prog.error}
        empty={!points.length}
        emptyText="Chưa có kết quả đã xác nhận trong khoảng thời gian này."
        onRetry={prog.reload}
      >
        {latest && (
          <Card style={styles.latestCard}>
            <Text style={styles.latestLabel}>Kết quả võng mạc gần nhất</Text>
            <View style={styles.latestRow}>
              <GradeBadge grade={latestGrade} />
              <View style={{ flex: 1 }}>
                <Text style={styles.latestGradeText}>{gradeLabels[latestGrade] || `R${latestGrade}`}</Text>
                <Text style={styles.latestDate}>{fmtDate(latest.date)}</Text>
              </View>
            </View>
            {comparison ? (
              <Text style={[
                styles.comparison,
                comparison.kind === "worse" && { color: colors.alert },
                comparison.kind === "better" && { color: colors.ok },
              ]}>
                {comparison.text}
              </Text>
            ) : null}
          </Card>
        )}

        <Card>
          <SectionTitle>Mức võng mạc theo thời gian</SectionTitle>
          <Text style={styles.chartHint}>
            Trục dọc cố định từ R0 đến R4. Mức càng cao thì bệnh võng mạc càng nặng.
          </Text>
          <MiniChart
            points={drPoints}
            color={colors.primary}
            yMin={0}
            yMax={4}
            yTicks={[
              { value: 0, label: "R0" },
              { value: 1, label: "R1" },
              { value: 2, label: "R2" },
              { value: 3, label: "R3" },
              { value: 4, label: "R4" },
            ]}
            showPointLabels
            pointLabelFormatter={(p) => `R${p.y}`}
            xLabelFormatter={(x) => shortDate(x)}
            showRange={false}
          />
          <Text style={styles.gradeLegend}>
            R0 Không bệnh · R1 Nhẹ · R2 Vừa · R3 Nặng · R4 Tăng sinh
          </Text>
        </Card>

        {hba1cPoints.length >= 2 && (
          <Card>
            <SectionTitle>HbA1c theo thời gian</SectionTitle>
            <Text style={styles.chartHint}>Các giá trị HbA1c được ghi nhận trong cùng khoảng thời gian.</Text>
            <MiniChart
              points={hba1cPoints}
              color={colors.warn}
              unit="%"
              xLabelFormatter={(x) => shortDate(x)}
            />
          </Card>
        )}

        {prog.data?.trendWarning ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>{prog.data.trendWarning}</Text>
          </View>
        ) : null}

        <Card>
          <SectionTitle>Chi tiết theo lần khám</SectionTitle>
          {[...points].reverse().map((p, i) => (
            <View key={`${p.date}-${i}`} style={styles.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailDate}>{fmtDate(p.date)}</Text>
                {p.confirmedGrade != null ? (
                  <Text style={styles.detailGradeLabel}>{gradeLabels[p.confirmedGrade] || `R${p.confirmedGrade}`}</Text>
                ) : (
                  <Text style={styles.detailGradeLabel}>Chưa có mức võng mạc</Text>
                )}
              </View>
              <GradeBadge grade={p.confirmedGrade} />
              <Text style={styles.detailHba1c}>
                {p.hbA1c != null ? `HbA1c ${num(p.hbA1c)}%` : "—"}
              </Text>
            </View>
          ))}
        </Card>
      </LoadState>
    </Screen>
  );
}

function shortDate(value) {
  const text = fmtDate(value);
  return text === "—" ? text : text.slice(0, 5);
}

const styles = StyleSheet.create({
  rangeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  rangeChip: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  rangeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rangeText: { ...font.small, color: colors.muted, fontWeight: "600" },
  rangeTextActive: { color: colors.white },

  latestCard: { backgroundColor: colors.primarySoft },
  latestLabel: { ...font.small, color: colors.muted, marginBottom: spacing.sm },
  latestRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  latestGradeText: { ...font.h3, color: colors.ink },
  latestDate: { ...font.small, color: colors.muted, marginTop: 2 },
  comparison: { ...font.small, color: colors.muted, marginTop: spacing.md, fontWeight: "600" },

  chartHint: { ...font.small, color: colors.muted, marginBottom: spacing.sm, lineHeight: 20 },
  gradeLegend: { ...font.tiny, color: colors.muted, marginTop: spacing.sm, lineHeight: 18 },

  warnBox: { padding: spacing.md, backgroundColor: colors.warnSoft, borderRadius: 12, marginBottom: spacing.md },
  warnText: { ...font.body, color: colors.warn, lineHeight: 21 },

  detailRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  detailDate: { ...font.body, color: colors.ink },
  detailGradeLabel: { ...font.tiny, color: colors.muted, marginTop: 2 },
  detailHba1c: { ...font.small, color: colors.muted, width: 92, textAlign: "right" },
});
