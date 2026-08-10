import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import {
  profileApi, metricsApi, lifestyleApi, medicationApi, recheckApi,
  progressionApi, symptomApi, notificationApi, blogApi, feedbackApi, visitsApi,
} from "../api/services";
import { useAuth } from "./AuthContext";

/**
 * DataContext — tầng dữ liệu DUY NHẤT giữa màn hình và backend.
 *
 * Nguyên tắc (giống bên web):
 *  - Mọi dữ liệu từ backend đi qua đây trước.
 *  - Màn hình gọi useData(); các component con nhận dữ liệu qua props.
 *  - Không màn hình nào import thẳng ../api/services.
 *
 * Ngoài các nhóm action, DataContext giữ vài state dùng chung: số thông báo
 * chưa đọc (để hiện chấm đỏ trên tab), và patientId lấy sẵn từ phiên.
 */
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { patientId } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const r = await notificationApi.unreadCount();
      setUnreadCount(r?.count || 0);
    } catch {
      // im lặng: chấm đỏ không quan trọng bằng nội dung màn
    }
  }, []);

  const value = useMemo(() => ({
    patientId,
    unreadCount,
    refreshUnread,

    profile: {
      me: () => profileApi.me(),
      updateMine: (body) => profileApi.updateMine(body),
      requestPhoneChangeOtp: (newPhone) => profileApi.requestPhoneChangeOtp(newPhone),
      confirmPhoneChange: (newPhone, code, rowVersion) =>
        profileApi.confirmPhoneChange(newPhone, code, rowVersion),
    },

    metrics: {
      list: (params) => metricsApi.list(params),
      create: (body) => metricsApi.create(body),
      update: (id, body) => metricsApi.update(id, body),
      remove: (id, rowVersion, pairRowVersion) => metricsApi.remove(id, rowVersion, pairRowVersion),
      summary: (days) => {
        if (!patientId) return Promise.reject(new Error("Chưa xác định được hồ sơ bệnh nhân."));
        return metricsApi.summary(patientId, days);
      },
    },

    lifestyle: {
      list: (days) => lifestyleApi.list(days),
      create: (body) => lifestyleApi.create(body),
      update: (id, body) => lifestyleApi.update(id, body),
      remove: (id, rowVersion) => lifestyleApi.remove(id, rowVersion),
    },

    medication: {
      today: () => medicationApi.today(),
      setStatus: (id, status, rowVersion) => medicationApi.setStatus(id, status, rowVersion),
    },

    recheck: {
      mine: () => recheckApi.mine(),
    },

    progression: {
      mine: (months) => progressionApi.mine(months),
    },

    symptom: {
      report: (body) => symptomApi.report(body),
      list: (params) => symptomApi.list(params),
    },

    notification: {
      list: (params) => notificationApi.list(params),
      unreadCount: () => notificationApi.unreadCount(),
      markRead: (id) => notificationApi.markRead(id),
      markAllRead: () => notificationApi.markAllRead(),
    },

    blog: {
      published: (params) => blogApi.published(params),
      get: (id) => blogApi.get(id),
    },

    feedback: {
      create: (body) => feedbackApi.create(body),
    },

    visits: {
      list: (params) => visitsApi.list(params),
      get: (id) => visitsApi.get(id),
    },
  }), [patientId, unreadCount, refreshUnread]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData phải nằm trong DataProvider");
  return ctx;
}
