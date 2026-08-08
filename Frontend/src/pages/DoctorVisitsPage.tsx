import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAsync } from "@/lib/hooks";
import { useToast } from "@/contexts/ToastContext";
import {
  PageHeader,
  Panel,
  Field,
  Button,
  DataTable,
  LoadState,
  StatusBadge,
  GradeBadge,
  Icon,
  Modal,
  ConfirmDialog,
} from "@/components/ui";
import {
  visitStatuses,
  eyes,
  referralTypes,
  label,
  genders,
  diabetesTypes,
  qualityStatuses,
  metricTypes,
  metricContexts,
} from "@/lib/enums";
import { can } from "@/lib/permissions";
import { ProtectedImage } from "@/components/ProtectedImage";
import { fmtDate, num } from "@/lib/format";
import type {
  VisitDto,
  FundusImageDto,
  PatientDetailDto,
  PrescriptionItemDto,
} from "@/types/api";

/**
 * Trang lượt khám của BÁC SĨ.
 *
 * Bác sĩ xem những lượt khám được lễ tân bàn giao cho mình (lọc doctorId =
 * chính mình), chọn theo ngày. Trong mỗi lượt: nạp ảnh + chạy AI, kê đơn, và
 * đóng lượt. Đây là nơi TẠO dữ liệu lâm sàng gắn với lượt khám; việc xem/sửa
 * về sau vẫn ở trang hồ sơ bệnh nhân.
 *
 * Chuông thông báo hiển thị khi có lượt khám mới được giao (backend đẩy
 * NotificationType.Visit khi lễ tân tạo lượt).
 */
export function DoctorVisitsPage() {
  const data = useData();
  const { user } = useAuth();
  const toast = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState<string>("");
  const [selected, setSelected] = useState<VisitDto | null>(null);

  // Lượt khám được giao cho bác sĩ đang đăng nhập, trong ngày đã chọn.
  const visits = useAsync(
    () =>
      data.visits.assignedToMe({
        from: date,
        to: date,
        status: status || undefined,
        page: 1,
        pageSize: 50,
      }),
    [date, status],
  );

  // Số thông báo chưa đọc (chuông).
  const unread = useAsync(() => data.engagement.unread(), []);

  return (
    <>
      <PageHeader
        title="Lượt khám của tôi"
        subtitle="Các lượt khám được lễ tân bàn giao cho bạn. Chọn ngày để xem, mở từng lượt để khám, kê đơn và đóng lượt."
        actions={
          <NotificationBell
            count={unread.data?.count || 0}
            onSeen={() => unread.reload()}
          />
        }
      />

      <Panel>
        <div className="toolbar">
          <Field labelText="Ngày khám" className="inline">
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelected(null);
              }}
            />
          </Field>
          <Field labelText="Trạng thái" className="inline">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="0">Đang khám</option>
              <option value="1">Đã đóng</option>
            </select>
          </Field>
        </div>

        <LoadState
          loading={visits.loading}
          error={visits.error}
          empty={!visits.data?.items.length}
          emptyText="Không có lượt khám nào được giao cho bạn trong ngày này."
        >
          {visits.data && (
            <DataTable
              headers={["Mã BN", "Bệnh nhân", "Giờ tiếp nhận", "Ảnh", "Trạng thái", ""]}
            >
              {visits.data.items.map((v: VisitDto) => (
                <tr key={v.id}>
                  <td>{v.patientCode}</td>
                  <td>{v.patientName}</td>
                  <td>{fmtDate(v.visitDate, true)}</td>
                  <td>{v.imageCount}</td>
                  <td>
                    <StatusBadge
                      text={label(visitStatuses, v.status)}
                      kind={v.status === 1 ? "ok" : "watch"}
                    />
                  </td>
                  <td>
                    <Button kind="primary" onClick={() => setSelected(v)}>
                      Mở lượt
                    </Button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </LoadState>
      </Panel>

      {selected && (
        <VisitWorkspace
          visit={selected}
          onClose={() => setSelected(null)}
          onChanged={() => visits.reload()}
        />
      )}
    </>
  );
}

/* ---------------- Chuông thông báo ---------------- */
function NotificationBell({
  count,
  onSeen,
}: {
  count: number;
  onSeen: () => void;
}) {
  const data = useData();
  const [open, setOpen] = useState(false);
  const list = useAsync(
    () => (open ? data.engagement.notifications({ page: 1, pageSize: 20 }) : Promise.resolve(null)),
    [open],
  );

  const markAll = async () => {
    await data.engagement.readAll();
    onSeen();
    list.reload();
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icon name="heart" />
        Thông báo{count > 0 ? ` (${count})` : ""}
      </Button>
      {open && (
        <Modal title="Thông báo" onClose={() => setOpen(false)}>
          <LoadState
            loading={list.loading}
            error={list.error}
            empty={!list.data?.items.length}
            emptyText="Chưa có thông báo nào."
          >
            {list.data && (
              <>
                {count > 0 && (
                  <Button onClick={markAll} style={{ marginBottom: 12 }}>
                    Đánh dấu tất cả đã đọc
                  </Button>
                )}
                <div className="notif-list">
                  {list.data.items.map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.isRead ? "" : "unread"}`}
                    >
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-msg">{n.message}</div>
                      <div className="notif-date">{fmtDate(n.createdAt, true)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </LoadState>
        </Modal>
      )}
    </>
  );
}

/* ---------------- Không gian làm việc trong 1 lượt khám ---------------- */
function VisitWorkspace({
  visit,
  onClose,
  onChanged,
}: {
  visit: VisitDto;
  onClose: () => void;
  onChanged: () => void;
}) {
  const data = useData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"images" | "prescriptions" | "monitoring" | "close">(
    "images",
  );
  const patient = useAsync(() => data.patients.get(visit.patientId), [visit.patientId]);
  const closed = visit.status === 1;

  return (
    <Modal title={`Lượt khám · ${visit.patientName}`} onClose={onClose} width="80%">
      <PatientSummary patient={patient.data} loading={patient.loading} />

      <div className="visit-tabs">
        <button
          className={tab === "images" ? "active" : ""}
          onClick={() => setTab("images")}
        >
          Ảnh &amp; AI
        </button>
        <button
          className={tab === "prescriptions" ? "active" : ""}
          onClick={() => setTab("prescriptions")}
        >
          Đơn thuốc
        </button>
        <button
          className={tab === "monitoring" ? "active" : ""}
          onClick={() => setTab("monitoring")}
        >
          Chỉ số
        </button>
        {!closed && (
          <button
            className={tab === "close" ? "active" : ""}
            onClick={() => setTab("close")}
          >
            Đóng lượt
          </button>
        )}
        <button onClick={() => navigate(`/patients/${visit.patientId}`)}>
          Mở hồ sơ đầy đủ
        </button>
      </div>

      {tab === "images" && (
        <VisitImages visit={visit} closed={closed} onChanged={onChanged} />
      )}
      {tab === "prescriptions" && (
        <PrescriptionPanel visit={visit} />
      )}
      {tab === "monitoring" && <MonitoringPanel patientId={visit.patientId} />}
      {tab === "close" && !closed && (
        <CloseVisitForm
          visit={visit}
          onDone={() => {
            onChanged();
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

function PatientSummary({
  patient,
  loading,
}: {
  patient?: PatientDetailDto | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Panel title="Thông tin bệnh nhân">
        <p className="muted">Đang tải thông tin bệnh nhân…</p>
      </Panel>
    );
  }

  if (!patient) {
    return (
      <Panel title="Thông tin bệnh nhân">
        <p className="muted">Không có dữ liệu bệnh nhân.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Thông tin bệnh nhân">
      <div className="detail-grid">
        <InfoRow k="Mã BN" v={patient.code} />
        <InfoRow k="Họ tên" v={patient.fullName} />
        <InfoRow k="Ngày sinh" v={fmtDate(patient.dateOfBirth)} />
        <InfoRow k="Tuổi" v={patient.age} />
        <InfoRow k="Giới tính" v={label(genders, patient.gender)} />
        <InfoRow k="SĐT" v={patient.phone} />
        <InfoRow k="Địa chỉ" v={patient.address || "—"} />
        <InfoRow k="Loại đái tháo đường" v={label(diabetesTypes, patient.diabetesType)} />
        <InfoRow k="Thời gian mắc" v={patient.diabetesDurationYears == null ? "—" : `${patient.diabetesDurationYears} năm`} />
        <InfoRow k="HbA1c nền" v={patient.baselineHbA1c == null ? "—" : `${patient.baselineHbA1c}%`} />
        <InfoRow k="Bác sĩ phụ trách" v={patient.doctorInCharge || "—"} />
      </div>
    </Panel>
  );
}

function InfoRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="detail-item">
      <small>{k}</small>
      <strong>{v}</strong>
    </div>
  );
}

/* ---------------- Ảnh + AI trong lượt ---------------- */
function MonitoringPanel({ patientId }: { patientId: number }) {
  const data = useData();
  const [type, setType] = useState("");
  const metrics = useAsync(
    () => data.monitoring.metrics({ patientId, type, size: 100 }),
    [patientId, type],
  );
  const summary = useAsync(() => data.monitoring.summary(patientId), [patientId]);
  const glucose = summary.data?.glucose;
  const hba1c = summary.data?.hba1c;
  const bloodPressure = summary.data?.bloodPressure;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>Glucose bất thường</span>
          <b className="mono">{glucose?.abnormalCount ?? "—"}</b>
        </div>
        <div className="stat">
          <span>Glucose trung bình</span>
          <b className="mono">{num(glucose?.average)}</b>
        </div>
        <div className="stat">
          <span>HbA1c gần nhất</span>
          <b className="mono">
            {hba1c?.latest?.value == null ? "—" : `${hba1c.latest.value}%`}
          </b>
        </div>
        <div className="stat">
          <span>HA tâm thu</span>
          <b className="mono">{num(bloodPressure?.latest?.systolic)}</b>
        </div>
        <div className="stat">
          <span>HA tâm trương</span>
          <b className="mono">{num(bloodPressure?.latest?.diastolic)}</b>
        </div>
      </div>

      <Panel
        title="Chỉ số sức khỏe"
        action={
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tất cả loại</option>
            {metricTypes.map(
              (x, i) =>
                i > 0 && (
                  <option value={i} key={i}>
                    {x}
                  </option>
                ),
            )}
          </select>
        }
      >
        <LoadState
          loading={metrics.loading}
          error={metrics.error}
          empty={!metrics.data?.items.length}
          onRetry={metrics.reload}
        >
          <DataTable
            headers={["Ngày", "Loại", "Giá trị", "Bối cảnh", "Đánh giá", "Ghi chú"]}
          >
            {metrics.data?.items.map((m) => (
              <tr key={m.id}>
                <td className="mono">{fmtDate(m.recordedAtUtc, true)}</td>
                <td>{label(metricTypes, m.metricType)}</td>
                <td className="mono">
                  {m.value} {m.unit}
                </td>
                <td>{label(metricContexts, m.context)}</td>
                <td>
                  <StatusBadge
                    text={m.isAbnormal ? "Bất thường" : "Trong ngưỡng"}
                    kind={m.isAbnormal ? "alert" : "ok"}
                  />
                </td>
                <td className="wrap-text">{m.note || "—"}</td>
              </tr>
            ))}
          </DataTable>
        </LoadState>
      </Panel>
    </>
  );
}

function VisitImages({
  visit,
  closed,
  onChanged,
}: {
  visit: VisitDto;
  closed: boolean;
  onChanged: () => void;
}) {
  const data = useData();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [quality, setQuality] = useState<FundusImageDto | null>(null);
  const [voiding, setVoiding] = useState<FundusImageDto | null>(null);

  const images = useAsync(async () => {
    const rows = await data.images.list({
      visitId: visit.id,
      page: 1,
      pageSize: 50,
    });

    // ImagesService.List currently returns image metadata but does not populate
    // LatestDiagnosis, so fetch the latest diagnosis for each image here.
    return Promise.all(
      rows.map(async (img) => {
        try {
          const diagnoses = await data.diagnoses.byImage(img.id);
          return { ...img, latestDiagnosis: diagnoses[0] || null };
        } catch {
          return img;
        }
      }),
    );
  }, [visit.id]);

  const runAi = async (imageId: number) => {
    try {
      await data.diagnoses.run(imageId);
      toast.push("Đã chạy AI cho ảnh.", "success");
      images.reload();
    } catch (e) {
      toast.push((e as Error).message, "error");
    }
  };

  const setQ = async (status: number, note: string) => {
    if (!quality) return;
    await data.images.quality(quality.id, status, note, quality.rowVersion);
    toast.push("Đã cập nhật chất lượng ảnh.", "success");
    setQuality(null);
    images.reload();
  };

  const voidImg = async (reason: string) => {
    if (!voiding) return;
    await data.images.void(voiding.id, reason, voiding.rowVersion);
    toast.push("Đã thu hồi ảnh và kết quả liên quan.", "success");
    setVoiding(null);
    images.reload();
  };

  return (
    <>
      {!closed && (
        <Button
          kind="primary"
          onClick={() => setUploading(true)}
          style={{ marginBottom: 12 }}
        >
          <Icon name="plus" />
          Nạp ảnh đáy mắt
        </Button>
      )}

      <LoadState
        loading={images.loading}
        error={images.error}
        empty={!images.data?.length}
        emptyText="Chưa có ảnh nào trong lượt khám này."
      >
        {images.data && (
          <DataTable headers={["Ảnh", "Mắt", "Chất lượng", "Kết quả AI", ""]}>
            {images.data.map((img: FundusImageDto) => (
              <tr key={img.id}>
                <td>
                  <ProtectedImage
                    imageId={img.id}
                    alt={`Ảnh đáy mắt #${img.id}`}
                    onClick={() =>
                      navigate(
                        img.latestDiagnosis
                          ? `/fundus/${img.id}?diagnosis=${img.latestDiagnosis.id}`
                          : `/fundus/${img.id}`,
                      )
                    }
                  />
                </td>
                <td>{label(eyes, img.eye)}</td>
                <td>{img.qualityStatus === 1 ? "Đạt" : "Chưa đạt"}</td>
                <td>
                  {img.latestDiagnosis ? (
                    <span>
                      <GradeBadge grade={img.latestDiagnosis.drGrade} />
                      {img.latestDiagnosis.isConfirmed
                        ? " · đã xác nhận"
                        : " · chờ bác sĩ duyệt"}
                    </span>
                  ) : (
                    <span className="muted">Chưa chạy AI</span>
                  )}
                </td>
                <td>
                  <div className="actions">
                    {can.manageImages(user) && (
                      <Button onClick={() => setQuality(img)}>Chất lượng</Button>
                    )}
                    <Button
                      onClick={() =>
                        navigate(
                          img.latestDiagnosis
                            ? `/fundus/${img.id}?diagnosis=${img.latestDiagnosis.id}`
                            : `/fundus/${img.id}`,
                        )
                      }
                    >
                      Xem
                    </Button>
                    {can.voidImage(user) && (
                      <Button kind="danger" onClick={() => setVoiding(img)}>
                        Void
                      </Button>
                    )}
                    
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </LoadState>

      {uploading && (
        <UploadModal
          patientId={visit.patientId}
          visitId={visit.id}
          onClose={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            images.reload();
            onChanged();
          }}
        />
      )}
      {quality && (
        <QualityModal
          image={quality}
          onClose={() => setQuality(null)}
          onSave={setQ}
        />
      )}
      {voiding && (
        <ConfirmDialog
          title="Void ảnh đáy mắt"
          message={`Ảnh #${voiding.id} và mọi kết quả AI/review liên quan sẽ bị thu hồi.`}
          requireReason
          danger
          onClose={() => setVoiding(null)}
          onConfirm={voidImg}
        />
      )}
    </>
  );
}

function QualityModal({
  image,
  onClose,
  onSave,
}: {
  image: FundusImageDto;
  onClose: () => void;
  onSave: (s: number, n: string) => void;
}) {
  const [status, setStatus] = useState(image.qualityStatus);
  const [note, setNote] = useState(image.qualityNote || "");
  return (
    <Modal
      title={`Kiểm duyệt chất lượng ảnh #${image.id}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            kind="primary"
            disabled={status === 2 && !note.trim()}
            onClick={() => onSave(status, note)}
          >
            Lưu
          </Button>
        </>
      }
    >
      <Field labelText="Trạng thái">
        <select value={status} onChange={(e) => setStatus(Number(e.target.value))}>
          {qualityStatuses.map((x, i) => (
            <option key={i} value={i}>
              {x}
            </option>
          ))}
        </select>
      </Field>
      <Field labelText="Ghi chú" required={status === 2}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Bắt buộc khi ảnh không đạt"
        />
      </Field>
    </Modal>
  );
}

function PrescriptionPanel({ visit }: { visit: VisitDto }) {
  const data = useData();
  const toast = useToast();
  const prescriptions = useAsync(
    () => data.prescriptions.list({ patientId: visit.patientId, page: 1, pageSize: 100 }),
    [visit.patientId],
  );
  const [note, setNote] = useState("");
  const [items, setItems] = useState<PrescriptionItemDto[]>([
    {
      drugName: "",
      dose: "",
      timesPerDay: 1,
      durationDays: 30,
      instruction: "",
    },
  ]);
  const [busy, setBusy] = useState(false);

  const patch = (i: number, k: keyof PrescriptionItemDto, v: unknown) => {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  };

  const save = async () => {
    if (!items.length || items.some((x) => !x.drugName.trim() || !x.dose.trim())) {
      toast.push("Tên thuốc và liều là bắt buộc.", "error");
      return;
    }

    setBusy(true);
    try {
      await data.prescriptions.create({
        patientId: visit.patientId,
        visitId: visit.id,
        note: note.trim() || null,
        items: items.map(({ id, instruction, instructions, ...x }) => ({
          ...x,
          instruction: instruction ?? null,
          instructions: instructions ?? instruction ?? null,
        })),
      });
      toast.push("Đã lưu đơn thuốc.", "success");
      setItems([
        {
          drugName: "",
          dose: "",
          timesPerDay: 1,
          durationDays: 30,
          instruction: "",
        },
      ]);
      setNote("");
      prescriptions.reload();
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Panel title="Kê đơn thuốc">
        <p className="muted">
          Nhập thuốc cho lượt khám này. Mỗi dòng gồm tên thuốc, liều dùng, số lần/ngày và số ngày.
        </p>
        <DataTable headers={["Tên thuốc", "Liều", "Lần/ngày", "Số ngày", "Hướng dẫn", ""]}>
          {items.map((x, i) => (
            <tr key={i}>
              <td>
                <input value={x.drugName} onChange={(e) => patch(i, "drugName", e.target.value)} />
              </td>
              <td>
                <input value={x.dose} onChange={(e) => patch(i, "dose", e.target.value)} />
              </td>
              <td>
                <input
                  type="number"
                  min="1"
                  max="6"
                  value={x.timesPerDay}
                  onChange={(e) => patch(i, "timesPerDay", Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={x.durationDays}
                  onChange={(e) => patch(i, "durationDays", Number(e.target.value))}
                />
              </td>
              <td>
                <input value={x.instruction || ""} onChange={(e) => patch(i, "instruction", e.target.value)} />
              </td>
              <td>
                <Button
                  kind="danger"
                  disabled={items.length === 1}
                  onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                >
                  ×
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
        <Button
          onClick={() =>
            setItems((xs) => [
              ...xs,
              {
                drugName: "",
                dose: "",
                timesPerDay: 1,
                durationDays: 30,
                instruction: "",
              },
            ])
          }
        >
          <Icon name="plus" />
          Thêm thuốc
        </Button>
        <Field labelText="Ghi chú">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Button kind="primary" busy={busy} onClick={save}>
            Lưu đơn thuốc
          </Button>
        </div>
      </Panel>

      <Panel title="Lịch sử đơn thuốc">
        <LoadState
          loading={prescriptions.loading}
          error={prescriptions.error}
          empty={!prescriptions.data?.items.length}
          emptyText="Chưa có đơn thuốc nào cho bệnh nhân này."
        >
          {prescriptions.data && (
            <DataTable headers={["Ngày kê", "Bác sĩ", "Thuốc", "Ghi chú"]}>
              {prescriptions.data.items.map((p) => (
                <tr key={p.id}>
                  <td>{fmtDate(p.issuedAt, true)}</td>
                  <td>{p.doctorName}</td>
                  <td className="wrap-text">
                    {p.items
                      .map(
                        (x) =>
                          `${x.drugName} ${x.dose} · ${x.timesPerDay} lần/ngày · ${x.durationDays} ngày`,
                      )
                      .join("; ")}
                  </td>
                  <td className="wrap-text">{p.note || "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
        </LoadState>
      </Panel>
    </>
  );
}

function UploadModal({
  patientId,
  visitId,
  onClose,
  onDone,
}: {
  patientId: number;
  visitId: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const data = useData();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [eye, setEye] = useState(0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!file) {
      toast.push("Chọn tệp ảnh.", "error");
      return;
    }
    setBusy(true);
    try {
      await data.images.upload(file, patientId, visitId, eye);
      toast.push("Đã nạp ảnh.", "success");
      onDone();
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Nạp ảnh đáy mắt" onClose={onClose}>
      <Field labelText="Mắt" required>
        <select value={String(eye)} onChange={(e) => setEye(Number(e.target.value))}>
          <option value="0">OD (mắt phải)</option>
          <option value="1">OS (mắt trái)</option>
        </select>
      </Field>
      <Field labelText="Tệp ảnh" required help="JPG/PNG, tối đa 10 MB.">
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </Field>
      {file && (
        <div style={{ marginTop: 12 }}>
          <div className="help" style={{ marginBottom: 6 }}>
            Xem trước: {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
          <img
            src={URL.createObjectURL(file)}
            alt="Xem trước ảnh sẽ tải lên"
            style={{
              display: "block",
              width: "100%",
              maxHeight: 280,
              objectFit: "contain",
              borderRadius: 10,
              border: "1px solid var(--border, #d8dee8)",
            }}
            onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
          />
        </div>
      )}
      <div className="modal-actions">
        <Button onClick={onClose}>Hủy</Button>
        <Button kind="primary" busy={busy} onClick={save}>
          Nạp ảnh
        </Button>
      </div>
    </Modal>
  );
}

/* ---------------- Đóng lượt ---------------- */
function CloseVisitForm({
  visit,
  onDone,
}: {
  visit: VisitDto;
  onDone: () => void;
}) {
  const data = useData();
  const toast = useToast();
  const [conclusion, setConclusion] = useState("");
  const [referral, setReferral] = useState(0);
  const [recheckMonths, setRecheckMonths] = useState<number | "">(6);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!conclusion.trim()) {
      toast.push("Kết luận là bắt buộc khi đóng lượt.", "error");
      return;
    }
    setBusy(true);
    try {
      await data.visits.close(visit.id, {
        conclusion: conclusion.trim(),
        referral,
        recheckMonths: recheckMonths === "" ? null : Number(recheckMonths),
        rowVersion: visit.rowVersion,
      });
      toast.push("Đã đóng lượt khám.", "success");
      onDone();
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Field labelText="Kết luận" required>
        <textarea
          rows={4}
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          placeholder="Kết luận khám, hướng xử trí…"
        />
      </Field>
      <Field labelText="Chuyển tuyến">
        <select value={String(referral)} onChange={(e) => setReferral(Number(e.target.value))}>
          {referralTypes.map((r, i) => (
            <option key={i} value={i}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <Field labelText="Tái khám sau (tháng)">
        <input
          type="number"
          min={1}
          max={24}
          value={recheckMonths}
          onChange={(e) =>
            setRecheckMonths(e.target.value ? Number(e.target.value) : "")
          }
        />
      </Field>
      <div className="modal-actions">
        <Button kind="primary" busy={busy} onClick={save}>
          Đóng lượt khám
        </Button>
      </div>
    </>
  );
}
