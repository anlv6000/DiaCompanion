import React, { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { authApi } from "../api/services";
import { Button, Field, Input } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";

/**
 * Đăng nhập bệnh nhân bằng SỐ ĐIỆN THOẠI.
 * Hai cách: mật khẩu, hoặc mã OTP (mã do quầy tiếp đón cấp — bản v1 chưa gửi SMS).
 */
export default function LoginScreen({ navigation }) {
  const { loginPassword, loginOtp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState("password"); // "password" | "otp"

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submitPassword = async () => {
    // Thiếu thông tin đăng nhập: backend trả thông điệp thống nhất.
    setBusy(true);
    try {
      await loginPassword(phone, password);
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async () => {
    // Số điện thoại rỗng: backend trả thông điệp.
    setBusy(true);
    try {
      const res = await authApi.requestOtp(phone.trim());
      setOtpSent(true);
      // Môi trường dev: backend trả devCode để test không cần SMS.
      if (res?.devCode) {
        setCode(String(res.devCode));
        toast.push(`Mã thử nghiệm: ${res.devCode}`, "success");
      } else {
        toast.push("Đã gửi yêu cầu mã. Liên hệ quầy tiếp đón để nhận mã.", "success");
      }
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async () => {
    // Thiếu số điện thoại hoặc mã: backend trả thông điệp.
    setBusy(true);
    try {
      await loginOtp(phone, code);
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo}><Ionicons name="eye-outline" size={34} color={colors.white} /></View>
          <Text style={styles.brandName}>DiaCompanion</Text>
          <Text style={styles.brandSub}>Đồng hành cùng bạn theo dõi võng mạc đái tháo đường</Text>
        </View>

        <View style={styles.card}>
          {/* Chọn cách đăng nhập */}
          <View style={styles.tabs}>
            <Tab active={mode === "password"} label="Mật khẩu" onPress={() => setMode("password")} />
            <Tab active={mode === "otp"} label="Mã OTP" onPress={() => setMode("otp")} />
          </View>

          <Field label="Số điện thoại" required>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
          </Field>

          {mode === "password" ? (
            <>
              <Field label="Mật khẩu" required>
                <View style={styles.passRow}>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mật khẩu"
                    secureTextEntry={!showPass}
                    style={{ flex: 1 }}
                  />
                  <TouchableOpacity onPress={() => setShowPass((x) => !x)} style={styles.eye}>
                    <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={22} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              </Field>
              <Button title="Đăng nhập" onPress={submitPassword} busy={busy} style={{ marginTop: spacing.sm }} />
              <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.link}>
                <Text style={styles.linkText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {otpSent && (
                <Field label="Mã xác minh" required hint="Mã gồm 6 chữ số, có hiệu lực trong ít phút.">
                  <Input
                    value={code}
                    onChangeText={setCode}
                    placeholder="Nhập mã 6 số"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </Field>
              )}
              {!otpSent ? (
                <Button title="Gửi mã xác minh" onPress={requestOtp} busy={busy} style={{ marginTop: spacing.sm }} />
              ) : (
                <>
                  <Button title="Đăng nhập" onPress={submitOtp} busy={busy} style={{ marginTop: spacing.sm }} />
                  <TouchableOpacity onPress={requestOtp} style={styles.link} disabled={busy}>
                    <Text style={styles.linkText}>Gửi lại mã</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>

        <Text style={styles.note}>
          Chưa có tài khoản? Tài khoản được cấp tại quầy tiếp đón khi bạn đăng ký khám.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Tab({ active, label, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: colors.canvas, padding: spacing.xl, justifyContent: "center" },
  brand: { alignItems: "center", marginBottom: spacing.xxl },
  logo: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  brandName: { ...font.h1, color: colors.ink },
  brandSub: { ...font.small, color: colors.muted, textAlign: "center", marginTop: 4, paddingHorizontal: spacing.lg },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.hairline,
  },
  tabs: { flexDirection: "row", backgroundColor: colors.canvas, borderRadius: radius.md, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: 1, shadowRadius: 4, elevation: 1 },
  tabText: { ...font.body, color: colors.muted, fontWeight: "600" },
  tabTextActive: { color: colors.primary },

  passRow: { flexDirection: "row", alignItems: "center" },
  eye: { position: "absolute", right: 12, padding: 4 },

  link: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  linkText: { ...font.body, color: colors.primary, fontWeight: "600" },

  note: { ...font.small, color: colors.faint, textAlign: "center", marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
