import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Circle, Line, Text as SvgText } from "react-native-svg";
import { colors } from "../theme/colors";
import { font, spacing } from "../theme/typography";

/**
 * Biểu đồ đường gọn cho mobile.
 *
 * Mặc định vẫn tự co theo dữ liệu như bản cũ, nhưng có thể truyền:
 * - yMin / yMax: cố định miền dọc (ví dụ DR luôn 0..4)
 * - yTicks: [{ value, label }] để hiện mốc R0..R4
 * - referenceLines: [{ value, label, color }] để vẽ ngưỡng bất thường
 * - showPointLabels: hiện nhãn ngay trên điểm
 * - xLabelFormatter: hiện ngày đầu / ngày cuối dưới biểu đồ
 */
export function MiniChart({
  points,
  height = 160,
  color = colors.primary,
  unit = "",
  yMin,
  yMax,
  yTicks = [],
  referenceLines = [],
  showPointLabels = false,
  pointLabelFormatter,
  xLabelFormatter,
  showRange = true,
}) {
  const valid = (points || []).filter(
    (p) => p.y !== null && p.y !== undefined && !isNaN(Number(p.y)),
  );

  if (valid.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Cần ít nhất 2 điểm dữ liệu để vẽ biểu đồ.</Text>
      </View>
    );
  }

  const W = 300;
  const H = height;
  const padTop = 24;
  const padBottom = 24;
  const padLeft = yTicks.length ? 38 : 24;
  const padRight = 20;

  const ys = valid.map((p) => Number(p.y));
  const refs = (referenceLines || [])
    .map((r) => Number(r.value))
    .filter((v) => !Number.isNaN(v));

  let min = yMin !== undefined && yMin !== null
    ? Number(yMin)
    : Math.min(...ys, ...(refs.length ? refs : ys));
  let max = yMax !== undefined && yMax !== null
    ? Number(yMax)
    : Math.max(...ys, ...(refs.length ? refs : ys));

  if (max === min) {
    max += 1;
    min -= 1;
  }

  const range = max - min;
  const chartHeight = H - padTop - padBottom;
  const chartWidth = W - padLeft - padRight;
  const yOf = (value) =>
    padTop + (1 - (Number(value) - min) / range) * chartHeight;

  const stepX = chartWidth / (valid.length - 1);
  const coords = valid.map((p, i) => ({
    x: padLeft + i * stepX,
    y: yOf(p.y),
    raw: p,
  }));
  const polyPoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  const tickRows = yTicks.length
    ? yTicks.filter((t) => Number(t.value) >= min && Number(t.value) <= max)
    : [
        { value: min, label: null },
        { value: max, label: null },
      ];

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {tickRows.map((t, i) => {
          const y = yOf(t.value);
          return (
            <React.Fragment key={`tick-${i}-${t.value}`}>
              <Line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke={colors.hairline}
                strokeWidth="1"
              />
              {t.label ? (
                <SvgText
                  x={padLeft - 7}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={colors.faint}
                >
                  {t.label}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}

        {(referenceLines || []).map((r, i) => {
          const value = Number(r.value);
          if (Number.isNaN(value) || value < min || value > max) return null;
          const y = yOf(value);
          const lineColor = r.color || colors.alert;
          return (
            <React.Fragment key={`ref-${i}-${value}`}>
              <Line
                x1={padLeft}
                y1={y}
                x2={W - padRight}
                y2={y}
                stroke={lineColor}
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              {r.label ? (
                <SvgText
                  x={W - padRight}
                  y={Math.max(12, y - 5)}
                  textAnchor="end"
                  fontSize="9"
                  fontWeight="600"
                  fill={lineColor}
                >
                  {r.label}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}

        <Polyline
          points={polyPoints}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coords.map((c, i) => (
          <React.Fragment key={`point-${i}`}>
            <Circle
              cx={c.x}
              cy={c.y}
              r="3.5"
              fill={colors.surface}
              stroke={color}
              strokeWidth="2"
            />
            {showPointLabels ? (
              <SvgText
                x={c.x}
                y={Math.max(12, c.y - 8)}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={color}
              >
                {pointLabelFormatter
                  ? pointLabelFormatter(c.raw)
                  : `${c.raw.y}${unit}`}
              </SvgText>
            ) : null}
          </React.Fragment>
        ))}
      </Svg>

      {xLabelFormatter ? (
        <View style={styles.xAxis}>
          <Text style={styles.axisText}>{xLabelFormatter(valid[0].x)}</Text>
          <Text style={styles.axisText}>{xLabelFormatter(valid[valid.length - 1].x)}</Text>
        </View>
      ) : null}

      {showRange && !yTicks.length ? (
        <View style={styles.axis}>
          <Text style={styles.axisText}>Thấp: {formatNum(min)}{unit}</Text>
          <Text style={styles.axisText}>Cao: {formatNum(max)}{unit}</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatNum(value) {
  return Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1);
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
    borderRadius: 12,
  },
  emptyText: { ...font.small, color: colors.faint, textAlign: "center", paddingHorizontal: spacing.md },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  xAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: -2 },
  axisText: { ...font.tiny, color: colors.faint },
});
