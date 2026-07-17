import type { ReactNode } from "react";
import { AlertTriangle, CircleCheck, UserRoundCheck } from "lucide-react";
import type { DrGrade } from "@/types/models";
import { GRADE_META, gradeColor } from "@/lib/grades";
import { Badge, Button, Skeleton, cx } from "@/components/ui/primitives";
import { pct } from "@/lib/format";

// DR grade chip — the ONLY use of the severity ramp.
export function GradeChip({ grade }: { grade: DrGrade }) {
  const meta = GRADE_META[grade];
  return (
    <span
      className={cx(
        "inline-flex items-center h-5 px-1.5 rounded-xs text-micro font-semibold font-mono",
        meta.onDark ? "text-white" : "text-ink",
      )}
      style={{ backgroundColor: gradeColor(grade) }}
      title={`DR: ${meta.label}`}
    >
      {grade}
    </span>
  );
}

// Deferral — icon + text (colorblind redundancy), never hue-only.
export function DeferBadge() {
  return (
    <Badge tone="defer">
      <UserRoundCheck size={12} strokeWidth={2} />
      Chuyển bác sĩ
    </Badge>
  );
}

export function ReferableTag({ referable }: { referable: boolean }) {
  return referable ? (
    <Badge tone="alert">
      <AlertTriangle size={12} strokeWidth={2} />
      Cần chuyển tuyến
    </Badge>
  ) : (
    <Badge tone="ok">
      <CircleCheck size={12} strokeWidth={2} />
      Không cần
    </Badge>
  );
}

// A thin inline bar for confidence / disagreement values (0..1).
export function MeterBar({
  value,
  tone = "primary",
  label,
}: {
  value: number;
  tone?: "primary" | "defer" | "alert";
  label?: string;
}) {
  const color =
    tone === "defer" ? "var(--defer)" : tone === "alert" ? "var(--risk-alert)" : "var(--primary)";
  return (
    <div className="flex items-center gap-2 min-w-[7rem]">
      <div className="h-1.5 flex-1 rounded-xs bg-hairline overflow-hidden">
        <div
          className="h-full rounded-xs"
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-micro font-mono text-ink-muted tabular-nums">{label ?? pct(value)}</span>
    </div>
  );
}

// Unified loading / error / empty wrapper. Pages pass state from DataContext.
export function DataState({
  loading,
  error,
  empty,
  emptyLabel = "Không có dữ liệu.",
  onRetry,
  children,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2 text-risk-alert text-dense">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </div>
    );
  }
  if (empty) {
    return <div className="p-8 text-center text-ink-faint text-dense">{emptyLabel}</div>;
  }
  return <>{children}</>;
}
