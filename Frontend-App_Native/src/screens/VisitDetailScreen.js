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
import { colors, gradeLabels } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { visitStatuses, referralTypes, metricContexts } from "../lib/enums";

/**
 * Chi tiết một lượt khám đã hoàn tất của chính Patient.
 * GET /api/visits/me/{id} trả thêm:
 *  - confirmedFindings: kết quả DR đã được bác sĩ xác nhận theo từng mắt;
 *  - prescriptions: đơn thuốc thuộc đúng lượt khám + hướng dẫn từng thuốc.
 *
 * Không hiển thị AI thô/disagreement/model version cho Patient ở màn này.
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
    recheckDate = d;
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
              {v.patientCode ? (
                <InfoRow label="Mã bệnh nhân" value={v.patientCode} />
              ) : null}
              <InfoRow label="Bác sĩ" value={v.doctorName || "—"} />
              <InfoRow label="Số ảnh đáy mắt" value={String(v.imageCount ?? 0)} />
              {closed && (
                <InfoRow label="Hoàn tất lúc" value={fmtDate(v.closedAt, true)} />
              )}
            </Card>

            {closed ? (
              <>
                <ConfirmedRetinaResults findings={v.confirmedFindings} />

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
                    label="Tái tầm soát"
                    value={
                      v.recheckMonths
                        ? `Sau ${v.recheckMonths} tháng`
                        : "Không hẹn cụ thể"
                    }
                  />
                  {recheckDate && (
                    <InfoRow
                      label="Ngày dự kiến"
                      value={fmtDate(recheckDate)}
                      valueColor={colors.primary}
                    />
                  )}
                </Card>

                <VisitHealthMetrics healthMetrics={v.healthMetrics} />
                <VisitPrescriptions prescriptions={v.prescriptions} />

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
                  Lượt khám đang diễn ra. Kết quả được bác sĩ xác nhận, kết luận
                  và thời gian tái tầm soát sẽ hiển thị sau khi lượt khám hoàn tất.
                </Text>
              </Card>
            )}
          </>
        )}
      </LoadState>
    </Screen>
  );
}

function ConfirmedRetinaResults({ findings }) {
  const rows = Array.isArray(findings) ? findings : [];

  return (
    <>
      <SectionTitle>Kết quả võng mạc</SectionTitle>
      {rows.length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.pending}>
            Lượt khám này chưa có kết quả võng mạc được bác sĩ xác nhận.
          </Text>
        </Card>
      ) : (
        rows.map((finding) => {
          const grade = Number(finding.finalGrade);
          const eye = gradeEyeLabel(finding.eye);
          const gradeText = gradeLabels[grade] || finding.finalGradeLabel || `R${grade}`;
          const gradeColor = colors.grade[grade] || colors.primary;

          return (
            <Card key={`${finding.eye}-${finding.confirmedAt || grade}`} style={styles.resultCard}>
              <View style={styles.resultHead}>
                <View>
                  <Text style={styles.eyeTitle}>{eye}</Text>
                  <Text style={styles.confirmedText}>Kết quả đã được bác sĩ xác nhận</Text>
                </View>
                <View style={[styles.gradePill, { backgroundColor: gradeColor }]}> 
                  <Text style={styles.gradePillText}>R{grade}</Text>
                </View>
              </View>

              <Text style={[styles.gradeText, { color: gradeColor }]}>{gradeText}</Text>
              {finding.confirmedBy ? (
                <Text style={styles.resultMeta}>Xác nhận bởi: {finding.confirmedBy}</Text>
              ) : null}
              {finding.confirmedAt ? (
                <Text style={styles.resultMeta}>Thời gian xác nhận: {fmtDate(finding.confirmedAt, true)}</Text>
              ) : null}
            </Card>
          );
        })
      )}
    </>
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
            value={`${glucose.value} ${glucose.unit}${glucose.context ? ` · ${metricContexts[glucose.context] || ""}` : ""}${glucose.isAbnormal ? " · Bất thường" : ""}`}
            valueColor={glucose.isAbnormal ? colors.alert : undefined}
          />
        )}
        {hba1c && (
          <InfoRow
            label="HbA1c"
            value={`${hba1c.value} ${hba1c.unit}${hba1c.isAbnormal ? " · Bất thường" : ""}`}
            valueColor={hba1c.isAbnormal ? colors.alert : undefined}
          />
        )}
        {bp && (
          <InfoRow
            label="Huyết áp"
            value={`${bp.systolicValue ?? "—"}/${bp.diastolicValue ?? "—"} ${bp.unit}${bp.isAbnormal ? " · Bất thường" : ""}`}
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

function VisitPrescriptions({ prescriptions }) {
  const rows = Array.isArray(prescriptions) ? prescriptions : [];

  return (
    <>
      <SectionTitle>Đơn thuốc của lượt khám</SectionTitle>
      {rows.length === 0 ? (
        <Card style={styles.card}>
          <Text style={styles.pending}>Lượt khám này không có đơn thuốc.</Text>
        </Card>
      ) : (
        rows.map((prescription, prescriptionIndex) => (
          <Card key={prescription.id || prescriptionIndex} style={styles.card}>
            <View style={styles.prescriptionHead}>
              <Text style={styles.prescriptionTitle}>
                Đơn thuốc {rows.length > 1 ? `#${prescriptionIndex + 1}` : ""}
              </Text>
              {prescription.issuedAt ? (
                <Text style={styles.prescriptionDate}>{fmtDate(prescription.issuedAt)}</Text>
              ) : null}
            </View>

            {(prescription.items || []).map((item, itemIndex) => (
              <View
                key={item.id || `${prescription.id}-${itemIndex}`}
                style={[styles.medicine, itemIndex > 0 && styles.medicineDivider]}
              >
                <Text style={styles.medicineName}>{item.drugName || "Thuốc"}</Text>
                <Text style={styles.medicineDetail}>
                  {item.dose || "—"} · {item.timesPerDay || 0} lần/ngày · {item.durationDays || 0} ngày
                </Text>
                <Text style={styles.instructionLabel}>Hướng dẫn</Text>
                <Text style={styles.instructionText}>
                  {item.instruction?.trim() || "Không có hướng dẫn dùng thuốc riêng."}
                </Text>
              </View>
            ))}

            {prescription.note?.trim() ? (
              <View style={styles.prescriptionNote}>
                <Text style={styles.instructionLabel}>Ghi chú của đơn thuốc</Text>
                <Text style={styles.instructionText}>{prescription.note}</Text>
              </View>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}

function gradeEyeLabel(eye) {
  if (Number(eye) === 0) return "Mắt phải (OD)";
  if (Number(eye) === 1) return "Mắt trái (OS)";
  return "Mắt chưa xác định";
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, marginBottom: spacing.sm },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  date: { ...font.h2, color: colors.ink },
  conclusion: { ...font.body, color: colors.ink, lineHeight: 22 },
  pending: { ...font.body, color: colors.muted, lineHeight: 22 },

  resultCard: { padding: spacing.md, marginBottom: spacing.sm },
  resultHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  eyeTitle: { ...font.h3, color: colors.ink },
  confirmedText: { ...font.tiny, color: colors.ok, marginTop: 3, fontWeight: "600" },
  gradePill: {
    minWidth: 42,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  gradePillText: { ...font.h3, color: colors.white, fontWeight: "700" },
  gradeText: { ...font.h3, marginTop: spacing.md },
  resultMeta: { ...font.small, color: colors.muted, marginTop: 5 },

  metricNotes: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  metricNote: { ...font.small, color: colors.muted, marginTop: 4 },

  prescriptionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  prescriptionTitle: { ...font.h3, color: colors.ink },
  prescriptionDate: { ...font.small, color: colors.muted },
  medicine: { paddingVertical: spacing.sm },
  medicineDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  medicineName: { ...font.h3, color: colors.ink },
  medicineDetail: { ...font.small, color: colors.muted, marginTop: 4 },
  instructionLabel: {
    ...font.tiny,
    color: colors.primary,
    fontWeight: "700",
    marginTop: spacing.sm,
    textTransform: "uppercase",
  },
  instructionText: { ...font.body, color: colors.ink, marginTop: 3, lineHeight: 21 },
  prescriptionNote: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
