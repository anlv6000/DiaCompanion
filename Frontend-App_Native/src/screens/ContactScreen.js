import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen, Card, Button, InfoRow } from "../components/ui";
import { HOSPITAL_CONTACT } from "../config";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";

export default function ContactScreen() {
  const contact = HOSPITAL_CONTACT ?? {};

  const phone = contact.phone?.trim() ?? "";
  const email = contact.email?.trim() ?? "";
  const address = contact.address?.trim() ?? "";
  const mapsUrl = contact.mapsUrl?.trim() ?? "";
  const hospitalName = contact.name?.trim() || "Bệnh viện";

  const openUrl = async (url) => {
    if (!url) return;

    try {
      const supported = await Linking.canOpenURL(url);

      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.warn("Không thể mở liên kết:", error);
    }
  };

  const handleCall = () => {
    const normalizedPhone = phone.replace(/[^\d+]/g, "");

    return openUrl(
      normalizedPhone ? `tel:${normalizedPhone}` : "",
    );
  };

  const handleEmail = () => {
    return openUrl(
      email ? `mailto:${email}` : "",
    );
  };

  const handleOpenMap = () => {
    if (mapsUrl) {
      return openUrl(mapsUrl);
    }

    if (address) {
      const query = encodeURIComponent(address);

      return openUrl(
        `https://www.google.com/maps/search/?api=1&query=${query}`,
      );
    }
  };

  const hasContactInfo = Boolean(
    phone || email || address || mapsUrl,
  );

  return (
    <Screen>
      <Card>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="business-outline"
              size={24}
              color={colors.primary}
            />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Liên hệ bệnh viện
            </Text>

            <Text style={styles.subtitle}>
              {hospitalName}
            </Text>
          </View>
        </View>

        <InfoRow
          label="Số điện thoại"
          value={phone || "Chưa cập nhật"}
        />

        <InfoRow
          label="Email"
          value={email || "Chưa cập nhật"}
        />

        <InfoRow
          label="Địa chỉ"
          value={address || "Chưa cập nhật"}
        />
      </Card>

      {!hasContactInfo && (
        <Text style={styles.note}>
          Thông tin liên hệ của bệnh viện hiện chưa được cấu hình.
        </Text>
      )}

      <Button
        title="Gọi bệnh viện"
        icon="call-outline"
        onPress={handleCall}
        disabled={!phone}
        style={styles.button}
      />

      <Button
        title="Gửi email"
        kind="outline"
        icon="mail-outline"
        onPress={handleEmail}
        disabled={!email}
        style={styles.button}
      />

      <Button
        title="Xem trên bản đồ"
        kind="outline"
        icon="location-outline"
        onPress={handleOpenMap}
        disabled={!address && !mapsUrl}
      />

      <Text style={styles.emergency}>
        Nếu có tình trạng cấp cứu, hãy liên hệ cơ sở y tế gần nhất
        hoặc gọi số cấp cứu thay vì chờ phản hồi qua ứng dụng.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },

  headerText: {
    flex: 1,
  },

  title: {
    ...font.h2,
    color: colors.ink,
  },

  subtitle: {
    ...font.body,
    color: colors.muted,
    marginTop: 2,
  },

  note: {
    ...font.small,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: spacing.md,
  },

  button: {
    marginBottom: spacing.sm,
  },

  emergency: {
    ...font.small,
    color: colors.warn,
    backgroundColor: colors.warnSoft,
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
    lineHeight: 19,
  },
});