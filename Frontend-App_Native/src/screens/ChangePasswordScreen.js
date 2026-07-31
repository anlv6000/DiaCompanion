import React, { useState } from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button, Field, Input, Card } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";

/**
 * Đổi mật khẩu. Dùng cho hai trường hợp:
 *  - Bệnh nhân chủ động đổi (từ mục Cá nhân).
 *  - Bắt buộc đổi mật khẩu tạm lần đầu đăng nhập (forceMode).
 */
export default function ChangePasswordScreen({ navigation, route }) {
  const force = route?.params?.force;
  const { changePassword, logout } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!current || !next) { toast.push("Nhập đủ mật khẩu hiện tại và mật khẩu mới.", "error"); return; }
    if (next !== confirm) { toast.push("Hai mật khẩu mới chưa trùng khớp.", "error"); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      toast.push("Đổi mật khẩu thành công.", "success");
      if (!force && navigation.canGoBack()) navigation.goBack();
      // Nếu là force, gỡ cờ mustChangePassword sẽ khiến điều hướng tự chuyển sang app chính.
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
      {force && (
        <Text style={styles.warn}>
          Bạn đang dùng mật khẩu tạm. Vui lòng đặt mật khẩu mới để tiếp tục sử dụng ứng dụng.
        </Text>
      )}
      <Card>
        <Field label="Mật khẩu hiện tại" required>
          <Input value={current} onChangeText={setCurrent} placeholder="Mật khẩu hiện tại" secureTextEntry />
        </Field>
        <Field label="Mật khẩu mới" required hint="Tối thiểu 8 ký tự, gồm chữ và số.">
          <Input value={next} onChangeText={setNext} placeholder="Mật khẩu mới" secureTextEntry />
        </Field>
        <Field label="Nhập lại mật khẩu mới" required>
          <Input value={confirm} onChangeText={setConfirm} placeholder="Nhập lại" secureTextEntry />
        </Field>
        <Button title="Cập nhật mật khẩu" onPress={submit} busy={busy} />
      </Card>
      {force && (
        <Button title="Đăng xuất" kind="ghost" onPress={logout} style={{ marginTop: spacing.sm }} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  warn: {
    ...font.body, color: colors.warn, backgroundColor: colors.warnSoft,
    padding: spacing.md, borderRadius: 12, marginBottom: spacing.lg, lineHeight: 21,
  },
});
