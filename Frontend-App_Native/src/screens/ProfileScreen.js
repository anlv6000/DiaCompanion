import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Button, Field, Input, InfoRow, GradeBadge, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { isConflict } from "../api/client";

const GENDERS = { 0: "Nam", 1: "Nữ", 2: "Khác" };
const DIABETES = { 0: "Tiền đái tháo đường", 1: "Type 1", 2: "Type 2", 3: "Thai kỳ" };

/** Cá nhân — xem hồ sơ, sửa địa chỉ, đổi mật khẩu, đăng xuất. */
export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const data = useData();
  const toast = useToast();
  const [editAddr, setEditAddr] = useState(false);
  const profile = useAsync(() => data.profile.me(), []);

  const confirmLogout = () => {
    if (Platform.OS === "web") {
      logout();
      return;
    }

    // Code cũ dùng alert trên native:
    // Alert.alert("Đăng xuất", "Bạn chắc chắn muốn đăng xuất?", [
    //   { text: "Hủy", style: "cancel" },
    //   { text: "Đăng xuất", style: "destructive", onPress: logout },
    // ]);

    logout();
  };

  const p = profile.data;

  return (
    <>
      <Screen>
        <Card style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.fullName || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.fullName}</Text>
          <Text style={styles.role}>Bệnh nhân</Text>
        </Card>

        <LoadState loading={profile.loading} error={profile.error} onRetry={profile.reload}>
          {p && (
            <>
              <Card>
                <Text style={styles.sectionTitle}>Thông tin cá nhân</Text>
                <InfoRow label="Mã bệnh nhân" value={p.code} />
                <InfoRow label="Ngày sinh" value={fmtDate(p.dateOfBirth)} />
                <InfoRow label="Giới tính" value={GENDERS[p.gender] ?? "—"} />
                <InfoRow label="Số điện thoại" value={p.phone} />
                <InfoRow label="Địa chỉ" value={p.address || "Chưa cập nhật"} />
              </Card>

              <Card>
                <Text style={styles.sectionTitle}>Thông tin bệnh</Text>
                <InfoRow label="Loại tiểu đường" value={DIABETES[p.diabetesType] ?? "—"} />
                <InfoRow label="Thời gian mắc" value={p.diabetesDurationYears != null ? `${p.diabetesDurationYears} năm` : "—"} />
                <InfoRow label="HbA1c nền" value={p.baselineHbA1c != null ? `${p.baselineHbA1c}%` : "—"} />
                <View style={styles.gradeRow}>
                  <Text style={styles.infoLabel}>Mức võng mạc gần nhất</Text>
                  <GradeBadge grade={p.latestDrGrade} />
                </View>
              </Card>

              <Button title="Cập nhật địa chỉ" kind="outline" icon="location-outline" onPress={() => setEditAddr(true)} style={{ marginBottom: spacing.sm }} />
            </>
          )}
        </LoadState>

        <Button title="Đổi mật khẩu" kind="outline" icon="lock-closed-outline" onPress={() => navigation.navigate("ChangePassword")} style={{ marginBottom: spacing.sm }} />
        <Button title="Đăng xuất" kind="danger" icon="log-out-outline" onPress={confirmLogout} />

        <Text style={styles.version}>DiaCompanion · Phiên bản 1.0</Text>
      </Screen>

      {editAddr && p && (
        <AddressForm profile={p} onClose={() => setEditAddr(false)} onSaved={() => { setEditAddr(false); profile.reload(); }} onConflict={profile.reload} />
      )}
    </>
  );
}

function AddressForm({ profile, onClose, onSaved, onConflict }) {
  const data = useData();
  const toast = useToast();
  const [address, setAddress] = useState(profile.address || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await data.profile.updateMine({
        fullName: profile.fullName,
        gender: profile.gender,
        dateOfBirth: profile.dateOfBirth,
        phone: profile.phone,
        address: address.trim() || null,
        diabetesType: profile.diabetesType,
        diabetesDurationYears: profile.diabetesDurationYears,
        baselineHbA1c: profile.baselineHbA1c,
        rowVersion: profile.rowVersion,
      });
      toast.push("Đã cập nhật địa chỉ.", "success");
      onSaved();
    } catch (e) {
      if (isConflict(e)) {
        toast.push("Hồ sơ vừa được thay đổi ở nơi khác. Đã tải lại bản mới, vui lòng mở form và nhập lại.", "error");
        onConflict();
        onClose();
        return;
      }
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Cập nhật địa chỉ</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></TouchableOpacity>
          </View>
          <Text style={styles.note}>Bạn chỉ có thể sửa địa chỉ. Các thông tin khác do phòng khám quản lý.</Text>
          <Field label="Địa chỉ">
            <Input value={address} onChangeText={setAddress} placeholder="Số nhà, đường, phường/xã…" multiline />
          </Field>
          <Button title="Lưu" onPress={save} busy={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  avatarText: { fontSize: 32, fontWeight: "700", color: colors.white },
  name: { ...font.h2, color: colors.ink },
  role: { ...font.body, color: colors.muted, marginTop: 2 },

  sectionTitle: { ...font.h3, color: colors.ink, marginBottom: spacing.sm },
  gradeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  infoLabel: { ...font.body, color: colors.muted },

  version: { ...font.small, color: colors.faint, textAlign: "center", marginTop: spacing.xl },

  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalCard: { backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { ...font.h2, color: colors.ink },
  note: { ...font.small, color: colors.muted, marginBottom: spacing.md, lineHeight: 19 },
});
