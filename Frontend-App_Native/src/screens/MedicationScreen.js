import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Badge, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtTime } from "../lib/format";
import { medicationStatuses } from "../lib/enums";
import { isConflict } from "../api/client";
import {
  requestNotificationPermission,
  hasActiveMedicationReminders,
  rescheduleMedicationReminders,
  cancelAllMedicationReminders,
  buildReminderSlots,
  loadReminderOverrides,
  saveReminderOverride,
  clearReminderOverride,
} from "../lib/notifications";

/**
 * Thuốc hôm nay — đánh dấu đã uống, và bật nhắc kiểu báo thức theo giờ từng liều.
 * Thông báo cục bộ lặp hằng ngày; không phụ thuộc server.
 */
export default function MedicationScreen() {
  const data = useData();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [togglingReminder, setTogglingReminder] = useState(false);
  const meds = useAsync(() => data.medication.today(), []);

  const list = meds.data || [];

  const [overrides, setOverrides] = useState({});
  const [editingSlot, setEditingSlot] = useState(null); // mốc giờ đang chỉnh

  // Các mốc giờ nhắc (đã áp giờ bệnh nhân chỉnh) — để hiển thị & chỉnh.
  const slots = buildReminderSlots(list, overrides);

  // Kiểm tra trạng thái nhắc đã bật + nạp giờ đã chỉnh (khi mở màn).
  useEffect(() => {
    hasActiveMedicationReminders().then(setRemindersOn).catch(() => {});
    loadReminderOverrides().then(setOverrides).catch(() => {});
  }, []);

  // Lưu giờ bệnh nhân vừa chỉnh cho một mốc, rồi đặt lại báo thức (nếu đang bật).
  const applyEditedTime = async (origKey, hour, minute) => {
    const map = await saveReminderOverride(origKey, hour, minute);
    setOverrides(map);
    setEditingSlot(null);
    if (remindersOn) {
      await rescheduleMedicationReminders(list);
      toast.push("Đã cập nhật giờ nhắc.", "success");
    }
  };

  // Đưa một mốc về giờ mặc định của backend.
  const resetSlotTime = async (origKey) => {
    const map = await clearReminderOverride(origKey);
    setOverrides(map);
    setEditingSlot(null);
    if (remindersOn) {
      await rescheduleMedicationReminders(list);
      toast.push("Đã trả giờ về mặc định.", "success");
    }
  };

  // Bật/tắt nhắc thuốc: xin quyền rồi đặt lịch theo giờ các liều hôm nay.
  const toggleReminders = async (next) => {
    setTogglingReminder(true);
    try {
      if (next) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          toast.push("Cần cấp quyền thông báo để bật nhắc thuốc.", "error");
          setTogglingReminder(false);
          return;
        }
        if (!slots.length) {
          toast.push("Chưa có lịch uống thuốc để đặt nhắc.", "error");
          setTogglingReminder(false);
          return;
        }
        // Đặt lại toàn bộ theo giờ hiện hành (đã áp giờ chỉnh) — chống trùng.
        const n = await rescheduleMedicationReminders(list);
        setRemindersOn(true);
        toast.push(`Đã bật nhắc cho ${n} mốc giờ mỗi ngày.`, "success");
      } else {
        await cancelAllMedicationReminders();
        setRemindersOn(false);
        toast.push("Đã tắt nhắc uống thuốc.", "success");
      }
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setTogglingReminder(false);
    }
  };
  const takenCount = list.filter((m) => m.status === 1).length;
  const adherencePercent = list.length ? Math.round((takenCount / list.length) * 100) : 0;
  const currentPrescription = list[0]?.prescriptionName || list[0]?.prescription?.name || "Đơn thuốc hiện tại";

  // Liều chưa uống mà đã quá giờ (để nhắc nổi bật).
  const now = new Date();
  const overdueCount = list.filter(
    (m) => m.status !== 1 && m.scheduledAt && new Date(m.scheduledAt) < now,
  ).length;

  const setMedicationStatus = async (item, status) => {
    try {
      await data.medication.setStatus(item.id, status, item.rowVersion);
      toast.push(
        status === 1
          ? "Đã xác nhận uống thuốc."
          : status === 2
            ? "Đã ghi nhận bỏ qua liều."
            : "Đã hoàn tác về chưa uống.",
        "success",
      );
      await meds.reload();
    } catch (e) {
      if (isConflict(e)) {
        toast.push("Liều thuốc vừa được cập nhật ở thiết bị khác. Đã tải lại dữ liệu mới.", "error");
        await meds.reload();
        return;
      }
      toast.push(e.message, "error");
    }
  };

  const toggle = (item) =>
    setMedicationStatus(item, item.status === 1 ? 0 : 1);

  const onRefresh = async () => { setRefreshing(true); await meds.reload(); setRefreshing(false); };

  return (
    <>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* Bật nhắc kiểu báo thức */}
      <Card style={styles.reminderCard}>
        <View style={styles.reminderLeft}>
          <Ionicons name="alarm-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.reminderTitle}>Nhắc uống thuốc</Text>
            <Text style={styles.reminderSub}>
              {remindersOn
                ? "Đang bật — nhắc mỗi ngày theo giờ từng liều."
                : "Bật để nhận thông báo báo thức theo giờ uống."}
            </Text>
          </View>
        </View>
        <Switch
          value={remindersOn}
          onValueChange={toggleReminders}
          disabled={togglingReminder || !list.length}
          trackColor={{ true: colors.primary, false: colors.hairline }}
          thumbColor={colors.white}
        />
      </Card>

      {/* Giờ nhắc từng mốc — bệnh nhân chỉnh được, mặc định theo bác sĩ */}
      {slots.length > 0 && (
        <Card style={styles.slotsCard}>
          <Text style={styles.slotsTitle}>Giờ nhắc trong ngày</Text>
          <Text style={styles.slotsHint}>
            Giờ mặc định theo chỉ định. Chạm để chỉnh cho phù hợp sinh hoạt của bạn.
          </Text>
          {slots.map((s) => (
            <TouchableOpacity
              key={s.origKey}
              style={styles.slotRow}
              onPress={() => setEditingSlot(s)}
              activeOpacity={0.7}
            >
              <View style={styles.slotTime}>
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text style={styles.slotTimeText}>
                  {two(s.hour)}:{two(s.minute)}
                </Text>
                {s.edited && <Text style={styles.slotEdited}>đã chỉnh</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.slotDrug} numberOfLines={1}>
                  {s.dose || s.drugName}
                </Text>
              </View>
              <Ionicons name="create-outline" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {overdueCount > 0 && (
        <Card style={styles.overdueCard}>
          <Ionicons name="warning-outline" size={20} color={colors.alert} />
          <Text style={styles.overdueText}>
            {overdueCount} liều đã quá giờ mà chưa xác nhận uống.
          </Text>
        </Card>
      )}

      {list.length > 0 && (
        <>
          <Card style={styles.head}>
            <Text style={styles.headTitle}>Đơn thuốc hiện tại</Text>
            <Text style={styles.headCount}>{currentPrescription}</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.headSub}>Tuân thủ hôm nay</Text>
              <Badge text={`${adherencePercent}%`} kind={adherencePercent >= 80 ? "ok" : adherencePercent >= 50 ? "warn" : "alert"} />
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${adherencePercent}%` }]} />
            </View>
            <Text style={styles.headMeta}>{takenCount}/{list.length} liều đã được xác nhận</Text>
          </Card>

          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{takenCount}</Text>
                <Text style={styles.summaryLabel}>Đã uống</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{list.length - takenCount}</Text>
                <Text style={styles.summaryLabel}>Còn lại</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{adherencePercent}%</Text>
                <Text style={styles.summaryLabel}>Tuân thủ</Text>
              </View>
            </View>
          </Card>
        </>
      )}

      <LoadState
        loading={meds.loading} error={meds.error}
        empty={!list.length} emptyText="Hôm nay bạn không có lịch uống thuốc."
        onRetry={meds.reload}
      >
        {list.map((m) => {
          const taken = m.status === 1;
          const skipped = m.status === 2;
          const overdue = m.status === 0 && m.scheduledAt && new Date(m.scheduledAt) < now;
          return (
            <Card key={m.id} style={[styles.medCard, overdue && styles.medCardOverdue]}>
              <TouchableOpacity style={styles.check} onPress={() => toggle(m)} activeOpacity={0.7}>
                <View style={[styles.checkBox, taken && styles.checkBoxOn]}>
                  {taken && <Ionicons name="checkmark" size={20} color={colors.white} />}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.drugName, taken && styles.drugNameTaken]}>{m.drugName}</Text>
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={14} color={overdue ? colors.alert : colors.muted} />
                  <Text style={[styles.drugMeta, overdue && { color: colors.alert }]}>
                    {m.dose} · {fmtTime(m.scheduledAt)}
                  </Text>
                </View>
                {taken && m.takenAt && <Text style={styles.takenAt}>Đã uống lúc {fmtTime(m.takenAt)}</Text>}
                <View style={styles.statusActions}>
                  {m.status === 0 && (
                    <TouchableOpacity
                      style={styles.skipButton}
                      onPress={() => setMedicationStatus(m, 2)}
                    >
                      <Text style={styles.skipButtonText}>Bỏ qua liều</Text>
                    </TouchableOpacity>
                  )}
                  {skipped && (
                    <TouchableOpacity
                      style={styles.undoButton}
                      onPress={() => setMedicationStatus(m, 0)}
                    >
                      <Text style={styles.undoButtonText}>Hoàn tác</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {overdue ? (
                <Badge text="Quá giờ" kind="alert" />
              ) : (
                <Badge text={medicationStatuses[m.status]?.label || "—"} kind={medicationStatuses[m.status]?.kind || "muted"} />
              )}
            </Card>
          );
        })}
      </LoadState>

      {list.length > 0 && (
        <Text style={styles.hint}>Chạm vào ô vuông để đánh dấu đã uống. Chạm lần nữa để hoàn tác nếu bấm nhầm.</Text>
      )}
    </Screen>

      {editingSlot && (
        <TimeEditModal
          slot={editingSlot}
          onClose={() => setEditingSlot(null)}
          onSave={applyEditedTime}
          onReset={resetSlotTime}
        />
      )}
    </>
  );
}

/** Chỉnh giờ nhắc cho một mốc: nhập giờ (0–23) và phút (0–59). */
function TimeEditModal({ slot, onClose, onSave, onReset }) {
  const [hour, setHour] = useState(String(slot.hour));
  const [minute, setMinute] = useState(String(slot.minute));

  const save = () => {
    const h = Number(hour);
    const m = Number(minute);
    if (isNaN(h) || h < 0 || h > 23) return;
    if (isNaN(m) || m < 0 || m > 59) return;
    onSave(slot.origKey, h, m);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.timeModalWrap}>
        <View style={styles.timeModalCard}>
          <Text style={styles.timeModalTitle}>Chỉnh giờ nhắc</Text>
          <Text style={styles.timeModalSub}>{slot.dose || slot.drugName}</Text>

          <View style={styles.timeInputs}>
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>Giờ</Text>
              <TextInput
                value={hour}
                onChangeText={setHour}
                keyboardType="number-pad"
                maxLength={2}
                style={styles.timeInput}
                selectTextOnFocus
              />
            </View>
            <Text style={styles.timeColon}>:</Text>
            <View style={styles.timeField}>
              <Text style={styles.timeLabel}>Phút</Text>
              <TextInput
                value={minute}
                onChangeText={setMinute}
                keyboardType="number-pad"
                maxLength={2}
                style={styles.timeInput}
                selectTextOnFocus
              />
            </View>
          </View>

          {slot.edited && (
            <TouchableOpacity onPress={() => onReset(slot.origKey)} style={styles.resetBtn}>
              <Ionicons name="refresh-outline" size={16} color={colors.muted} />
              <Text style={styles.resetText}>
                Về giờ mặc định ({two(slot.origHour)}:{two(slot.origMinute)})
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.timeActions}>
            <TouchableOpacity onPress={onClose} style={[styles.timeBtn, styles.timeBtnGhost]}>
              <Text style={styles.timeBtnGhostText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={[styles.timeBtn, styles.timeBtnPrimary]}>
              <Text style={styles.timeBtnPrimaryText}>Lưu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Đệm 0 cho số giờ/phút một chữ số. */
function two(n) {
  return String(n).padStart(2, "0");
}

const styles = StyleSheet.create({
  reminderCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.md, gap: spacing.md,
  },
  reminderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  reminderTitle: { ...font.h3, color: colors.ink },
  reminderSub: { ...font.small, color: colors.muted, marginTop: 2 },
  overdueCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md,
    backgroundColor: "#fdecea", borderColor: "#f5c6c2",
  },
  overdueText: { ...font.small, color: colors.alert, flex: 1, fontWeight: "600" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  medCardOverdue: { borderColor: "#f5c6c2", borderWidth: 1 },

  slotsCard: { padding: spacing.md },
  slotsTitle: { ...font.h3, color: colors.ink },
  slotsHint: { ...font.small, color: colors.muted, marginTop: 2, marginBottom: spacing.sm },
  slotRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline,
  },
  slotTime: { flexDirection: "row", alignItems: "center", gap: 4, width: 96 },
  slotTimeText: { ...font.h3, color: colors.ink },
  slotEdited: { ...font.tiny, color: colors.primary },
  slotDrug: { ...font.small, color: colors.muted },

  timeModalWrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", padding: spacing.lg },
  timeModalCard: { width: "100%", maxWidth: 340, backgroundColor: colors.canvas, borderRadius: radius.lg || 16, padding: spacing.lg },
  timeModalTitle: { ...font.h2, color: colors.ink },
  timeModalSub: { ...font.small, color: colors.muted, marginTop: 2, marginBottom: spacing.lg },
  timeInputs: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: spacing.md },
  timeField: { alignItems: "center" },
  timeLabel: { ...font.small, color: colors.muted, marginBottom: 4 },
  timeInput: {
    width: 72, height: 60, borderRadius: radius.md, borderWidth: 1, borderColor: colors.hairline,
    backgroundColor: colors.surface, textAlign: "center", ...font.h1, color: colors.ink,
  },
  timeColon: { ...font.h1, color: colors.muted, marginBottom: 12 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: spacing.md },
  resetText: { ...font.small, color: colors.muted },
  timeActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  timeBtn: { flex: 1, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  timeBtnGhost: { borderWidth: 1, borderColor: colors.hairline },
  timeBtnGhostText: { ...font.h3, color: colors.muted },
  timeBtnPrimary: { backgroundColor: colors.primary },
  timeBtnPrimaryText: { ...font.h3, color: colors.white },
  head: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  headTitle: { ...font.small, color: colors.muted },
  headCount: { ...font.h1, color: colors.primary, marginVertical: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  headSub: { ...font.small, color: colors.muted },
  headMeta: { ...font.small, color: colors.muted, marginTop: 6 },
  progressBar: { height: 8, backgroundColor: colors.surface, borderRadius: 4, overflow: "hidden", marginTop: 8 },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 4 },
  summaryCard: { paddingVertical: spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { ...font.h3, color: colors.ink },
  summaryLabel: { ...font.small, color: colors.muted, marginTop: 2 },

  medCard: { flexDirection: "row", alignItems: "center", padding: spacing.md },
  check: { marginRight: spacing.md },
  checkBox: { width: 32, height: 32, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  checkBoxOn: { backgroundColor: colors.ok, borderColor: colors.ok },
  drugName: { ...font.h3, color: colors.ink },
  drugNameTaken: { textDecorationLine: "line-through", color: colors.muted },
  drugMeta: { ...font.small, color: colors.muted, marginTop: 2 },
  takenAt: { ...font.tiny, color: colors.ok, marginTop: 2 },
  statusActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  skipButton: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.warn },
  skipButtonText: { ...font.tiny, color: colors.warn, fontWeight: "600" },
  undoButton: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.muted },
  undoButtonText: { ...font.tiny, color: colors.muted, fontWeight: "600" },
  hint: { ...font.small, color: colors.faint, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.lg },
});
