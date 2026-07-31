import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Nhắc uống thuốc bằng thông báo cục bộ (không cần server đẩy).
 *
 * Luồng: xin quyền → đặt lịch nhắc lặp hằng ngày theo giờ uống của từng liều.
 * Chạy hoàn toàn trên máy, kể cả khi offline. Trên Android 13+ cần quyền
 * POST_NOTIFICATIONS (xin lúc chạy) và SCHEDULE_EXACT_ALARM (khai trong app.json).
 */

// Hiển thị thông báo cả khi app đang mở.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = "medication-reminders";

/** Tạo kênh thông báo trên Android (bắt buộc để có âm thanh/ưu tiên cao). */
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

/**
 * Xin quyền gửi thông báo. Trả về true nếu được cấp.
 * Gọi khi người dùng bật nhắc thuốc lần đầu.
 */
export async function requestNotificationPermission() {
  if (!Device.isDevice) {
    // Máy ảo/simulator có thể không nhận thông báo — vẫn cho tiếp tục khi phát triển.
    return true;
  }
  await ensureAndroidChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  return status === "granted";
}

/** Đã có quyền chưa (không hỏi lại). */
export async function hasNotificationPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/**
 * Đặt lịch nhắc lặp hằng ngày cho một danh sách liều thuốc.
 * @param {Array<{drugName:string, dose?:string, hour:number, minute:number}>} doses
 * Trả về số lịch đã đặt.
 */
export async function scheduleDailyMedicationReminders(doses) {
  await ensureAndroidChannel();
  // Xoá lịch cũ để tránh trùng khi người dùng bật lại.
  await cancelAllMedicationReminders();

  let count = 0;
  for (const d of doses) {
    if (d.hour == null || d.minute == null) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Đến giờ uống thuốc",
        body: d.dose ? `${d.drugName} · ${d.dose}` : d.drugName,
        sound: "default",
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
        data: { kind: "medication" },
      },
      trigger: {
        hour: d.hour,
        minute: d.minute,
        repeats: true, // lặp mỗi ngày cùng giờ
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
    });
    count += 1;
  }
  return count;
}

/** Huỷ toàn bộ lịch nhắc thuốc đã đặt. */
export async function cancelAllMedicationReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content?.data?.kind === "medication")
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Có đang bật lịch nhắc thuốc không (còn ít nhất một lịch). */
export async function hasActiveMedicationReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.content?.data?.kind === "medication");
}

/* ======================================================================== */
/*  GIỜ NHẮC DO BỆNH NHÂN CHỈNH (override) + reschedule an toàn             */
/* ======================================================================== */
//
// Backend đưa ra giờ mặc định cho từng liều (theo số lần/ngày). Bệnh nhân có thể
// chỉnh lại giờ của từng MỐC. Giờ đã chỉnh lưu cục bộ trên máy (AsyncStorage),
// khoá theo "mốc giờ gốc" (vd "8:0"). Nếu không chỉnh thì dùng luôn giờ mặc định.
//
// Nguyên tắc chống trùng: mọi thao tác đặt/đổi giờ đều gọi
// rescheduleMedicationReminders() — hàm này HỦY TOÀN BỘ báo thức thuốc rồi mới
// đặt lại theo giờ hiện hành, nên không bao giờ tồn tại hai báo thức cho một mốc.

const OVERRIDE_KEY = "med_reminder_overrides";

/** Khoá chuẩn hoá cho một mốc giờ gốc: "H:M" (không đệm 0). */
export function slotKey(hour, minute) {
  return `${hour}:${minute}`;
}

/** Đọc bảng giờ đã chỉnh { "8:0": {hour, minute}, ... }. */
export async function loadReminderOverrides() {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Lưu một chỉnh giờ cho mốc gốc origKey → giờ mới. */
export async function saveReminderOverride(origKey, hour, minute) {
  const map = await loadReminderOverrides();
  map[origKey] = { hour, minute };
  await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
  return map;
}

/** Bỏ chỉnh giờ của một mốc (quay về giờ mặc định của backend). */
export async function clearReminderOverride(origKey) {
  const map = await loadReminderOverrides();
  delete map[origKey];
  await AsyncStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
  return map;
}

/**
 * Từ danh sách liều hôm nay → các mốc giờ cần nhắc, đã áp giờ bệnh nhân chỉnh.
 * Trả về mảng { origKey, hour, minute, drugName, dose, edited }.
 * Gộp các thuốc uống cùng một mốc giờ gốc vào chung một báo thức.
 */
export function buildReminderSlots(list, overrides = {}) {
  const byOrig = new Map();
  for (const m of list || []) {
    if (!m.scheduledAt) continue;
    const dt = new Date(m.scheduledAt);
    const origKey = slotKey(dt.getHours(), dt.getMinutes());
    if (!byOrig.has(origKey)) {
      byOrig.set(origKey, {
        origKey,
        origHour: dt.getHours(),
        origMinute: dt.getMinutes(),
        names: [],
      });
    }
    byOrig.get(origKey).names.push(m.drugName);
  }

  return Array.from(byOrig.values()).map((s) => {
    const ov = overrides[s.origKey];
    return {
      origKey: s.origKey,
      origHour: s.origHour,
      origMinute: s.origMinute,
      hour: ov ? ov.hour : s.origHour,
      minute: ov ? ov.minute : s.origMinute,
      edited: !!ov,
      drugName: s.names.length > 1 ? `${s.names.length} loại thuốc` : s.names[0],
      dose: s.names.length > 1 ? s.names.join(", ") : undefined,
    };
  }).sort((a, b) => a.hour - b.hour || a.minute - b.minute);
}

/**
 * Đặt lại toàn bộ báo thức thuốc theo danh sách liều + giờ đã chỉnh.
 * LUÔN hủy hết trước khi đặt, đảm bảo mỗi mốc chỉ một báo thức.
 * Trả về số mốc đã đặt.
 */
export async function rescheduleMedicationReminders(list) {
  const overrides = await loadReminderOverrides();
  const slots = buildReminderSlots(list, overrides);
  return scheduleDailyMedicationReminders(slots);
}
