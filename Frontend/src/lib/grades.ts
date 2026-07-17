import type { DrGrade } from "@/types/models";

export interface GradeMeta {
  idx: number;
  label: string;      // Vietnamese clinical label
  varName: string;    // CSS var for the severity ramp
  onDark: boolean;    // true => use dark text on this chip background
}

export const GRADE_META: Record<DrGrade, GradeMeta> = {
  Normal: { idx: 0, label: "Bình thường", varName: "--grade-0", onDark: true },
  Mild: { idx: 1, label: "Nhẹ", varName: "--grade-1", onDark: false },
  Moderate: { idx: 2, label: "Trung bình", varName: "--grade-2", onDark: true },
  Severe: { idx: 3, label: "Nặng", varName: "--grade-3", onDark: true },
  PDR: { idx: 4, label: "PDR (tăng sinh)", varName: "--grade-4", onDark: true },
};

export const GRADE_ORDER: DrGrade[] = ["Normal", "Mild", "Moderate", "Severe", "PDR"];

export function gradeColor(grade: DrGrade): string {
  return `var(${GRADE_META[grade].varName})`;
}
