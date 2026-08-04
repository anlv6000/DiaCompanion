import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { Screen, Card, Button, Field, Input } from "../components/ui";
import { colors } from "../theme/colors";
import { font, spacing, radius } from "../theme/typography";
import { fmtDate } from "../lib/format";
import { isConflict } from "../api/client";

/**
 * Gửi phản hồi theo lượt khám đã chọn từ lịch sử khám.
 */
export default function VisitFeedbackScreen({ route, navigation }) {
  const data = useData();
  const toast = useToast();
  const visit = route?.params?.visit;
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState([]);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const TAG_OPTIONS = [
    "Bác sĩ tận tình",
    "Chờ đợi lâu",
    "Giải thích rõ ràng",
    "Cơ sở sạch sẽ",
    "Thủ tục nhanh gọn",
  ];

  const toggleTag = (t) =>
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const submit = async () => {
    if (!visit?.id || visit.status !== 1) {
      toast.push("Chỉ có thể phản hồi cho lượt khám đã hoàn tất.", "error");
      return;
    }
    setBusy(true);
    try {
      // Backend CreateFeedbackRequest: { visitId, rating (1..5), tags?, comment? }
      await data.feedback.create({
        visitId: visit?.id ?? null,
        rating,
        tags: tags.length ? tags.join(", ") : null,
        comment: content.trim() || null,
      });
      toast.push("Đã gửi phản hồi cho lượt khám.", "success");
      navigation.goBack();
    } catch (e) {
      if (isConflict(e)) {
        toast.push("Lượt khám này đã có phản hồi hoặc dữ liệu vừa thay đổi.", "error");
        return;
      }
      toast.push(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Phản hồi lượt khám</Text>
        {visit ? (
          <Text style={styles.meta}>{fmtDate(visit.visitDate || visit.closedAt || visit.createdAt || visit.date)}</Text>
        ) : null}
      </Card>

      <Card>
        <Field label="Đánh giá" required>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setRating(value)}
                style={[styles.star, rating >= value && styles.starActive]}
              >
                <Ionicons name="star" size={18} color={rating >= value ? colors.white : colors.warn} />
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Điểm nổi bật (tuỳ chọn)">
          <View style={styles.tagRow}>
            {TAG_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => toggleTag(t)}
                style={[styles.tag, tags.includes(t) && styles.tagActive]}
              >
                <Text
                  style={[
                    styles.tagText,
                    tags.includes(t) && styles.tagTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Nội dung phản hồi (tuỳ chọn)">
          <Input
            value={content}
            onChangeText={setContent}
            placeholder="Bạn hài lòng như thế nào về lượt khám này?"
            multiline
            style={styles.inputArea}
          />
        </Field>

        <Button title="Gửi phản hồi" onPress={submit} busy={busy} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...font.h2, color: colors.ink },
  meta: { ...font.small, color: colors.muted, marginTop: 4 },
  ratingRow: { flexDirection: "row", gap: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline,
  },
  tagActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagText: { ...font.small, color: colors.muted },
  tagTextActive: { color: colors.white, fontWeight: "600" },
  star: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.hairline, alignItems: "center", justifyContent: "center",
  },
  starActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  inputArea: { minHeight: 120, textAlignVertical: "top" },
});
