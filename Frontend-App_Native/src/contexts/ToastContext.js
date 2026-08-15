import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { font, radius, spacing } from "../theme/typography";

/**
 * Thông báo nổi ngắn (toast), tự ẩn sau ~3.5s.
 *
 * VÌ SAO THIẾT KẾ NHƯ THẾ NÀY
 *
 * Trên React Native, <Modal> tạo một CỬA SỔ NATIVE RIÊNG nằm trên toàn bộ cây
 * View của app. Hệ quả:
 *
 *  - Toast là View thường ở gốc app  -> bị popup che, người dùng không thấy.
 *  - Toast bọc trong <Modal> riêng    -> thấy được, nhưng cửa sổ đó nuốt hết
 *    thao tác chạm; pointerEvents KHÔNG xuyên qua ranh giới cửa sổ native.
 *    App bị khoá cho tới khi toast tự tắt.
 *
 * Cách duy nhất đạt cả hai: render toast NGAY TRONG cửa sổ đang hiển thị.
 * Vì vậy component <ToastHost /> được tách riêng và đặt ở hai nơi:
 *
 *  1. Trong ToastProvider — phục vụ các màn hình thường.
 *  2. Trong <AppModal>    — phục vụ mọi popup nhập liệu.
 *
 * Chỉ một cái hiển thị tại một thời điểm vì cả hai cùng đọc một state, và cửa
 * sổ nào đang ở trên thì người dùng thấy cái đó. Toast không nhận chạm
 * (pointerEvents="none") nên không cản trở thao tác trong popup.
 */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);

  const push = useCallback(
    (text, kind = "info") => {
      // Toast mới phải huỷ hẹn giờ của toast cũ, nếu không cái cũ sẽ tắt cái
      // mới ngay khi hết 3.5s của nó.
      if (hideTimer.current) clearTimeout(hideTimer.current);

      setToast({ text, kind });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();

      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 3500);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ push, toast, opacity }}>
      {children}
      <ToastHost />
    </ToastContext.Provider>
  );
}

/**
 * Phần hiển thị của toast.
 *
 * Đặt vào trong mỗi <Modal> để toast nổi lên trên popup mà KHÔNG chặn thao tác.
 * <AppModal> đã làm sẵn việc này, nên bình thường không cần gọi trực tiếp.
 */
export function ToastHost() {
  const ctx = useContext(ToastContext);
  if (!ctx?.toast) return null;

  const { toast, opacity } = ctx;
  const bg =
    toast.kind === "error" ? colors.alert : toast.kind === "success" ? colors.ok : colors.ink;

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      <View style={[styles.toast, { backgroundColor: bg }]}>
        <Text style={styles.text}>{toast.text}</Text>
      </View>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải nằm trong ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    // Popup nhập liệu là bottom-sheet, nút Lưu nằm sát đáy. Toast phải nổi cao
    // hơn nút vừa bấm, nếu không nó che đúng chỗ người dùng đang nhìn.
    bottom: Platform.OS === "ios" ? 140 : 120,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  toast: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    maxWidth: "100%",
  },
  text: { ...font.body, color: colors.white, textAlign: "center" },
});
