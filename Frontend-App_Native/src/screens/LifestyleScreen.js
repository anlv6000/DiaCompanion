import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Button, Field, Input, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";
import { fmtDateOnly } from "../lib/format";

/**
 * Nhật ký lối sống: ăn uống + vận động, mỗi ngày một bản ghi.
 * Backend gộp cùng ngày thành một; ghi lại cùng ngày là cập nhật.
 */
export default function LifestyleScreen() {
  const data = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const logs = useAsync(() => data.lifestyle.list(30), []);

  const remove = (item) => {
    Alert.alert("Xóa nhật ký", "Ẩn bản ghi ngày này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa", style: "destructive",
        onPress: async () => {
          try { await data.lifestyle.remove(item.id); toast.push("Đã ẩn bản ghi.", "success"); logs.reload(); }
          catch (e) { toast.push(e.message, "error"); }
        },
      },
    ]);
  };

  const onRefresh = async () => { setRefreshing(true); await logs.reload(); setRefreshing(false); };
  const saved = () => { setEditing(null); logs.reload(); };

  return (
    <>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <LoadState
          loading={logs.loading} error={logs.error}
          empty={!logs.data?.length} emptyText="Chưa có nhật ký. Nhấn nút + để ghi hôm nay."
          onRetry={logs.reload}
        >
          {logs.data?.map((l) => (
            <Card key={l.id} style={styles.logCard}>
              <View style={styles.logHead}>
                <Text style={styles.logDate}>{fmtDateOnly(l.logLocalDate)}</Text>
                <View style={styles.logActions}>
                  <TouchableOpacity onPress={() => setEditing(l)} style={{ padding: 4 }}>
                    <Ionicons name="create-outline" size={18} color={colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(l)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.alert} />
                  </TouchableOpacity>
                </View>
              </View>
              {l.mealNote ? (
                <View style={styles.logLine}>
                  <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
                  <Text style={styles.logText}>{l.mealNote}{l.mealTags ? ` (${l.mealTags})` : ""}</Text>
                </View>
              ) : null}
              {l.exerciseMinutes ? (
                <View style={styles.logLine}>
                  <Ionicons name="walk-outline" size={16} color={colors.primary} />
                  <Text style={styles.logText}>{l.exerciseType || "Vận động"} · {l.exerciseMinutes} phút</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </LoadState>
      </Screen>

      <TouchableOpacity style={styles.fab} onPress={() => setEditing("new")} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {editing && <LifestyleForm value={editing} onClose={() => setEditing(null)} onSaved={saved} />}
    </>
  );
}

function LifestyleForm({ value, onClose, onSaved }) {
  const data = useData();
  const toast = useToast();
  const isNew = value === "new";
  const [mealNote, setMealNote] = useState(isNew ? "" : value.mealNote || "");
  const [mealTags, setMealTags] = useState(isNew ? "" : value.mealTags || "");
  const [exerciseType, setExerciseType] = useState(isNew ? "" : value.exerciseType || "");
  const [exerciseMinutes, setExerciseMinutes] = useState(isNew ? "" : value.exerciseMinutes ? String(value.exerciseMinutes) : "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!mealNote.trim() && !exerciseMinutes) { toast.push("Ghi ít nhất bữa ăn hoặc vận động.", "error"); return; }
    setBusy(true);
    try {
      await data.lifestyle.save({
        logLocalDate: isNew ? null : value.logLocalDate,
        mealNote: mealNote || null,
        mealTags: mealTags || null,
        exerciseType: exerciseType || null,
        exerciseMinutes: exerciseMinutes ? Number(exerciseMinutes) : null,
      });
      toast.push("Đã lưu nhật ký.", "success");
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
            <Text style={styles.modalTitle}>{isNew ? "Ghi nhật ký hôm nay" : "Sửa nhật ký"}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
          </View>

          <Text style={styles.groupLabel}>Ăn uống</Text>
          <Field label="Mô tả bữa ăn">
            <Input value={mealNote} onChangeText={setMealNote} placeholder="Ví dụ: cơm gạo lứt, rau luộc, cá" multiline />
          </Field>
          <Field label="Nhãn (tùy chọn)" hint="Ví dụ: ít đường, nhiều rau">
            <Input value={mealTags} onChangeText={setMealTags} placeholder="Cách nhau bằng dấu phẩy" />
          </Field>

          <Text style={styles.groupLabel}>Vận động</Text>
          <Field label="Hình thức">
            <Input value={exerciseType} onChangeText={setExerciseType} placeholder="Ví dụ: đi bộ, đạp xe" />
          </Field>
          <Field label="Thời lượng (phút)">
            <Input value={exerciseMinutes} onChangeText={setExerciseMinutes} placeholder="Ví dụ: 30" keyboardType="number-pad" />
          </Field>

          <Button title="Lưu nhật ký" onPress={save} busy={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  logCard: { padding: spacing.md },
  logHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  logDate: { ...font.h3, color: colors.ink },
  logActions: { flexDirection: "row", gap: spacing.sm },
  logLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  logText: { ...font.body, color: colors.muted, flex: 1 },

  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  modalTitle: { ...font.h2, color: colors.ink },
  groupLabel: { ...font.small, color: colors.primary, fontWeight: "700", marginBottom: spacing.sm, marginTop: spacing.sm },
});
