import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Button, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { notificationTypes } from "../lib/enums";

/** Thông báo — danh sách, chạm để đánh dấu đã đọc, nút đọc tất cả. */
export default function NotificationsScreen() {
  const data = useData();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const list = useAsync(() => data.notification.list({ pageSize: 50 }), []);

  const markRead = async (n) => {
    if (n.isRead) return;
    try { await data.notification.markRead(n.id); list.reload(); data.refreshUnread(); }
    catch (e) { toast.push(e.message, "error"); }
  };
  const markAll = async () => {
    try { await data.notification.markAllRead(); toast.push("Đã đánh dấu tất cả đã đọc.", "success"); list.reload(); data.refreshUnread(); }
    catch (e) { toast.push(e.message, "error"); }
  };
  const onRefresh = async () => { setRefreshing(true); await list.reload(); await data.refreshUnread(); setRefreshing(false); };

  const hasUnread = list.data?.items?.some((n) => !n.isRead);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {hasUnread && <Button title="Đánh dấu tất cả đã đọc" kind="outline" onPress={markAll} style={{ marginBottom: spacing.md }} />}
      <LoadState
        loading={list.loading} error={list.error}
        empty={!list.data?.items?.length} emptyText="Chưa có thông báo nào."
        onRetry={list.reload}
      >
        {list.data?.items?.map((n) => {
          const meta = notificationTypes[n.type] || { icon: "notifications-outline" };
          return (
            <TouchableOpacity key={n.id} activeOpacity={0.8} onPress={() => markRead(n)}>
              <Card style={[styles.card, !n.isRead && styles.unread]}>
                <View style={styles.row}>
                  <View style={[styles.iconWrap, !n.isRead && styles.iconWrapUnread]}>
                    <Ionicons name={meta.icon} size={20} color={!n.isRead ? colors.primary : colors.faint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, !n.isRead && { fontWeight: "700" }]}>{n.title}</Text>
                      {!n.isRead && <View style={styles.dot} />}
                    </View>
                    <Text style={styles.message}>{n.message}</Text>
                    <Text style={styles.date}>{fmtDate(n.createdAt, true)}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </LoadState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  unread: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  row: { flexDirection: "row", gap: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  iconWrapUnread: { backgroundColor: colors.surface },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { ...font.body, color: colors.ink, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  message: { ...font.small, color: colors.muted, marginTop: 2, lineHeight: 19 },
  date: { ...font.tiny, color: colors.faint, marginTop: 4 },
});
