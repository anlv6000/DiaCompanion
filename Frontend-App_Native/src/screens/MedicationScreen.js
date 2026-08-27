import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch } from "react-native";
import AppModal from "../components/AppModal";
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
 * Thuốc hôm nay.
 *
 * Backend sinh mốc uống mặc định (08:00, 12:00...) từ số lần dùng/ngày.
 * Mobile chỉ cho phép đổi GIỜ NHẮC trên thiết bị; không sửa lịch MedicationLog.
 * Hướng dẫn dùng từng thuốc được lấy từ API đơn thuốc rồi ghép theo PrescriptionItemId,
 * nên không cần thay đổi MedicationLogDto ở backend.
 */
export default function MedicationScreen() {
  const data = useData();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);
  const [togglingReminder, setTogglingReminder] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [editingSlot, setEditingSlot] = useState(null);

  const meds = useAsync(() => data.medication.today(), []);

  // FE-only: lấy đơn thuốc để có Instruction của từng PrescriptionItem.
  // Endpoint /api/prescriptions đã có sẵn và Patient chỉ lấy được đơn của chính mình.
  const prescriptions = useAsync(
    () => data.prescriptions.list({ page: 1, pageSize: 100, voided: false }),
    [data.patientId],
  );

  const list = meds.data || [];
  const prescriptionRows = prescriptions.data?.items || prescriptions.data || [];

  const instructionByItem = useMemo(() => {
    const map = {};
    for (const prescription of prescriptionRows || []) {
      for (const item of prescription.items || []) {
        if (item?.id != null && item.instruction?.trim()) {
          map[item.id] = item.instruction.trim();
        }
      }
    }
    return map;
  }, [prescriptions.data]);

  const slots = useMemo(
    () => buildReminderSlots(list, overrides, instructionByItem),
    [meds.data, overrides, instructionByItem],
  );

  useEffect(() => {
    let alive = true;

    Promise.all([
      hasActiveMedicationReminders(data.patientId),
      loadReminderOverrides(data.patientId),
    ])
      .then(([active, map]) => {
        if (!alive) return;
        setRemindersOn(active);
        setOverrides(map);
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [data.patientId]);

  // Khi màn Thuốc lấy được dữ liệu mới, nếu reminder đang bật thì đặt lại từ
  // lịch hiện tại. Điều này giúp cập nhật nội dung/hướng dẫn và loại lịch cũ.
  useEffect(() => {
    if (!remindersOn || meds.loading || !data.patientId) return;

    rescheduleMedicationReminders(list, data.patientId, instructionByItem).catch(() => {
      // Không làm hỏng màn Thuốc nếu hệ điều hành từ chối reschedule.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindersOn, meds.data, prescriptions.data, data.patientId]);

  const applyEditedTime = async (origKey, hour, minute) => {
    try {
      const map = await saveReminderOverride(
        data.patientId,
        origKey,
        hour,
        minute,
      );
      setOverrides(map);
      setEditingSlot(null);

      if (remindersOn) {
        await rescheduleMedicationReminders(
          list,
          data.patientId,
          instructionByItem,
        );
      }
      toast.push("Đã cập nhật giờ nhắc trên thiết bị này.", "success");
    } catch (e) {
      toast.push(e.message || "Không cập nhật được giờ nhắc.", "error");
    }
  };

  const resetSlotTime = async (origKey) => {
    try {
      const map = await clearReminderOverride(data.patientId, origKey);
      setOverrides(map);
      setEditingSlot(null);

      if (remindersOn) {
        await rescheduleMedicationReminders(
          list,
          data.patientId,
          instructionByItem,
        );
      }
      toast.push("Đã khôi phục giờ nhắc mặc định.", "success");
    } catch (e) {
      toast.push(e.message || "Không khôi phục được giờ nhắc.", "error");
    }
  };

  const toggleReminders = async (next) => {
    setTogglingReminder(true);
    try {
      if (next) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          toast.push("Cần cấp quyền thông báo để bật nhắc thuốc.", "error");
          return;
        }

        if (!slots.length) {
          toast.push("Hôm nay chưa có mốc thuốc để đặt nhắc.", "error");
          return;
        }

        const count = await rescheduleMedicationReminders(
          list,
          data.patientId,
          instructionByItem,
        );
        setRemindersOn(true);
        toast.push(`Đã bật nhắc cho ${count} mốc giờ.`, "success");
      } else {
        await cancelAllMedicationReminders();
        setRemindersOn(false);
        toast.push("Đã tắt nhắc uống thuốc trên thiết bị này.", "success");
      }
    } catch (e) {
      toast.push(e.message || "Không cập nhật được nhắc thuốc.", "error");
    } finally {
      setTogglingReminder(false);
    }
  };

  const takenCount = list.filter((m) => m.status === 1).length;
  const adherencePercent = list.length
    ? Math.round((takenCount / list.length) * 100)
    : 0;
  const currentPrescription =
    list[0]?.prescriptionName ||
    list[0]?.prescription?.name ||
    "Đơn thuốc hiện tại";

  const now = new Date();
  const overdueCount = list.filter(
    (m) => m.status === 0 && m.scheduledAt && new Date(m.scheduledAt) < now,
  ).length;

  const setMedicationStatus = async (item, status) => {
    try {
      await data.medication.setStatus(item.id, status, item.rowVersion);
      toast.push(
        status === 1
          ? "Đã xác nhận uống thuốc."
          : status === 3
            ? "Đã ghi nhận bỏ qua liều."
            : "Đã hoàn tác về chưa uống.",
        "success",
      );
      await meds.reload();
    } catch (e) {
      if (isConflict(e)) {
        toast.push(
          "Liều thuốc vừa được cập nhật ở thiết bị khác. Đã tải lại dữ liệu mới.",
          "error",
        );
        await meds.reload();
        return;
      }
      toast.push(e.message, "error");
    }
  };

  const toggle = (item) =>
    setMedicationStatus(item, item.status === 1 ? 0 : 1);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([meds.reload(), prescriptions.reload()]);
    setRefreshing(false);
  };

  return (
    <>
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Card style={styles.reminderCard}>
          <View style={styles.reminderLeft}>
            <Ionicons name="alarm-outline" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.reminderTitle}>Nhắc uống thuốc</Text>
              <Text style={styles.reminderSub}>
                {remindersOn
                  ? "Đang bật — dùng giờ nhắc đã chọn trên thiết bị này."
                  : "Bật để nhận thông báo theo các mốc thuốc trong ngày."}
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

        {slots.length > 0 && (
          <Card style={styles.slotsCard}>
            <Text style={styles.slotsTitle}>Giờ nhắc trong ngày</Text>
            <Text style={styles.slotsHint}>
              Các mốc mặc định do hệ thống tự sinh. Bạn có thể đổi riêng giờ
              thông báo trên thiết bị này; đơn thuốc và lịch thuốc trên hệ thống
              không thay đổi.
            </Text>

            {slots.map((slot) => (
              <View key={slot.origKey} style={styles.slotBlock}>
                <View style={styles.slotHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.slotPeriod}>
                      {periodLabel(slot.origHour)}
                    </Text>
                    <View style={styles.slotTimesRow}>
                      <View>
                        <Text style={styles.slotTimeLabel}>Mốc mặc định</Text>
                        <Text style={styles.slotDefaultTime}>
                          {two(slot.origHour)}:{two(slot.origMinute)}
                        </Text>
                      </View>
                      <Ionicons
                        name="arrow-forward-outline"
                        size={16}
                        color={colors.faint}
                      />
                      <View>
                        <Text style={styles.slotTimeLabel}>Nhắc trên máy</Text>
                        <View style={styles.deviceTimeRow}>
                          <Text style={styles.slotDeviceTime}>
                            {two(slot.hour)}:{two(slot.minute)}
                          </Text>
                          {slot.edited && (
                            <Badge text="Đã chỉnh" kind="ok" />
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.editSlotButton}
                    onPress={() => setEditingSlot(slot)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.slotCount}>
                  {slot.items.length} thuốc trong mốc này
                </Text>

                {slot.items.map((item) => (
                  <View key={item.id} style={styles.slotMedicineRow}>
                    <View style={styles.slotMedicineDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slotMedicineName}>
                        {item.drugName}
                        {item.dose ? ` · ${item.dose}` : ""}
                      </Text>
                      <Text
                        style={
                          item.instruction
                            ? styles.slotInstruction
                            : styles.slotInstructionEmpty
                        }
                      >
                        {item.instruction
                          ? `Hướng dẫn: ${item.instruction}`
                          : "Chưa có hướng dẫn dùng thuốc riêng."}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
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
                <Badge
                  text={`${adherencePercent}%`}
                  kind={
                    adherencePercent >= 80
                      ? "ok"
                      : adherencePercent >= 50
                        ? "warn"
                        : "alert"
                  }
                />
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${adherencePercent}%` }]}
                />
              </View>
              <Text style={styles.headMeta}>
                {takenCount}/{list.length} liều đã được xác nhận
              </Text>
            </Card>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{takenCount}</Text>
                  <Text style={styles.summaryLabel}>Đã uống</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {list.length - takenCount}
                  </Text>
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
          loading={meds.loading}
          error={meds.error}
          empty={!list.length}
          emptyText="Hôm nay bạn không có lịch uống thuốc."
          onRetry={meds.reload}
        >
          {list.map((med) => {
            const taken = med.status === 1;
            const skipped = med.status === 3;
            const overdue =
              med.status === 0 &&
              med.scheduledAt &&
              new Date(med.scheduledAt) < now;
            const instruction = instructionByItem[med.prescriptionItemId];

            return (
              <Card
                key={med.id}
                style={[styles.medCard, overdue && styles.medCardOverdue]}
              >
                <TouchableOpacity
                  style={styles.check}
                  onPress={() => toggle(med)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkBox, taken && styles.checkBoxOn]}>
                    {taken && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={colors.white}
                      />
                    )}
                  </View>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.drugName, taken && styles.drugNameTaken]}
                  >
                    {med.drugName}
                  </Text>

                  <View style={styles.timeRow}>
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={overdue ? colors.alert : colors.muted}
                    />
                    <Text
                      style={[
                        styles.drugMeta,
                        overdue && { color: colors.alert },
                      ]}
                    >
                      {med.dose} · Mốc hệ thống {fmtTime(med.scheduledAt)}
                    </Text>
                  </View>

                  {instruction && (
                    <View style={styles.instructionRow}>
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color={colors.primary}
                      />
                      <Text style={styles.instructionText}>
                        {instruction}
                      </Text>
                    </View>
                  )}

                  {taken && med.takenAt && (
                    <Text style={styles.takenAt}>
                      Đã uống lúc {fmtTime(med.takenAt)}
                    </Text>
                  )}

                  <View style={styles.statusActions}>
                    {med.status === 0 && (
                      <TouchableOpacity
                        style={styles.skipButton}
                        onPress={() => setMedicationStatus(med, 3)}
                      >
                        <Text style={styles.skipButtonText}>Bỏ qua liều</Text>
                      </TouchableOpacity>
                    )}
                    {skipped && (
                      <TouchableOpacity
                        style={styles.undoButton}
                        onPress={() => setMedicationStatus(med, 0)}
                      >
                        <Text style={styles.undoButtonText}>Hoàn tác</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {overdue ? (
                  <Badge text="Quá giờ" kind="alert" />
                ) : (
                  <Badge
                    text={medicationStatuses[med.status]?.label || "—"}
                    kind={medicationStatuses[med.status]?.kind || "muted"}
                  />
                )}
              </Card>
            );
          })}
        </LoadState>

        {list.length > 0 && (
          <Text style={styles.hint}>
            Mốc giờ trên thẻ thuốc là lịch do hệ thống sinh. Giờ thông báo trên
            thiết bị có thể được chỉnh riêng ở phần “Giờ nhắc trong ngày”.
          </Text>
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

/**
 * Chỉnh giờ nhắc cục bộ bằng nút +/- thay vì bắt người dùng nhập hai ô số.
 * Phút thay đổi theo bước 5 phút; backend hiện sinh phút = 00.
 */
function TimeEditModal({ slot, onClose, onSave, onReset }) {
  const [hour, setHour] = useState(slot.hour);
  const [minute, setMinute] = useState(slot.minute);

  const changeHour = (delta) => {
    setHour((value) => (value + delta + 24) % 24);
  };

  const changeMinute = (delta) => {
    setMinute((value) => (value + delta + 60) % 60);
  };

  return (
    <AppModal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.timeModalWrap}>
        <View style={styles.timeModalCard}>
          <Text style={styles.timeModalTitle}>Đổi giờ nhắc trên thiết bị</Text>
          <Text style={styles.timeModalSub}>
            Mốc mặc định của hệ thống: {two(slot.origHour)}:{two(slot.origMinute)}
          </Text>

          <View style={styles.localOnlyNote}>
            <Ionicons
              name="phone-portrait-outline"
              size={17}
              color={colors.primary}
            />
            <Text style={styles.localOnlyText}>
              Thay đổi này chỉ áp dụng cho thông báo trên thiết bị này, không
              làm thay đổi đơn thuốc hoặc lịch thuốc trên hệ thống.
            </Text>
          </View>

          <Text style={styles.timePickerLabel}>Giờ nhắc mới</Text>
          <View style={styles.timePickerRow}>
            <TimeStepper
              value={two(hour)}
              onDecrease={() => changeHour(-1)}
              onIncrease={() => changeHour(1)}
              accessibilityLabel="Giờ"
            />
            <Text style={styles.timeColon}>:</Text>
            <TimeStepper
              value={two(minute)}
              onDecrease={() => changeMinute(-5)}
              onIncrease={() => changeMinute(5)}
              accessibilityLabel="Phút"
            />
          </View>

          {slot.edited && (
            <TouchableOpacity
              onPress={() => onReset(slot.origKey)}
              style={styles.resetBtn}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.muted} />
              <Text style={styles.resetText}>
                Khôi phục giờ mặc định {two(slot.origHour)}:{two(slot.origMinute)}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.timeActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.timeBtn, styles.timeBtnGhost]}
            >
              <Text style={styles.timeBtnGhostText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(slot.origKey, hour, minute)}
              style={[styles.timeBtn, styles.timeBtnPrimary]}
            >
              <Text style={styles.timeBtnPrimaryText}>Lưu giờ nhắc</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

function TimeStepper({ value, onDecrease, onIncrease, accessibilityLabel }) {
  return (
    <View style={styles.stepper} accessibilityLabel={accessibilityLabel}>
      <TouchableOpacity style={styles.stepperButton} onPress={onIncrease}>
        <Ionicons name="chevron-up" size={20} color={colors.primary} />
      </TouchableOpacity>
      <Text style={styles.stepperValue}>{value}</Text>
      <TouchableOpacity style={styles.stepperButton} onPress={onDecrease}>
        <Ionicons name="chevron-down" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

function periodLabel(hour) {
  if (hour < 11) return "Mốc buổi sáng";
  if (hour < 14) return "Mốc buổi trưa";
  if (hour < 18) return "Mốc buổi chiều";
  return "Mốc buổi tối";
}

function two(n) {
  return String(n).padStart(2, "0");
}

const styles = StyleSheet.create({
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    gap: spacing.md,
  },
  reminderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  reminderTitle: { ...font.h3, color: colors.ink },
  reminderSub: { ...font.small, color: colors.muted, marginTop: 2 },

  overdueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: "#fdecea",
    borderColor: "#f5c6c2",
  },
  overdueText: {
    ...font.small,
    color: colors.alert,
    flex: 1,
    fontWeight: "600",
  },

  slotsCard: { padding: spacing.md },
  slotsTitle: { ...font.h3, color: colors.ink },
  slotsHint: {
    ...font.small,
    color: colors.muted,
    marginTop: 4,
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  slotBlock: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  slotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  slotPeriod: { ...font.h3, color: colors.ink, marginBottom: 7 },
  slotTimesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  slotTimeLabel: { ...font.tiny, color: colors.faint },
  slotDefaultTime: { ...font.h3, color: colors.muted, marginTop: 1 },
  deviceTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  slotDeviceTime: { ...font.h3, color: colors.primary },
  editSlotButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  slotCount: {
    ...font.small,
    color: colors.muted,
    fontWeight: "600",
    marginTop: spacing.sm,
    marginBottom: 3,
  },
  slotMedicineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingTop: 7,
  },
  slotMedicineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  slotMedicineName: { ...font.small, color: colors.ink, fontWeight: "600" },
  slotInstruction: {
    ...font.tiny,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  slotInstructionEmpty: {
    ...font.tiny,
    color: colors.faint,
    marginTop: 2,
    fontStyle: "italic",
  },

  timeModalWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: spacing.lg,
  },
  timeModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.canvas,
    borderRadius: radius.lg || 16,
    padding: spacing.lg,
  },
  timeModalTitle: { ...font.h2, color: colors.ink },
  timeModalSub: {
    ...font.small,
    color: colors.muted,
    marginTop: 3,
    marginBottom: spacing.md,
  },
  localOnlyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  localOnlyText: {
    ...font.small,
    color: colors.muted,
    flex: 1,
    lineHeight: 19,
  },
  timePickerLabel: {
    ...font.small,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.lg,
    marginBottom: 5,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  stepper: { alignItems: "center" },
  stepperButton: {
    width: 54,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    minWidth: 64,
    textAlign: "center",
    ...font.h1,
    color: colors.ink,
    paddingVertical: 4,
  },
  timeColon: { ...font.h1, color: colors.muted },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    marginTop: spacing.md,
  },
  resetText: { ...font.small, color: colors.muted },
  timeActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  timeBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  timeBtnGhost: { borderWidth: 1, borderColor: colors.hairline },
  timeBtnGhostText: { ...font.h3, color: colors.muted },
  timeBtnPrimary: { backgroundColor: colors.primary },
  timeBtnPrimaryText: { ...font.h3, color: colors.white, textAlign: "center" },

  head: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  headTitle: { ...font.small, color: colors.muted },
  headCount: { ...font.h1, color: colors.primary, marginVertical: 4 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  headSub: { ...font.small, color: colors.muted },
  headMeta: { ...font.small, color: colors.muted, marginTop: 6 },
  progressBar: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  summaryCard: { paddingVertical: spacing.sm },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { ...font.h3, color: colors.ink },
  summaryLabel: { ...font.small, color: colors.muted, marginTop: 2 },

  medCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  medCardOverdue: { borderColor: "#f5c6c2", borderWidth: 1 },
  check: { marginRight: spacing.md },
  checkBox: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: { backgroundColor: colors.ok, borderColor: colors.ok },
  drugName: { ...font.h3, color: colors.ink },
  drugNameTaken: { textDecorationLine: "line-through", color: colors.muted },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  drugMeta: { ...font.small, color: colors.muted, marginTop: 2 },
  instructionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    marginTop: 6,
    paddingRight: 4,
  },
  instructionText: {
    ...font.small,
    color: colors.primary,
    flex: 1,
    lineHeight: 19,
  },
  takenAt: { ...font.tiny, color: colors.ok, marginTop: 4 },
  statusActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  skipButton: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warn,
  },
  skipButtonText: { ...font.tiny, color: colors.warn, fontWeight: "600" },
  undoButton: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.muted,
  },
  undoButtonText: { ...font.tiny, color: colors.muted, fontWeight: "600" },
  hint: {
    ...font.small,
    color: colors.faint,
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    lineHeight: 19,
  },
});
