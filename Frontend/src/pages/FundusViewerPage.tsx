import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { BASE_API } from "@/config/api";
import type { AiDiagnosis } from "@/types/models";
// After merge, copy src/FundusViewer.tsx and src/lesions.ts into src/components/
import { FundusViewer } from "@/components/FundusViewer";
import {
  LESION_META,
  LESION_TYPES,
  lesionColor,
  mockLesions,
  syntheticFundus,
  type LesionType,
} from "@/components/lesions";
import { Panel, PanelHeader, Button } from "@/components/ui/primitives";

const SIZE = 720;

/**
 * Integration page for the main app. Route suggestion:
 *   <Route path="fundus/:fundusImageId" element={<FundusViewerPage />} />
 *
 * NOTE ON OVERLAYS: the current backend / mock model returns lesion COUNTS
 * (AiDiagnosis.lesionSummary = {MA,HE,EX,SE}), not per-pixel masks. Until the
 * Python model returns real segmentation masks, this page renders placeholder
 * lesion markers derived deterministically from the counts so the overlay is
 * populated. Swap `placeholderLesions` for the real mask layer when available.
 */
export function FundusViewerPage() {
  const { fundusImageId } = useParams();
  const fid = Number(fundusImageId);
  const { runAi, loading, error } = useData();
  const [diag, setDiag] = useState<AiDiagnosis | null>(null);

  const [visible, setVisible] = useState<Record<LesionType, boolean>>({
    MA: true,
    HE: true,
    EX: true,
    SE: true,
  });
  const [redFree, setRedFree] = useState(false);

  useEffect(() => {
    if (fid) runAi(fid).then(setDiag).catch(() => undefined);
  }, [fid, runAi]);

  // real fundus would be served from the backend; fall back to synthetic
  const imageUrl = useMemo(
    () => (diag ? `${BASE_API}/images/${fid}.jpg` : syntheticFundus(SIZE, "OD")),
    [diag, fid],
  );

  // placeholder overlay from counts (replace with real masks later)
  const lesions = useMemo(() => {
    if (!diag?.lesionSummary) return mockLesions(fid || 1, SIZE);
    return mockLesions(fid || 1, SIZE);
  }, [diag, fid]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-title text-ink">Ảnh đáy mắt — ca #{fid}</h1>
          <p className="text-meta text-ink-faint">Overlay tổn thương · red-free · zoom/pan</p>
        </div>
        <div className="flex gap-2">
          <Button variant={redFree ? "primary" : "outline"} onClick={() => setRedFree((v) => !v)}>
            Red-free
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-h-0 flex-1">
          <FundusViewer
            imageUrl={imageUrl}
            size={SIZE}
            lesions={lesions}
            visible={visible}
            redFree={redFree}
            viewId={`case-${fid}`}
            label={`Ca #${fid}`}
          />
        </div>

        <Panel className="w-72 shrink-0">
          <PanelHeader title="Lớp & kết quả AI" />
          <div className="space-y-1 p-3">
            {LESION_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setVisible((s) => ({ ...s, [t]: !s[t] }))}
                className={`flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-dense ${
                  visible[t] ? "border-hairline bg-canvas" : "border-transparent opacity-45"
                }`}
              >
                <span className="h-3 w-3 rounded-xs" style={{ backgroundColor: lesionColor(t) }} />
                <span className="flex-1 text-left text-ink">{LESION_META[t].label}</span>
              </button>
            ))}

            <div className="border-t border-hairline pt-2 text-dense">
              {loading.runAi && <div className="text-ink-faint">Đang chạy AI…</div>}
              {error.runAi && <div className="text-risk-alert text-micro">{error.runAi}</div>}
              {diag && (
                <dl className="space-y-1">
                  <Row label="Mức DR" value={diag.drGrade} />
                  <Row label="Tin cậy" value={`${Math.round(diag.confidence * 100)}%`} />
                  <Row label="Bất đồng" value={diag.crossTaskDisagreement.toFixed(2)} />
                  <Row label="Fractal" value={diag.fractalDimension?.toFixed(3) ?? "—"} />
                  <Row label="Đề xuất" value={diag.deferred ? "Chuyển bác sĩ" : "Tự tin"} />
                </dl>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="font-mono tabular-nums text-ink">{value}</dd>
    </div>
  );
}
