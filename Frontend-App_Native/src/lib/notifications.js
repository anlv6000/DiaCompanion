import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Nhắc uống thuốc bằng thông báo cục bộ (không cần server đẩy).
 *
 * Backend sinh các mốc giờ mặc định theo số lần dùng thuốc trong ngày.
 * Mobile chỉ cho phép người bệnh đổi GIỜ NHẮC trên chính thiết bị này;
 * thao tác đó không sửa MedicationLog, đơn thuốc hay lịch mặc định ở backend.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = "medication-reminders";
const OVERRIDE_KEY_PREFIX = "med_reminder_overrides";

async function ensureAndroidChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Nhắc uống thuốc",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0E7C86",
    });
  }
}

export async function requestNotificationPermission() {
  if (!Device.isDevice) return true;

  await ensureAndroidChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  return status === "granted";
}

export async function hasNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

function reminderBody(slot) {
  const items = slot.items || [];
  if (items.length === 1) {
    const item = items[0];
    const firstLine = item.dose
      ? `${item.drugName} · ${item.dose}`
      : item.drugName;
    return item.instruction
      ? `${firstLine}\n${item.instruction}`
      : firstLine;
  }

  if (items.length > 1) {
    const names = items.map((x) => x.drugName).filter(Boolean).join(", ");
    return `${items.length} thuốc trong mốc này${names ? `: ${names}` : ""}`;
  }

  return slot.dose ? `${slot.drugName} · ${slot.dose}` : slot.drugName;
}

/**
 * Đặt một thông báo lặp hằng ngày cho mỗi mốc giờ.
 * Mỗi mốc có thể chứa một hoặc nhiều thuốc.
 */
export async function scheduleDailyMedicationReminders(slots, patientId) {
  await ensureAndroidChannel();
  await cancelAllMedicationReminders();

  let count = 0;
  for (const slot of slots || []) {
    if (slot.hour == null || slot.minute == null) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Đến giờ nhắc uống thuốc",
        body: reminderBody(slot),
        sound: "default",
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        data: {
          kind: "medication",
          patientId: patientId == null ? null : String(patientId),
          originalSlot: slot.origKey,
        },
      },
      trigger: {
        hour: slot.hour,
        minute: slot.minute,
        repeats: true,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });
    count += 1;
  }
  return count;
}

export async function cancelAllMedicationReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content?.data?.kind === "medication")
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Chỉ coi reminder là đang bật cho bệnh nhân hiện tại khi có lịch thuộc đúng patientId.
 * Lịch cũ của account khác sẽ được xoá ở lần reschedule kế tiếp.
 */
export async function hasActiveMedicationReminders(patientId) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const pid = patientId == null ? null : String(patientId);

  return scheduled.some((n) => {
    if (n.content?.data?.kind !== "medication") return false;
    if (pid == null) return true;
    return String(n.content?.data?.patientId ?? "") === pid;
  });
}

/* ======================================================================== */
/*  GIỜ NHẮC CỤC BỘ TRÊN THIẾT BỊ                                          */
/* ======================================================================== */

/** Mốc giờ mặc định do backend sinh, ví dụ "8:0". */
export function slotKey(hour, minute) {
  return `${hour}:${minute}`;
}

/**
 * Override được tách theo bệnh nhân trên cùng thiết bị.
 * Cùng một bệnh nhân vẫn giữ sở thích 08:00 -> 08:30 cho mốc hệ thống 08:00,
 * kể cả khi đơn thuốc thay đổi.
 */
function overrideStorageKey(patientId) {
  return `${OVERRIDE_KEY_PREFIX}:${patientId ?? "unknown"}`;
}

export async function loadReminderOverrides(patientId) {
  try {
    const raw = await AsyncStorage.getItem(overrideStorageKey(patientId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveReminderOverride(patientId, origKey, hour, minute) {
  const map = await loadReminderOverrides(patientId);
  map[origKey] = { hour, minute };
  await AsyncStorage.setItem(overrideStorageKey(patientId), JSON.stringify(map));
  return map;
}

export async function clearReminderOverride(patientId, origKey) {
  const map = await loadReminderOverrides(patientId);
  delete map[origKey];
  await AsyncStorage.setItem(overrideStorageKey(patientId), JSON.stringify(map));
  return map;
}

/**
 * Từ MedicationLog hôm nay -> các mốc nhắc trong ngày.
 * instructionByItem lấy từ API đơn thuốc và map theo prescriptionItemId,
 * nên không cần sửa MedicationLogDto ở backend.
 */
export function buildReminderSlots(list, overrides = {}, instructionByItem = {}) {
  const byOrig = new Map();

  for (const med of list || []) {
    if (!med.scheduledAt) continue;

    const dt = new Date(med.scheduledAt);
    const origKey = slotKey(dt.getHours(), dt.getMinutes());

    if (!byOrig.has(origKey)) {
      byOrig.set(origKey, {
        origKey,
        origHour: dt.getHours(),
        origMinute: dt.getMinutes(),
        items: [],
      });
    }

    byOrig.get(origKey).items.push({
      id: med.id,
      prescriptionItemId: med.prescriptionItemId,
      drugName: med.drugName,
      dose: med.dose,
      instruction: instructionByItem[med.prescriptionItemId] || null,
    });
  }

  return Array.from(byOrig.values())
    .map((slot) => {
      const override = overrides[slot.origKey];
      const names = slot.items.map((x) => x.drugName).filter(Boolean);

      return {
        ...slot,
        hour: override ? override.hour : slot.origHour,
        minute: override ? override.minute : slot.origMinute,
        edited: !!override,
        drugName:
          names.length > 1
            ? `${names.length} thuốc trong mốc này`
            : names[0] || "Thuốc",
        dose: names.length > 1 ? names.join(", ") : slot.items[0]?.dose,
      };
    })
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

/**
 * Đồng bộ lại toàn bộ reminder từ lịch thuốc mới nhất.
 * Luôn huỷ lịch thuốc cũ trước khi đặt lại để tránh trùng và loại bỏ lịch của account cũ.
 */
export async function rescheduleMedicationReminders(
  list,
  patientId,
  instructionByItem = {},
) {
  const overrides = await loadReminderOverrides(patientId);
  const slots = buildReminderSlots(list, overrides, instructionByItem);
  return scheduleDailyMedicationReminders(slots, patientId);
}
