import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Badge, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtTime } from "../lib/format";
import { medicationStatuses } from "../lib/enums";

/**
 * Thuốc hôm nay — đánh dấu đã uống, cho phép hoàn tác (bấm nhầm là chuyện thường).
 */
export default function MedicationScreen() {
  const data = useData();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const meds = useAsync(() => data.medication.today(), []);

  const list = meds.data || [];
  const takenCount = list.filter((m) => m.status === 1).length;

  const toggle = async (item) => {
    const nextTaken = item.status !== 1; // đang chưa uống -> đánh dấu uống, ngược lại hoàn tác
    try {
      await data.medication.setTaken(item.id, nextTaken);
      toast.push(nextTaken ? "Đã xác nhận uống thuốc." : "Đã hoàn tác.", "success");
      meds.reload();
    } catch (e) {
      toast.push(e.message, "error");
    }
  };

  const onRefresh = async () => { setRefreshing(true); await meds.reload(); setRefreshing(false); };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {list.length > 0 && (
        <Card style={styles.head}>
          <Text style={styles.headTitle}>Hôm nay</Text>
          <Text style={styles.headCount}>{takenCount}/{list.length} liều đã uống</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${list.length ? (takenCount / list.length) * 100 : 0}%` }]} />
          </View>
        </Card>
      )}

      <LoadState
        loading={meds.loading} error={meds.error}
        empty={!list.length} emptyText="Hôm nay bạn không có lịch uống thuốc."
        onRetry={meds.reload}
      >
        {list.map((m) => {
          const taken = m.status === 1;
          return (
            <Card key={m.id} style={styles.medCard}>
              <TouchableOpacity style={styles.check} onPress={() => toggle(m)} activeOpacity={0.7}>
                <View style={[styles.checkBox, taken && styles.checkBoxOn]}>
                  {taken && <Ionicons name="checkmark" size={20} color={colors.white} />}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.drugName, taken && styles.drugNameTaken]}>{m.drugName}</Text>
                <Text style={styles.drugMeta}>{m.dose} · {fmtTime(m.scheduledAt)}</Text>
                {taken && m.takenAt && <Text style={styles.takenAt}>Đã uống lúc {fmtTime(m.takenAt)}</Text>}
              </View>
              <Badge text={medicationStatuses[m.status]?.label || "—"} kind={medicationStatuses[m.status]?.kind || "muted"} />
            </Card>
          );
        })}
      </LoadState>

      {list.length > 0 && (
        <Text style={styles.hint}>Chạm vào ô vuông để đánh dấu đã uống. Chạm lần nữa để hoàn tác nếu bấm nhầm.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  headTitle: { ...font.small, color: colors.muted },
  headCount: { ...font.h1, color: colors.primary, marginVertical: 4 },
  progressBar: { height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: "hidden", marginTop: 4 },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },

  medCard: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  check: { marginRight: spacing.md },
  checkBox: { width: 32, height: 32, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  checkBoxOn: { backgroundColor: colors.ok, borderColor: colors.ok },
  drugName: { ...font.h3, color: colors.ink },
  drugNameTaken: { textDecorationLine: "line-through", color: colors.muted },
  drugMeta: { ...font.small, color: colors.muted, marginTop: 2 },
  takenAt: { ...font.tiny, color: colors.ok, marginTop: 2 },
  hint: { ...font.small, color: colors.faint, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
});
