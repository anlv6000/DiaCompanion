import React, { useState } from "react";
import { Text, StyleSheet, ScrollView } from "react-native";
import { useToast } from "../contexts/ToastContext";
import { authApi } from "../api/services";
import { Button, Field, Input, Card } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";

/**
 * Quên mật khẩu: gửi OTP tới số điện thoại rồi đặt lại mật khẩu bằng mã đó.
 * Hai bước gộp trong một màn cho gọn với bệnh nhân.
 */
export default function ForgotPasswordScreen({ navigation }) {
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    // Số điện thoại rỗng: backend trả thông điệp.
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(phone.trim());
      setSent(true);
      if (res?.devCode) {
        setCode(String(res.devCode));
        toast.push(`Mã thử nghiệm: ${res.devCode}`, "success");
      } else {
        toast.push("Nếu số đã đăng ký, mã xác minh sẽ được cấp.", "success");
      }
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    // Chỉ giữ khớp mật khẩu xác nhận — backend không nhận ô "nhập lại".
    if (newPass !== confirm) { toast.push("Hai mật khẩu chưa trùng khớp.", "error"); return; }
    setBusy(true);
    try {
      await authApi.resetPassword(phone.trim(), code.trim(), newPass);
      toast.push("Đặt lại mật khẩu thành công. Hãy đăng nhập.", "success");
      navigation.goBack();
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Nhập số điện thoại đã đăng ký để nhận mã xác minh, sau đó đặt mật khẩu mới.
      </Text>
      <Card>
        <Field label="Số điện thoại" required>
          <Input value={phone} onChangeText={setPhone} placeholder="09xxxxxxxx" keyboardType="phone-pad" editable={!sent} />
        </Field>
        {!sent ? (
          <Button title="Gửi mã xác minh" onPress={sendCode} busy={busy} />
        ) : (
          <>
            <Field label="Mã xác minh" required>
              <Input value={code} onChangeText={setCode} placeholder="Mã 6 số" keyboardType="number-pad" maxLength={6} />
            </Field>
            <Field label="Mật khẩu mới" required hint="Tối thiểu 8 ký tự, gồm chữ và số.">
              <Input value={newPass} onChangeText={setNewPass} placeholder="Mật khẩu mới" secureTextEntry />
            </Field>
            <Field label="Nhập lại mật khẩu mới" required>
              <Input value={confirm} onChangeText={setConfirm} placeholder="Nhập lại" secureTextEntry />
            </Field>
            <Button title="Đặt lại mật khẩu" onPress={reset} busy={busy} />
            <Button title="Gửi lại mã" kind="ghost" onPress={sendCode} busy={busy} style={{ marginTop: spacing.sm }} />
          </>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { ...font.body, color: colors.muted, marginBottom: spacing.lg, lineHeight: 21 },
});
