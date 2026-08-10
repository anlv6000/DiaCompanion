import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useAsync } from "../lib/hooks";
import { Screen, Card, Badge, LoadState } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { blogCategories } from "../lib/enums";

/** Blog sức khỏe — danh sách bài đã xuất bản, chạm để đọc chi tiết. */
export default function BlogScreen() {
  const data = useData();
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const list = useAsync(() => data.blog.published({ page: 1, pageSize: 30 }), []);

  const onRefresh = async () => { setRefreshing(true); await list.reload(); setRefreshing(false); };

  if (selected) return <BlogDetail id={selected} onBack={() => setSelected(null)} />;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <LoadState
        loading={list.loading} error={list.error}
        empty={!list.data?.items?.length} emptyText="Chưa có bài viết nào."
        onRetry={list.reload}
      >
        {list.data?.items?.map((b) => (
          <TouchableOpacity key={b.id} activeOpacity={0.85} onPress={() => setSelected(b.id)}>
            <Card>
              <Badge text={blogCategories[b.category] || "Bài viết"} kind="primary" />
              <Text style={styles.title}>{b.title}</Text>
              {b.summary ? <Text style={styles.summary} numberOfLines={2}>{b.summary}</Text> : null}
              <View style={styles.meta}>
                <Text style={styles.metaText}>{b.authorName}</Text>
                <Text style={styles.metaText}>{fmtDate(b.publishedAt || b.createdAt)}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        ))}
      </LoadState>
    </Screen>
  );
}

function BlogDetail({ id, onBack }) {
  const data = useData();
  const post = useAsync(() => data.blog.get(id), [id]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ padding: spacing.lg }}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
        <Text style={styles.backText}>Danh sách bài viết</Text>
      </TouchableOpacity>
      <LoadState loading={post.loading} error={post.error} onRetry={post.reload}>
        {post.data && (
          <>
            <Badge text={blogCategories[post.data.category] || "Bài viết"} kind="primary" />
            <Text style={styles.detailTitle}>{post.data.title}</Text>
            <Text style={styles.detailMeta}>{post.data.authorName} · {fmtDate(post.data.publishedAt || post.data.createdAt)}</Text>
            <Text style={styles.detailBody}>{post.data.body}</Text>
          </>
        )}
      </LoadState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h3, color: colors.ink, marginTop: spacing.sm },
  summary: { ...font.body, color: colors.muted, marginTop: 4, lineHeight: 21 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  metaText: { ...font.small, color: colors.faint },

  back: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  backText: { ...font.body, color: colors.primary, fontWeight: "600" },
  detailTitle: { ...font.h1, color: colors.ink, marginTop: spacing.sm, lineHeight: 30 },
  detailMeta: { ...font.small, color: colors.faint, marginTop: spacing.sm },
  detailBody: { ...font.body, color: colors.ink, lineHeight: 24, marginTop: spacing.lg },
});
