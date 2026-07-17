import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import type { ProgressionData } from "@/types/models";
import { GRADE_META } from "@/lib/grades";

const AXIS = { fontSize: 11, fill: "var(--ink-faint)" };

// Risk–coverage curve: as we cover fewer cases (defer more), residual risk drops.
// Restrained: one series + a threshold reference line.
export function RiskCoverageChart({
  data,
  threshold,
}: {
  data: { coverage: number; risk: number }[];
  threshold?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--hairline)" vertical={false} />
        <XAxis
          dataKey="coverage"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--hairline)" }}
          label={{ value: "Coverage", position: "insideBottom", offset: -2, ...AXIS }}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--hairline)" }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {threshold !== undefined && (
          <ReferenceLine x={threshold} stroke="var(--risk-watch)" strokeDasharray="4 3" />
        )}
        <Line
          type="monotone"
          dataKey="risk"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={false}
          name="Residual risk"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Longitudinal: DR grade (stepped) + fractal dimension + HbA1c on one time axis.
export function ProgressionChart({ data }: { data: ProgressionData }) {
  const merged = data.fractalAndGrade.map((p) => ({
    t: new Date(p.createdAt).toLocaleDateString("vi-VN"),
    grade: GRADE_META[p.drGrade].idx,
    fractal: p.fractalDimension ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={merged} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--hairline)" vertical={false} />
        <XAxis dataKey="t" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--hairline)" }} />
        <YAxis
          yAxisId="grade"
          domain={[0, 4]}
          ticks={[0, 1, 2, 3, 4]}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--hairline)" }}
        />
        <YAxis
          yAxisId="fractal"
          orientation="right"
          domain={[1.3, 1.8]}
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: "var(--hairline)" }}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          yAxisId="grade"
          type="stepAfter"
          dataKey="grade"
          stroke="var(--grade-3)"
          strokeWidth={2}
          dot={{ r: 2 }}
          name="Mức DR (0–4)"
        />
        <Line
          yAxisId="fractal"
          type="monotone"
          dataKey="fractal"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={false}
          connectNulls
          name="Fractal dimension"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
