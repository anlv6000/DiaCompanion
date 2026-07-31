import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { font, radius, spacing } from "../theme/typography";

// Thông báo nổi ngắn (toast) ở đáy màn hình, tự ẩn sau ~3.5s.
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const push = useCallback((text, kind = "info") => {
    setToast({ text, kind });
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() =>
        setToast(null),
      );
    }, 3500);
  }, [opacity]);

  const bg =
    toast?.kind === "error" ? colors.alert :
    toast?.kind === "success" ? colors.ok : colors.ink;

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {toast && (
        <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={styles.text}>{toast.text}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải nằm trong ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center", paddingHorizontal: spacing.xl },
  toast: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, maxWidth: "100%" },
  text: { ...font.body, color: colors.white, textAlign: "center" },
});
