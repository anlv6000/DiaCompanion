import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";

/**
 * Biểu đồ đường tối giản cho một chuỗi số theo thời gian.
 * points: [{ x: label, y: number }]. Tự co giãn theo min/max của y.
 * Không phụ thuộc thư viện chart nặng — đủ để bệnh nhân thấy xu hướng.
 */
export function MiniChart({ points, height = 160, color = colors.primary, unit = "" }) {
  const valid = (points || []).filter((p) => p.y !== null && p.y !== undefined && !isNaN(Number(p.y)));
  if (valid.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Cần ít nhất 2 điểm dữ liệu để vẽ biểu đồ.</Text>
      </View>
    );
  }

  const W = 300, H = height, pad = 24;
  const ys = valid.map((p) => Number(p.y));
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = max - min || 1;

  const stepX = (W - pad * 2) / (valid.length - 1);
  const coords = valid.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (Number(p.y) - min) / range) * (H - pad * 2);
    return { x, y, raw: p };
  });

  const polyPoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* đường lưới trên/dưới */}
        <Line x1={pad} y1={pad} x2={W - pad} y2={pad} stroke={colors.hairline} strokeWidth="1" />
        <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={colors.hairline} strokeWidth="1" />
        <Polyline points={polyPoints} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r="3.5" fill={colors.surface} stroke={color} strokeWidth="2" />
        ))}
      </Svg>
      <View style={styles.axis}>
        <Text style={styles.axisText}>Thấp: {min}{unit}</Text>
        <Text style={styles.axisText}>Cao: {max}{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, borderRadius: 12 },
  emptyText: { ...font.small, color: colors.faint },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  axisText: { ...font.tiny, color: colors.faint },
});
