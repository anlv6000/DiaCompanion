import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import {
  Screen,
  Card,
  Button,
  Field,
  Input,
  InfoRow,
  GradeBadge,
  LoadState,
} from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { isConflict } from "../api/client";

const GENDERS = { 0: "Nam", 1: "Nữ", 2: "Khác" };
const DIABETES = {
  0: "Tiền đái tháo đường",
  1: "Type 1",
  2: "Type 2",
  3: "Thai kỳ",
};

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const data = useData();
  const [editing, setEditing] = useState(false);
  const [changingPhone, setChangingPhone] = useState(false);
  const profile = useAsync(() => data.profile.me(), []);
  const p = profile.data;

  const confirmLogout = () => {
    if (Platform.OS === "web") {
      logout();
      return;
    }
    logout();
  };

  return (
    <>
      <Screen>
        <Card style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(p?.fullName || user?.fullName || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{p?.fullName || user?.fullName}</Text>
          <Text style={styles.role}>Bệnh nhân</Text>
        </Card>

        <LoadState
          loading={profile.loading}
          error={profile.error}
          onRetry={profile.reload}
        >
          {p && (
            <>
              <Card>
                <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
                <InfoRow label="Mã bệnh nhân" value={p.code} />
                <InfoRow label="Họ tên" value={p.fullName} />
                <InfoRow label="Ngày sinh" value={fmtDate(p.dateOfBirth)} />
                <InfoRow
                  label="Giới tính"
                  value={GENDERS[p.gender] ?? "—"}
                />
                <InfoRow label="Số điện thoại" value={p.phone} />
                <InfoRow
                  label="Địa chỉ"
                  value={p.address || "Chưa cập nhật"}
                />
              </Card>

              <Card>
                <Text style={styles.sectionTitle}>Thông tin bệnh</Text>
                <InfoRow
                  label="Loại tiểu đường"
                  value={DIABETES[p.diabetesType] ?? "—"}
                />
                <InfoRow
                  label="Thời gian mắc"
                  value={
                    p.diabetesDurationYears != null
                      ? `${p.diabetesDurationYears} năm`
                      : "—"
                  }
                />
                <InfoRow
                  label="HbA1c nền"
                  value={
                    p.baselineHbA1c != null ? `${p.baselineHbA1c}%` : "—"
                  }
                />
                <View style={styles.gradeRow}>
                  <Text style={styles.infoLabel}>Mức võng mạc gần nhất</Text>
                  <GradeBadge grade={p.latestDrGrade} />
                </View>
              </Card>

              <Button
                title="Cập nhật thông tin cá nhân"
                kind="outline"
                icon="create-outline"
                onPress={() => setEditing(true)}
                style={{ marginBottom: spacing.sm }}
              />
              <Button
                title="Đổi số điện thoại"
                kind="outline"
                icon="phone-portrait-outline"
                onPress={() => setChangingPhone(true)}
                style={{ marginBottom: spacing.sm }}
              />
            </>
          )}
        </LoadState>

        <Button
          title="Đổi mật khẩu"
          kind="outline"
          icon="lock-closed-outline"
          onPress={() => navigation.navigate("ChangePassword")}
          style={{ marginBottom: spacing.sm }}
        />
        <Button
          title="Đăng xuất"
          kind="danger"
          icon="log-out-outline"
          onPress={confirmLogout}
        />

        <Text style={styles.version}>DiaCompanion · Phiên bản 1.0</Text>
      </Screen>

      {editing && p && (
        <PersonalInfoForm
          profile={p}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            profile.reload();
          }}
          onConflict={() => {
            setEditing(false);
            profile.reload();
          }}
        />
      )}

      {changingPhone && p && (
        <PhoneChangeForm
          profile={p}
          onClose={() => setChangingPhone(false)}
          onSaved={() => {
            setChangingPhone(false);
            profile.reload();
          }}
          onConflict={() => {
            setChangingPhone(false);
            profile.reload();
          }}
        />
      )}
    </>
  );
}

function PersonalInfoForm({ profile, onClose, onSaved, onConflict }) {
  const data = useData();
  const toast = useToast();
  const [fullName, setFullName] = useState(profile.fullName || "");
  const [gender, setGender] = useState(Number(profile.gender ?? 0));
  const [dateOfBirth, setDateOfBirth] = useState(
    String(profile.dateOfBirth || "").slice(0, 10),
  );
  const [address, setAddress] = useState(profile.address || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!fullName.trim()) {
      toast.push("Vui lòng nhập họ tên.", "error");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      toast.push("Ngày sinh phải có định dạng YYYY-MM-DD.", "error");
      return;
    }

    setBusy(true);
    try {
      await data.profile.updateMine({
        fullName: fullName.trim(),
        gender,
        dateOfBirth,
        address: address.trim() || null,
        rowVersion: profile.rowVersion,
      });
      toast.push("Đã cập nhật thông tin cá nhân.", "success");
      onSaved();
    } catch (e) {
      if (isConflict(e)) {
        toast.push(
          "Hồ sơ vừa thay đổi ở nơi khác. Đã tải lại bản mới, vui lòng kiểm tra và nhập lại.",
          "error",
        );
        onConflict();
        return;
      }
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomModal title="Cập nhật thông tin cá nhân" onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Field label="Họ tên" required>
          <Input
            value={fullName}
            onChangeText={setFullName}
            placeholder="Họ và tên"
          />
        </Field>

        <Field label="Giới tính" required>
          <View style={styles.genderRow}>
            {[0, 1, 2].map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setGender(value)}
                style={[
                  styles.genderOption,
                  gender === value && styles.genderOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === value && styles.genderTextActive,
                  ]}
                >
                  {GENDERS[value]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field
          label="Ngày sinh"
          required
          hint="Nhập theo định dạng YYYY-MM-DD"
        >
          <Input
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="2000-01-31"
            keyboardType="numbers-and-punctuation"
          />
        </Field>

        <Field label="Địa chỉ">
          <Input
            value={address}
            onChangeText={setAddress}
            placeholder="Số nhà, đường, phường/xã…"
            multiline
          />
        </Field>

        <Text style={styles.note}>
          Số điện thoại được đổi ở bước riêng và phải xác minh bằng OTP. Thông
          tin bệnh chỉ do nhân viên y tế cập nhật.
        </Text>

        <Button title="Lưu thông tin" onPress={save} busy={busy} />
      </ScrollView>
    </BottomModal>
  );
}

function PhoneChangeForm({ profile, onClose, onSaved, onConflict }) {
  const data = useData();
  const toast = useToast();
  const [newPhone, setNewPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestOtp = async () => {
    const phone = newPhone.trim();
    if (!phone) {
      toast.push("Vui lòng nhập số điện thoại mới.", "error");
      return;
    }
    if (phone === profile.phone) {
      toast.push("Số mới phải khác số đang sử dụng.", "error");
      return;
    }

    setBusy(true);
    try {
      const res = await data.profile.requestPhoneChangeOtp(phone);
      setOtpSent(true);
      if (res?.devCode) {
        setCode(String(res.devCode));
        toast.push(`Mã thử nghiệm: ${res.devCode}`, "success");
      } else {
        toast.push("Đã gửi mã xác minh tới số điện thoại mới.", "success");
      }
    } catch (e) {
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      toast.push("Mã xác minh phải gồm 6 chữ số.", "error");
      return;
    }

    setBusy(true);
    try {
      await data.profile.confirmPhoneChange(
        newPhone.trim(),
        code.trim(),
        profile.rowVersion,
      );
      toast.push(
        "Đã đổi số điện thoại. Lần đăng nhập sau hãy dùng số mới.",
        "success",
      );
      onSaved();
    } catch (e) {
      if (isConflict(e)) {
        toast.push(
          "Hồ sơ vừa thay đổi ở nơi khác. OTP chưa được dùng; vui lòng tải lại rồi thực hiện lại.",
          "error",
        );
        onConflict();
        return;
      }
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomModal title="Đổi số điện thoại" onClose={onClose}>
      <Field label="Số điện thoại hiện tại">
        <Input value={profile.phone} editable={false} />
      </Field>

      <Field label="Số điện thoại mới" required>
        <Input
          value={newPhone}
          onChangeText={(value) => {
            setNewPhone(value);
            if (otpSent) {
              setOtpSent(false);
              setCode("");
            }
          }}
          placeholder="09xxxxxxxx"
          keyboardType="phone-pad"
        />
      </Field>

      {otpSent && (
        <Field
          label="Mã xác minh"
          required
          hint="Mã gồm 6 chữ số và có hiệu lực trong thời gian ngắn."
        >
          <Input
            value={code}
            onChangeText={setCode}
            placeholder="Nhập mã OTP"
            keyboardType="number-pad"
            maxLength={6}
          />
        </Field>
      )}

      {!otpSent ? (
        <Button title="Gửi mã xác minh" onPress={requestOtp} busy={busy} />
      ) : (
        <>
          <Button
            title="Xác nhận đổi số điện thoại"
            onPress={confirm}
            busy={busy}
          />
          <TouchableOpacity
            style={styles.resend}
            onPress={requestOtp}
            disabled={busy}
          >
            <Text style={styles.resendText}>Gửi lại mã</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.note}>
        Hệ thống kiểm tra số mới chưa thuộc hồ sơ hoặc tài khoản khác trước khi
        gửi OTP và kiểm tra lại lần nữa trước khi cập nhật.
      </Text>
    </BottomModal>
  );
}

function BottomModal({ title, onClose, children }) {
  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: spacing.xl },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontWeight: "700", color: colors.white },
  name: { ...font.h2, color: colors.ink },
  role: { ...font.body, color: colors.muted, marginTop: 2 },
  sectionTitle: { ...font.h3, color: colors.ink, marginBottom: spacing.sm },
  gradeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoLabel: { ...font.body, color: colors.muted },
  version: {
    ...font.small,
    color: colors.faint,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalCard: {
    maxHeight: "92%",
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { ...font.h2, color: colors.ink },
  note: {
    ...font.small,
    color: colors.muted,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    lineHeight: 19,
  },
  genderRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  genderOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  genderOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft || "#E8F2FF",
  },
  genderText: { ...font.body, color: colors.muted, fontWeight: "600" },
  genderTextActive: { color: colors.primary },
  resend: {
    alignSelf: "center",
    padding: spacing.md,
  },
  resendText: { ...font.body, color: colors.primary, fontWeight: "600" },
});
