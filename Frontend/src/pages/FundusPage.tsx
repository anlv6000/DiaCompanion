import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAsync } from "@/lib/hooks";
import { can } from "@/lib/permissions";
import {
  PageHeader,
  Panel,
  Button,
  LoadState,
  GradeBadge,
  StatusBadge,
  Field,
  ConfirmDialog,
} from "@/components/ui";
import { fmtDate, num } from "@/lib/format";
import { grades } from "@/lib/enums";

export function FundusPage({ imageId }: { imageId: number }) {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const data = useData();
  const toast = useToast();
  const { user } = useAuth();
  const diagId = Number(sp.get("diagnosis") || 0);
  const diagnoses = useAsync(() => data.diagnoses.byImage(imageId), [imageId]);
  const selected = diagId
    ? diagnoses.data?.find((x) => x.id === diagId)
    : diagnoses.data?.[0];

  const [url, setUrl] = useState("");
  const [zoom, setZoom] = useState(1);
  const [redFree, setRedFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(false);
  const [grade, setGrade] = useState(0);
  const [reason, setReason] = useState("");
  const [voidReview, setVoidReview] = useState(false);

  useEffect(() => {
    let u = "";
    data.images
      .content(imageId)
      .then((b) => {
        u = URL.createObjectURL(b);
        setUrl(u);
      })
      .catch((e) => toast.push((e as Error).message, "error"));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [imageId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected) setGrade(selected.drGrade);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canReview = can.reviewDiagnosis(user?.role);

  const run = async () => {
    setBusy(true);
    try {
      const d = await data.diagnoses.run(imageId);
      toast.push("Đã chạy lại AI.", "success");
      diagnoses.reload();
      navigate(`/fundus/${imageId}?diagnosis=${d.id}`, { replace: true });
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (override)
        await data.triage.override(selected.id, {
          rowVersion: selected.rowVersion,
          finalGrade: grade,
          reason,
        });
      else await data.triage.approve(selected.id, selected.rowVersion);
      toast.push("Đã lưu xác nhận của bác sĩ.", "success");
      diagnoses.reload();
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const voidR = async (r: string) => {
    if (!selected?.review) return;
    await data.triage.voidReview(selected.review.id, r);
    toast.push("Đã thu hồi review; ca quay lại triage.", "success");
    setVoidReview(false);
    diagnoses.reload();
  };

  return (
    <>
      <PageHeader
        title={`Trình xem ảnh đáy mắt #${imageId}`}
        subtitle="Khung ảnh là bề mặt tối duy nhất; kết quả AI luôn kèm trạng thái xác nhận."
        actions={
          <>
            <Button onClick={() => navigate(-1)}>Quay lại</Button>
            {canReview && (
              <Button kind="primary" busy={busy} onClick={run}>
                Chạy lại AI
              </Button>
            )}
          </>
        }
      />
      <div className="fundus-layout">
        <section className="panel">
          <div className="fundus-toolbar">
            <Button onClick={() => setZoom((z) => Math.min(4, z + 0.25))}>
              Phóng to
            </Button>
            <Button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              Thu nhỏ
            </Button>
            <Button onClick={() => setZoom(1)}>100%</Button>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={redFree}
                onChange={(e) => setRedFree(e.target.checked)}
              />
              Red-free
            </label>
            <span className="badge mono">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="fundus">
            {url ? (
              <img
                className="viewer-image"
                src={url}
                alt={`Ảnh đáy mắt ${imageId}`}
                style={{
                  transform: `scale(${zoom})`,
                  filter: redFree
                    ? "grayscale(1) contrast(1.3) sepia(.1) hue-rotate(65deg)"
                    : "none",
                }}
              />
            ) : (
              <div>Đang tải ảnh có kiểm quyền…</div>
            )}
          </div>
        </section>

        <Panel title="Kết quả AI">
          <LoadState
            loading={diagnoses.loading}
            error={diagnoses.error}
            empty={!selected}
            onRetry={diagnoses.reload}
          >
            {selected && (
              <>
                <div className="split">
                  <GradeBadge grade={selected.drGrade} />
                  <StatusBadge
                    text={
                      selected.isConfirmed ? "Đã xác nhận" : "Chưa xác nhận"
                    }
                    kind={selected.isConfirmed ? "ok" : "defer"}
                  />
                </div>
                <div className="detail-grid" style={{ marginTop: 12 }}>
                  <Info
                    k="Tin cậy"
                    v={`${Math.round(selected.confidence * 100)}%`}
                  />
                  <Info k="Bất đồng" v={num(selected.disagreement, 3)} />
                  <Info k="Fractal" v={num(selected.fractalDimension, 4)} />
                  <Info k="Model" v={selected.modelVersion} />
                  <Info k="Thời điểm" v={fmtDate(selected.createdAt, true)} />
                  <Info
                    k="Phân độ từ tổn thương"
                    v={
                      selected.lesionGradeImplied == null
                        ? "—"
                        : grades[selected.lesionGradeImplied]
                    }
                  />
                </div>
                <Panel title="Tổn thương">
                  <div className="bars">
                    <Lesion
                      name="Vi phình mạch (MA)"
                      value={selected.countMA}
                    />
                    <Lesion name="Xuất huyết (HE)" value={selected.countHE} />
                    <Lesion
                      name="Xuất tiết cứng (EX)"
                      value={selected.countEX}
                    />
                    <Lesion
                      name="Xuất tiết mềm (SE)"
                      value={selected.countSE}
                    />
                  </div>
                </Panel>
                {selected.isDeferred && (
                  <div
                    className="state"
                    style={{
                      background: "var(--defer-bg)",
                      borderColor: "var(--defer)",
                    }}
                  >
                    <b>Chuyển bác sĩ</b>
                    <div>{selected.deferReasonLabel}</div>
                  </div>
                )}

                {selected.review ? (
                  <Panel title="Xác nhận của bác sĩ">
                    <div className="detail-grid">
                      <Info k="Hành động" v={selected.review.actionLabel} />
                      <Info
                        k="Phân độ cuối"
                        v={selected.review.finalGradeLabel}
                      />
                      <Info k="Bác sĩ" v={selected.review.doctorName} />
                      <Info
                        k="Thời điểm"
                        v={fmtDate(selected.review.createdAt, true)}
                      />
                    </div>
                    {selected.review.reason && <p>{selected.review.reason}</p>}
                    {/* Void review: CHỈ Bác sĩ. */}
                    {can.voidReview(user?.role) && (
                      <Button kind="danger" onClick={() => setVoidReview(true)}>
                        Void review
                      </Button>
                    )}
                  </Panel>
                ) : (
                  canReview && (
                    <Panel title="Xác nhận kết quả">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={override}
                          onChange={(e) => setOverride(e.target.checked)}
                        />
                        Ghi đè phân độ AI
                      </label>
                      {override && (
                        <>
                          <Field labelText="Phân độ cuối">
                            <select
                              value={grade}
                              onChange={(e) => setGrade(Number(e.target.value))}
                            >
                              {grades.map((x, i) => (
                                <option key={i} value={i}>
                                  {x}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field labelText="Lý do" required>
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                            />
                          </Field>
                        </>
                      )}
                      <Button
                        kind="primary"
                        busy={busy}
                        disabled={override && !reason.trim()}
                        onClick={review}
                      >
                        {override ? "Lưu ghi đè" : "Phê duyệt"}
                      </Button>
                    </Panel>
                  )
                )}
              </>
            )}
          </LoadState>
        </Panel>
      </div>
      {voidReview && selected?.review && (
        <ConfirmDialog
          title="Void review"
          message="Review sẽ được thu hồi và ca quay lại hàng đợi triage."
          requireReason
          danger
          onClose={() => setVoidReview(false)}
          onConfirm={voidR}
        />
      )}
    </>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <small>{k}</small>
      <div className="mono">{v ?? "—"}</div>
    </div>
  );
}
function Lesion({ name, value }: { name: string; value?: number | null }) {
  return (
    <div className="split">
      <span>{name}</span>
      <b className="mono">{value ?? "—"}</b>
    </div>
  );
}
