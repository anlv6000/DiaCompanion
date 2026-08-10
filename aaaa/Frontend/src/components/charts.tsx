import { grades } from "@/lib/enums";
export function LineChart({
  series,
}: {
  series: {
    name: string;
    kind?: string;
    points: { x: string; y: number | null | undefined }[];
  }[];
}) {
  const all = series.flatMap((s) =>
    s.points.filter((p) => p.y != null).map((p) => Number(p.y)),
  );
  if (!all.length)
    return (
      <div className="empty">
        <b>Chưa có số liệu</b>Biểu đồ sẽ xuất hiện khi backend có dữ liệu.
      </div>
    );
  const min = Math.min(...all),
    max = Math.max(...all),
    span = max - min || 1;
  const count = Math.max(...series.map((s) => s.points.length));
  const path = (pts: any[]) =>
    pts
      .map((p: any, i: number) => {
        if (p.y == null) return null;
        const x = 40 + (i / Math.max(1, count - 1)) * 720;
        const y = 225 - ((Number(p.y) - min) / span) * 185;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");
  return (
    <>
      <svg className="chart" viewBox="0 0 780 260" preserveAspectRatio="none">
        <line className="axis" x1="40" y1="225" x2="760" y2="225" />
        <line className="axis" x1="40" y1="35" x2="40" y2="225" />
        <text x="4" y="40">
          {max.toFixed(2)}
        </text>
        <text x="4" y="225">
          {min.toFixed(2)}
        </text>
        {series.map((s, i) => (
          <path
            key={s.name}
            d={path(s.points)}
            className={
              s.kind === "defer"
                ? "line-defer"
                : s.kind === "alert"
                  ? "line-alert"
                  : "line-primary"
            }
          />
        ))}
      </svg>
      <div className="legend">
        {series.map((s) => (
          <span className={s.kind || ""} key={s.name}>
            {s.name}
          </span>
        ))}
      </div>
    </>
  );
}
export function GradeBars({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const vals = [0, 1, 2, 3, 4].map(
    (i) => distribution[String(i)] ?? distribution[grades[i]] ?? 0,
  );
  const max = Math.max(1, ...vals);
  return (
    <div className="bars">
      {vals.map((v, i) => (
        <div className="bar" key={i}>
          <span>{grades[i]}</span>
          <span style={{ background: "#eef0f3", height: 10 }}>
            <i
              style={{
                width: `${(v / max) * 100}%`,
                background: `var(--g${i})`,
              }}
            />
          </span>
          <b className="mono">{v}</b>
        </div>
      ))}
    </div>
  );
}
