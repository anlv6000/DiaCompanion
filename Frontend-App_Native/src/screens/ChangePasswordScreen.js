import React, { useState } from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Button, Field, Input, Card } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";

export default function ChangePasswordScreen({ navigation, route }) {
  const { changePassword, changeFirstPassword, logout, mustChangePassword } = useAuth();
  // Dùng trạng thái auth làm nguồn chính; route param chỉ là lớp dự phòng.
  // Nhờ vậy màn bắt buộc đổi mật khẩu vẫn đúng ngay cả khi route params
  // không được truyền hoặc navigation state được khôi phục từ cache.
  const force = mustChangePassword || route?.params?.force === true;
  const toast = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    // Chỉ giữ đúng một kiểm tra ở FE: hai ô mật khẩu mới phải khớp.
    // Backend không nhận ô "nhập lại" nên không thể tự kiểm được.
    // Các luật còn lại (bắt buộc nhập, độ mạnh, mật khẩu hiện tại đúng/sai)
    // do backend quyết định và trả về thông điệp.
    if (next !== confirm) {
      toast.push("Hai mật khẩu mới chưa trùng khớp.", "error");
      return;
    }

    setBusy(true);
    try {
      if (force) {
        await changeFirstPassword(next);
      } else {
        await changePassword(current, next);
      }

      toast.push(
        force
          ? "Đã tạo mật khẩu mới. Đang mở trang chủ."
          : "Đổi mật khẩu thành công.",
        "success",
      );

      // Khi force: KHÔNG điều hướng thủ công. mustChangePassword đã thành false
      // nên RootNavigation tự thay ForceChangePasswordStack bằng MainStack,
      // vào thẳng Trang chủ.
      if (!force && navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: spacing.lg }}
      keyboardShouldPersistTaps="handled"
    >
      {force && (
        <Text style={styles.warn}>
          Đây là lần đăng nhập đầu tiên bằng mật khẩu tạm. Hãy tạo mật khẩu mới
          để vào ứng dụng.
        </Text>
      )}

      <Card>
        {!force && (
          <Field label="Mật khẩu hiện tại" required>
            <Input
              value={current}
              onChangeText={setCurrent}
              placeholder="Mật khẩu hiện tại"
              secureTextEntry
              autoCapitalize="none"
            />
          </Field>
        )}

        <Field
          label={force ? "Tạo mật khẩu mới" : "Mật khẩu mới"}
          required
          hint="Tối thiểu 8 ký tự, gồm chữ và số."
        >
          <Input
            value={next}
            onChangeText={setNext}
            placeholder="Mật khẩu mới"
            secureTextEntry
            autoCapitalize="none"
          />
        </Field>

        <Field label="Nhập lại mật khẩu mới" required>
          <Input
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Nhập lại mật khẩu mới"
            secureTextEntry
            autoCapitalize="none"
          />
        </Field>

        <Button
          title={force ? "Tạo mật khẩu và vào ứng dụng" : "Cập nhật mật khẩu"}
          onPress={submit}
          busy={busy}
        />
      </Card>

      {force && (
        <Button
          title="Đăng xuất"
          kind="ghost"
          onPress={logout}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  warn: {
    ...font.body,
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.lg,
    lineHeight: 21,
  },
});
