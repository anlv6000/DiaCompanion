import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Button, Field, Input, Badge, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { symptomSeverities, severityOptions } from "../lib/enums";

/**
 * Triệu chứng — bệnh nhân báo triệu chứng, nhận khuyến cáo tự động ngay,
 * và xem trả lời của bác sĩ (nếu có) trong giờ làm việc.
 */
export default function SymptomsScreen({ route }) {
  const data = useData();
  const [creating, setCreating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const list = useAsync(() => data.symptom.list({ pageSize: 50 }), []);

  useEffect(() => { if (route?.params?.openCreate) setCreating(true); }, [route?.params?.openCreate]);

  const onRefresh = async () => { setRefreshing(true); await list.reload(); setRefreshing(false); };

  return (
    <>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <View style={styles.emergencyBox}>
          <Ionicons name="warning" size={20} color={colors.alert} />
          <Text style={styles.emergencyText}>
            Đây không phải kênh cấp cứu. Nếu có dấu hiệu nguy hiểm, hãy gọi cấp cứu hoặc đến cơ sở y tế gần nhất ngay.
          </Text>
        </View>

        <LoadState
          loading={list.loading} error={list.error}
          empty={!list.data?.items?.length} emptyText="Bạn chưa gửi báo cáo triệu chứng nào."
          onRetry={list.reload}
        >
          {list.data?.items?.map((s) => (
            <Card key={s.id}>
              <View style={styles.symHead}>
                <Text style={styles.symName}>{s.symptoms}</Text>
                <Badge text={symptomSeverities[s.severity]?.label || "—"} kind={symptomSeverities[s.severity]?.kind || "muted"} />
              </View>
              <Text style={styles.symDate}>{fmtDate(s.createdAt, true)}</Text>
              {s.description ? <Text style={styles.symDesc}>{s.description}</Text> : null}

              <View style={styles.adviceBox}>
                <Text style={styles.adviceLabel}>Khuyến cáo tự động</Text>
                <Text style={styles.adviceText}>{s.autoAdvice}</Text>
              </View>

              {s.doctorReply ? (
                <View style={styles.replyBox}>
                  <View style={styles.replyHead}>
                    <Ionicons name="medical-outline" size={16} color={colors.primary} />
                    <Text style={styles.replyLabel}>
                      Phản hồi từ {s.repliedByName || s.responsibleDoctorName || "bác sĩ phụ trách"}
                    </Text>
                  </View>
                  <Text style={styles.replyText}>{s.doctorReply}</Text>
                  {s.repliedAt ? (
                    <Text style={styles.replyDate}>Phản hồi lúc {fmtDate(s.repliedAt, true)}</Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.pendingReply}>
                  <Badge text={s.state || "Chờ bác sĩ xem"} kind="warn" />
                  {s.responsibleDoctorName ? (
                    <Text style={styles.pendingDoctor}>
                      Bác sĩ phụ trách: {s.responsibleDoctorName}
                    </Text>
                  ) : null}
                </View>
              )}
            </Card>
          ))}
        </LoadState>
      </Screen>

      <TouchableOpacity style={styles.fab} onPress={() => setCreating(true)} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {creating && <SymptomForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload(); }} />}
    </>
  );
}

function SymptomForm({ onClose, onSaved }) {
  const data = useData();
  const toast = useToast();
  const [symptoms, setSymptoms] = useState("");
  const [severity, setSeverity] = useState(1);
  const [description, setDescription] = useState("");
  const [onsetNote, setOnsetNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!symptoms.trim()) { toast.push("Nhập triệu chứng bạn gặp.", "error"); return; }
    setBusy(true);
    try {
      await data.symptom.report({ symptoms: symptoms.trim(), severity, description: description || null, onsetNote: onsetNote || null });
      toast.push("Đã gửi báo cáo triệu chứng.", "success");
      onSaved();
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Báo triệu chứng</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
          </View>

          <Field label="Triệu chứng" required>
            <Input value={symptoms} onChangeText={setSymptoms} placeholder="Ví dụ: mờ mắt, nhức đầu" />
          </Field>
          <Field label="Mức độ" required>
            <View style={styles.sevRow}>
              {severityOptions.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setSeverity(s.value)}
                  style={[styles.sevChip, severity === s.value && styles.sevChipActive]}
                >
                  <Text style={[styles.sevText, severity === s.value && styles.sevTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <Field label="Mô tả chi tiết">
            <Input value={description} onChangeText={setDescription} placeholder="Diễn biến, hoàn cảnh xuất hiện…" multiline />
          </Field>
          <Field label="Bắt đầu từ khi nào">
            <Input value={onsetNote} onChangeText={setOnsetNote} placeholder="Ví dụ: 2 ngày trước" />
          </Field>

          <Button title="Gửi báo cáo" onPress={save} busy={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  emergencyBox: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.alertSoft, borderRadius: 12, marginBottom: spacing.md, alignItems: "flex-start" },
  emergencyText: { ...font.small, color: colors.alert, flex: 1, lineHeight: 19 },

  symHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  symName: { ...font.h3, color: colors.ink, flex: 1 },
  symDate: { ...font.small, color: colors.muted, marginTop: 2 },
  symDesc: { ...font.body, color: colors.muted, marginTop: spacing.sm },

  adviceBox: { backgroundColor: colors.canvas, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  adviceLabel: { ...font.tiny, color: colors.faint, fontWeight: "700", marginBottom: 4 },
  adviceText: { ...font.body, color: colors.ink, lineHeight: 21 },

  replyBox: { backgroundColor: colors.primarySoft, borderRadius: 12, padding: spacing.md, marginTop: spacing.sm },
  replyHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  replyLabel: { ...font.small, color: colors.primary, fontWeight: "700" },
  replyText: { ...font.body, color: colors.ink, lineHeight: 21 },
  replyDate: { ...font.tiny, color: colors.muted, marginTop: 8 },
  pendingReply: { marginTop: spacing.sm, alignItems: "flex-start", gap: 6 },
  pendingDoctor: { ...font.small, color: colors.muted },

  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  modalTitle: { ...font.h2, color: colors.ink },
  sevRow: { flexDirection: "row", gap: spacing.sm },
  sevChip: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  sevChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sevText: { ...font.body, color: colors.muted, fontWeight: "600" },
  sevTextActive: { color: colors.white },
});
