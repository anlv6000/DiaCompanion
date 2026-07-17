import { useEffect, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import type { AiDiagnosis, DrGrade } from "@/types/models";
import { DataState, DeferBadge, GradeChip, MeterBar, ReferableTag } from "@/components/clinical";
import { Button, Panel, PanelHeader, Select, cx } from "@/components/ui/primitives";
import { GRADE_ORDER } from "@/lib/grades";
import { fmtDateTime, pct } from "@/lib/format";

export function TriagePage() {
  const { triage, loading, error, loadTriage } = useData();
  const [selected, setSelected] = useState<AiDiagnosis | null>(null);

  useEffect(() => {
    loadTriage();
  }, [loadTriage]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div>
        <h1 className="font-serif text-title text-ink">Hàng đợi triage</h1>
        <p className="text-meta text-ink-faint mt-0.5">
          Ca chờ bác sĩ — ưu tiên: chuyển bác sĩ (defer) → cần chuyển tuyến → bất đồng cao.
        </p>
      </div>

      <div className="flex-1 min-h-0 flex gap-4">
        <Panel className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <PanelHeader
            title="Ca chờ xử lý"
            right={
              <span className="text-meta text-ink-faint tabular-nums">
                {triage ? `${triage.length} ca` : ""}
              </span>
            }
          />
          <div className="flex-1 min-h-0 overflow-auto">
            <DataState
              loading={loading.triage}
              error={error.triage}
              empty={triage?.length === 0}
              emptyLabel="Không còn ca nào trong hàng đợi."
              onRetry={loadTriage}
            >
              <TriageTable rows={triage ?? []} selectedId={selected?.id} onSelect={setSelected} />
            </DataState>
          </div>
        </Panel>

        <ReviewRail diag={selected} onDone={() => setSelected(null)} />
      </div>
    </div>
  );
}

function TriageTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: AiDiagnosis[];
  selectedId?: number;
  onSelect: (d: AiDiagnosis) => void;
}) {
  return (
    <table className="w-full text-dense">
      <thead className="sticky top-0 bg-canvas text-ink-faint text-micro uppercase tracking-wide">
        <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
          <th>Ca (ảnh)</th>
          <th>DR</th>
          <th>Tin cậy</th>
          <th>Bất đồng</th>
          <th>Trạng thái</th>
          <th>Chuyển tuyến</th>
          <th>Model</th>
          <th>Thời điểm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr
            key={d.id}
            onClick={() => onSelect(d)}
            className={cx(
              "border-t border-hairline cursor-pointer hover:bg-canvas [&>td]:px-3 [&>td]:h-9 [&>td]:align-middle",
              selectedId === d.id && "bg-primary/5",
            )}
          >
            <td className="font-mono text-ink-muted tabular-nums">#{d.fundusImageId}</td>
            <td>
              <GradeChip grade={d.drGrade} />
            </td>
            <td className="w-32">
              <MeterBar value={d.confidence} tone={d.confidence < 0.65 ? "alert" : "primary"} />
            </td>
            <td className="w-32">
              <MeterBar value={d.crossTaskDisagreement} tone="defer" />
            </td>
            <td>{d.deferred ? <DeferBadge /> : <span className="text-ink-faint text-micro">—</span>}</td>
            <td>
              <ReferableTag referable={d.referable} />
            </td>
            <td className="font-mono text-micro text-ink-faint">{d.modelVersion}</td>
            <td className="text-micro text-ink-faint tabular-nums">{fmtDateTime(d.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReviewRail({ diag, onDone }: { diag: AiDiagnosis | null; onDone: () => void }) {
  const { submitReview, loading, error } = useData();
  const { hasRole } = useAuth();
  const [override, setOverride] = useState(false);
  const [finalGrade, setFinalGrade] = useState<DrGrade>("Normal");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (diag) {
      setOverride(false);
      setFinalGrade(diag.drGrade);
      setNote("");
    }
  }, [diag]);

  if (!diag) {
    return (
      <Panel className="w-[340px] shrink-0 hidden lg:flex items-center justify-center">
        <span className="text-ink-faint text-dense">Chọn một ca để xem chi tiết</span>
      </Panel>
    );
  }

  const canReview = hasRole("Doctor");

  async function decide(action: "Approve" | "Override") {
    if (!diag) return;
    await submitReview(diag.id, {
      action,
      finalGrade: action === "Approve" ? diag.drGrade : finalGrade,
      note: note || undefined,
    });
    onDone();
  }

  return (
    <Panel className="w-[340px] shrink-0 flex flex-col">
      <PanelHeader title="Kết quả AI" />
      <div className="p-4 space-y-3 text-dense">
        <div className="flex items-center justify-between">
          <span className="text-ink-faint">Ảnh</span>
          <span className="font-mono text-ink tabular-nums">#{diag.fundusImageId}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-faint">Phân độ AI</span>
          <GradeChip grade={diag.drGrade} />
        </div>
        <Row label="Độ tin cậy" value={pct(diag.confidence)} warn={diag.confidence < 0.65} />
        <Row label="Bất đồng chéo" value={diag.crossTaskDisagreement.toFixed(3)} />
        <Row label="Fractal dimension" value={diag.fractalDimension?.toFixed(4) ?? "—"} />
        <div className="flex items-center justify-between">
          <span className="text-ink-faint">Đề xuất</span>
          {diag.deferred ? <DeferBadge /> : <span className="text-risk-ok text-micro">Tự tin</span>}
        </div>

        {/* clinical safety: AI is decision support, human sets final grade */}
        <div className="pt-2 border-t border-hairline">
          <div className="text-micro text-ink-faint mb-2">
            Kết quả AI là hỗ trợ quyết định — chưa xác nhận cho tới khi bác sĩ duyệt.
          </div>

          {!canReview ? (
            <div className="text-micro text-ink-faint">Chỉ bác sĩ được phê duyệt/ghi đè.</div>
          ) : !override ? (
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1 justify-center" onClick={() => decide("Approve")}>
                Phê duyệt
              </Button>
              <Button variant="outline" className="flex-1 justify-center" onClick={() => setOverride(true)}>
                Ghi đè
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Select value={finalGrade} onChange={(e) => setFinalGrade(e.target.value as DrGrade)}>
                {GRADE_ORDER.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú lý do ghi đè…"
                className="w-full h-16 p-2 rounded-sm border border-hairline text-dense resize-none"
              />
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1 justify-center" onClick={() => decide("Override")}>
                  Lưu ghi đè
                </Button>
                <Button variant="ghost" onClick={() => setOverride(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          )}
          {(loading.review || error.review) && (
            <div className={cx("mt-2 text-micro", error.review ? "text-risk-alert" : "text-ink-faint")}>
              {error.review ?? "Đang lưu…"}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-faint">{label}</span>
      <span className={cx("font-mono tabular-nums", warn ? "text-risk-alert" : "text-ink")}>{value}</span>
    </div>
  );
}
