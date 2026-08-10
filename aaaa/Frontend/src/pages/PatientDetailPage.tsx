import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useAsync } from "@/lib/hooks";
import { can } from "@/lib/permissions";
import { hasRole } from "@/lib/roles";
import { ProtectedImage } from "@/components/ProtectedImage";
import {
  PageHeader,
  Panel,
  Tabs,
  LoadState,
  Button,
  DataTable,
  StatusBadge,
  GradeBadge,
  EyeBadge,
  Field,
  Modal,
  ConfirmDialog,
  Icon,
  Meter,
  ActionLink,
} from "@/components/ui";
import {
  genders,
  diabetesTypes,
  visitStatuses,
  referralTypes,
  qualityStatuses,
  metricTypes,
  metricContexts,
  label,
} from "@/lib/enums";
import { fmtDate, num } from "@/lib/format";
import type {
  PatientDetailDto,
  VisitDto,
  FundusImageDto,
  PrescriptionDto,
  PrescriptionItemDto,
  TempCredentialResponse,
  DoctorDto,
} from "@/types/api";

const TABS = [
  { key: "profile", label: "Hồ sơ" },
  { key: "visits", label: "Lượt khám" },
  { key: "images", label: "Ảnh & AI" },
  { key: "prescriptions", label: "Đơn thuốc" },
  { key: "monitoring", label: "Chỉ số" },
];

export function PatientDetailPage({ id }: { id: number }) {
  const data = useData();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || "profile";
  const patient = useAsync(() => data.patients.get(id), [id]);
  const isReceptionist = hasRole(user, "Receptionist") && !hasRole(user, "Doctor");
  const visibleTabs = isReceptionist
    ? TABS.filter((item) => item.key === "profile" || item.key === "visits")
    : TABS;
  const activeTab = visibleTabs.some((item) => item.key === tab)
    ? tab
    : "profile";
  const setTab = (t: string) => setSp({ tab: t }, { replace: true });

  return (
    <LoadState
      loading={patient.loading}
      error={patient.error}
      onRetry={patient.reload}
      empty={!patient.data}
    >
      {patient.data && (
        <>
          <PageHeader
            title={`${patient.data.code} · ${patient.data.fullName}`}
            subtitle={`Hồ sơ tạo ngày ${fmtDate(patient.data.createdAt)} · ${patient.data.visitCount} lượt khám`}
            actions={
              <>
                <Button onClick={() => navigate(`/patients/${id}/edit`)}>
                  <Icon name="edit" />
                  Sửa hồ sơ
                </Button>
                {hasRole(user, "Doctor") && (
                  <Button onClick={() => navigate(`/progression/${id}`)}>
                    <Icon name="chart" />
                    Diễn tiến
                  </Button>
                )}
              </>
            }
          />
          <Tabs items={visibleTabs} active={activeTab} onChange={setTab} />
          <div style={{ marginTop: 12 }}>
            {activeTab === "profile" && <ProfileTab patient={patient.data} />}
            {activeTab === "visits" && <VisitsTab patientId={id} />}
            {activeTab === "images" && hasRole(user, "Doctor") && <ImagesTab patientId={id} />}
            {activeTab === "prescriptions" && hasRole(user, "Doctor") && (
              <PrescriptionsTab patientId={id} />
            )}
            {activeTab === "monitoring" && hasRole(user, "Doctor") && (
              <MonitoringTab patientId={id} />
            )}
          </div>
        </>
      )}
    </LoadState>
  );
}

function Info({
  k,
  v,
  mono = false,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="detail-item">
      <small>{k}</small>
      <strong className={mono ? "mono" : ""}>{v}</strong>
    </div>
  );
}

function ProfileTab({ patient }: { patient: PatientDetailDto }) {
  const data = useData();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [cred, setCred] = useState<TempCredentialResponse | null>(null);
  const [voiding, setVoiding] = useState(false);

  const reissue = async () => setCred(await data.patients.reissue(patient.id));
  const doVoid = async (reason: string) => {
    await data.patients.void(patient.id, reason, patient.rowVersion);
    toast.push("Đã thu hồi hồ sơ và chuỗi lâm sàng liên quan.", "success");
    navigate("/patients");
  };

  return (
    <>
      <div className="grid2">
        <Panel title="Thông tin hành chính">
          <div className="detail-grid">
            <Info k="Mã bệnh nhân" v={patient.code} mono />
            <Info k="Họ tên" v={patient.fullName} />
            <Info k="Ngày sinh" v={fmtDate(patient.dateOfBirth)} />
            <Info k="Tuổi" v={patient.age} />
            <Info k="Giới tính" v={label(genders, patient.gender)} />
            <Info k="Số điện thoại" v={patient.phone} mono />
            <Info k="Địa chỉ" v={patient.address || "—"} />
            <Info
              k="Tài khoản"
              v={patient.hasAccount ? "Đã cấp" : "Chưa cấp"}
            />
          </div>
        </Panel>
        <Panel title="Tiền sử tiểu đường">
          <div className="detail-grid">
            <Info
              k="Loại tiểu đường"
              v={label(diabetesTypes, patient.diabetesType)}
            />
            <Info
              k="Thời gian mắc"
              v={
                patient.diabetesDurationYears == null
                  ? "—"
                  : `${patient.diabetesDurationYears} năm`
              }
            />
            <Info
              k="HbA1c nền"
              v={
                patient.baselineHbA1c == null
                  ? "—"
                  : `${patient.baselineHbA1c}%`
              }
            />
            <Info
              k="DR xác nhận gần nhất"
              v={<GradeBadge grade={patient.latestDrGrade} />}
            />
            <Info k="Bác sĩ phụ trách" v={patient.doctorInCharge || "—"} />
            <Info k="Ghi chú" v={patient.note || "—"} />
          </div>
        </Panel>
      </div>

      {can.reissuePatientCredential(user) && (
        <Panel
          title="Tài khoản bệnh nhân"
          action={<Button onClick={reissue}>Cấp lại mật khẩu</Button>}
        >
          <p className="muted">
            Mật khẩu tạm mới chỉ hiển thị một lần và buộc bệnh nhân đổi ở lần
            đăng nhập tiếp theo.
          </p>
        </Panel>
      )}

      {/* Thu hồi hồ sơ là thao tác lâm sàng dành cho Bác sĩ. */}
      {can.voidPatient(user) && (
        <Panel title="Thu hồi hồ sơ" className="danger-zone">
          <p>
            Chỉ dùng khi hồ sơ nhập sai hoặc trùng. Hành động sẽ void lượt khám,
            ảnh, kết quả AI và đơn thuốc theo quy tắc backend.
          </p>
          <Button kind="danger" onClick={() => setVoiding(true)}>
            Void hồ sơ
          </Button>
        </Panel>
      )}

      {cred && (
        <Modal
          title="Thông tin đăng nhập mới"
          onClose={() => setCred(null)}
          footer={
            <Button kind="primary" onClick={() => setCred(null)}>
              Đã lưu
            </Button>
          }
        >
          <div className="credential">
            <div>
              Đăng nhập: <code>{cred.loginId}</code>
            </div>
            <div>
              Mật khẩu tạm: <code>{cred.tempPassword}</code>
            </div>
            <p>{cred.note}</p>
          </div>
        </Modal>
      )}
      {voiding && (
        <ConfirmDialog
          title="Thu hồi hồ sơ bệnh nhân"
          message={`Hồ sơ ${patient.code} — ${patient.fullName} sẽ bị thu hồi cùng chuỗi lâm sàng liên quan.`}
          requireReason
          danger
          confirmText="Void hồ sơ"
          onClose={() => setVoiding(false)}
          onConfirm={doVoid}
        />
      )}
    </>
  );
}

function VisitsTab({ patientId }: { patientId: number }) {
  const data = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const list = useAsync(
    () => data.visits.list({ patientId, page: 1, pageSize: 100 }),
    [patientId],
  );

  return (
    <Panel
      title="Lượt khám"
      action={
        can.createVisit(user) ? (
          <ActionLink to="/reception/visits/new">
            <Button kind="primary">
              <Icon name="plus" />
              Tạo lượt khám
            </Button>
          </ActionLink>
        ) : undefined
      }
    >
      <LoadState
        loading={list.loading}
        error={list.error}
        empty={!list.data?.items.length}
        onRetry={list.reload}
      >
        <DataTable
          headers={[
            "Mã",
            "Ngày khám",
            "Bác sĩ",
            "Ảnh",
            "Chờ duyệt",
            "Kết luận",
            "Chuyển tuyến",
            "Trạng thái",
            "Thao tác",
          ]}
        >
          {list.data?.items.map((v) => (
            <tr key={v.id}>
              <td className="mono">#{v.id}</td>
              <td className="mono">{fmtDate(v.visitDate, true)}</td>
              <td>{v.doctorName || "Chưa phân công"}</td>
              <td className="mono">{v.imageCount}</td>
              <td className="mono">{v.pendingReviewCount}</td>
              <td className="wrap-text">{v.conclusion || "—"}</td>
              <td>
                {v.referral == null ? "—" : label(referralTypes, v.referral)}
              </td>
              <td>
                <StatusBadge
                  text={label(visitStatuses, v.status)}
                  kind={v.status === 1 ? "ok" : "watch"}
                />
              </td>
              <td>
                <Button onClick={() => navigate(`/reports/visit/${v.id}`)}>
                  Báo cáo
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
      </LoadState>
    </Panel>
  );
}

function CreateVisitModal({
  doctors,
  onClose,
  onSave,
}: {
  doctors: DoctorDto[];
  onClose: () => void;
  onSave: (id?: number) => void;
}) {
  const [doctor, setDoctor] = useState("");
  return (
    <Modal
      title="Tạo lượt khám"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            kind="primary"
            onClick={() => onSave(doctor ? Number(doctor) : undefined)}
          >
            Tạo lượt khám
          </Button>
        </>
      }
    >
      <Field labelText="Bác sĩ phụ trách">
        <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
          <option value="">Tự động theo người tạo</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName} · {d.licenseNo || "—"}
            </option>
          ))}
        </select>
      </Field>
    </Modal>
  );
}

function CloseVisitModal({
  visit,
  onClose,
  onSave,
}: {
  visit: VisitDto;
  onClose: () => void;
  onSave: (b: {
    conclusion: string;
    referral: number;
    recheckMonths: number | null;
  }) => void;
}) {
  const [conclusion, setConclusion] = useState("");
  const [referral, setReferral] = useState(0);
  const [months, setMonths] = useState("");
  return (
    <Modal
      title={`Đóng lượt khám #${visit.id}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            kind="primary"
            disabled={!conclusion.trim() || visit.pendingReviewCount > 0}
            onClick={() =>
              onSave({
                conclusion,
                referral,
                recheckMonths: months ? Number(months) : null,
              })
            }
          >
            Đóng lượt khám
          </Button>
        </>
      }
    >
      <Field labelText="Kết luận lâm sàng" required>
        <textarea
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
        />
      </Field>
      <div className="form-row">
        <Field labelText="Chuyển tuyến">
          <select
            value={referral}
            onChange={(e) => setReferral(Number(e.target.value))}
          >
            {referralTypes.map((x, i) => (
              <option key={i} value={i}>
                {x}
              </option>
            ))}
          </select>
        </Field>
        <Field
          labelText="Tái khám sau (tháng)"
          help="Để trống để backend suy theo mức DR đã xác nhận."
        >
          <input
            type="number"
            min="1"
            max="60"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </Field>
      </div>
      {visit.pendingReviewCount > 0 && (
        <div className="state error">
          Còn {visit.pendingReviewCount} kết quả AI chưa được bác sĩ xác nhận.
        </div>
      )}
    </Modal>
  );
}

function ImagesTab({ patientId }: { patientId: number }) {
  const data = useData();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const list = useAsync(async () => {
    const images = await data.images.list({ patientId });
    return Promise.all(
      images.map(async (img) => {
        try {
          const all = await data.diagnoses.byImage(img.id);
          return { ...img, latestDiagnosis: all[0] || null };
        } catch {
          return img;
        }
      }),
    );
  }, [patientId]);
  const [quality, setQuality] = useState<FundusImageDto | null>(null);
  const [voiding, setVoiding] = useState<FundusImageDto | null>(null);
  const [running, setRunning] = useState<number | null>(null);

  const run = async (img: FundusImageDto) => {
    setRunning(img.id);
    try {
      const d = await data.diagnoses.run(img.id);
      toast.push("AI đã hoàn tất suy luận.", "success");
      navigate(`/fundus/${img.id}?diagnosis=${d.id}`);
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setRunning(null);
    }
  };
  const setQ = async (status: number, note: string) => {
    if (!quality) return;
    await data.images.quality(quality.id, status, note, quality.rowVersion);
    toast.push("Đã cập nhật chất lượng ảnh.", "success");
    setQuality(null);
    list.reload();
  };
  const voidImg = async (reason: string) => {
    if (!voiding) return;
    try {
      await data.images.void(voiding.id, reason, voiding.rowVersion);
      toast.push("Đã thu hồi ảnh và kết quả liên quan.", "success");
      setVoiding(null);
      list.reload();
    } catch (e) {
      toast.push((e as Error).message, "error");
    }
  };

  return (
    <>
      <Panel
        title="Ảnh đáy mắt"
        action={
          /* Nạp ảnh mới gắn với LƯỢT KHÁM — thực hiện ở trang lượt khám của
             bác sĩ. Ở trang bệnh nhân chỉ xem lại ảnh và kết quả AI đã có. */
          undefined
        }
      >
        <LoadState
          loading={list.loading}
          error={list.error}
          empty={!list.data?.length}
          onRetry={list.reload}
        >
          <DataTable
            headers={[
              "Ảnh",
              "Mắt",
              "Lượt khám",
              "Chất lượng",
              "AI gần nhất",
              "Tin cậy",
              "Bất đồng",
              "Xác nhận",
              "Ngày nạp",
              "Thao tác",
            ]}
          >
            {list.data?.map((img) => (
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
                  <div className="mono" style={{ marginTop: 4 }}>#{img.id}</div>
                </td>
                <td>
                  <EyeBadge eye={img.eye} />
                </td>
                <td className="mono">
                  {img.visitId ? `#${img.visitId}` : "—"}
                </td>
                <td>
                  <StatusBadge
                    text={label(qualityStatuses, img.qualityStatus)}
                    kind={
                      img.qualityStatus === 1
                        ? "ok"
                        : img.qualityStatus === 2
                          ? "alert"
                          : "watch"
                    }
                  />
                </td>
                <td>
                  <GradeBadge grade={img.latestDiagnosis?.drGrade} />
                </td>
                <td>
                  {img.latestDiagnosis ? (
                    <Meter value={img.latestDiagnosis.confidence} />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {img.latestDiagnosis ? (
                    <Meter
                      value={img.latestDiagnosis.disagreement}
                      kind="defer"
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {img.latestDiagnosis ? (
                    <StatusBadge
                      text={
                        img.latestDiagnosis.isConfirmed
                          ? "Đã xác nhận"
                          : "Chưa xác nhận"
                      }
                      kind={img.latestDiagnosis.isConfirmed ? "ok" : "defer"}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="mono">{fmtDate(img.createdAt, true)}</td>
                <td>
                  <div className="actions">
                    {can.manageImages(user) && (
                      <Button onClick={() => setQuality(img)}>
                        Chất lượng
                      </Button>
                    )}
                    <Button
                      disabled={img.qualityStatus !== 1 || running === img.id}
                      busy={running === img.id}
                      onClick={() =>
                        img.latestDiagnosis
                          ? navigate(
                              `/fundus/${img.id}?diagnosis=${img.latestDiagnosis.id}`,
                            )
                          : run(img)
                      }
                    >
                      {img.latestDiagnosis ? "Xem" : "Chạy AI"}
                    </Button>
                    {/* Void ảnh: Bác sĩ hoặc Admin. */}
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
        </LoadState>
      </Panel>
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
        <select
          value={status}
          onChange={(e) => setStatus(Number(e.target.value))}
        >
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

function PrescriptionsTab({ patientId }: { patientId: number }) {
  const data = useData();
  const { user } = useAuth();
  const toast = useToast();
  const list = useAsync(
    () => data.prescriptions.list({ patientId, page: 1, pageSize: 100 }),
    [patientId],
  );
  const adherence = useAsync(
    () => data.prescriptions.adherence(patientId),
    [patientId],
  );
  const [editor, setEditor] = useState<PrescriptionDto | "new" | null>(null);
  const [voiding, setVoiding] = useState<PrescriptionDto | null>(null);

  const voidRx = async (reason: string) => {
    if (!voiding) return;
    try {
      await data.prescriptions.void(voiding.id, reason, voiding.rowVersion);
      toast.push("Đã void đơn thuốc.", "success");
      setVoiding(null);
      list.reload();
    } catch (e) {
      toast.push((e as Error).message, "error");
    }
  };

  return (
    <>
      <div className="grid2">
        <Panel title="Tuân thủ 30 ngày">
          <LoadState
            loading={adherence.loading}
            error={adherence.error}
            empty={!adherence.data}
            onRetry={adherence.reload}
          >
            {adherence.data && (
              <>
                <div className="stats compact">
                  <div className="stat">
                    <span>Đã tới hạn</span>
                    <b className="mono">{adherence.data.total}</b>
                  </div>
                  <div className="stat">
                    <span>Đã uống</span>
                    <b className="mono">{adherence.data.taken}</b>
                  </div>
                  <div className="stat">
                    <span>Bỏ lỡ</span>
                    <b className="mono">{adherence.data.missed}</b>
                  </div>
                  <div className="stat">
                    <span>Tuân thủ</span>
                    <b className="mono">{adherence.data.rate}%</b>
                  </div>
                </div>
                <p className="help">{adherence.data.note}</p>
              </>
            )}
          </LoadState>
        </Panel>
        <Panel title="Kê đơn">
          <p className="muted">
            Mỗi dòng thuốc gồm tên, liều, số lần/ngày, số ngày và hướng dẫn.
          </p>
          {/* Tạo đơn thuốc mới gắn với LƯỢT KHÁM — thực hiện ở trang lượt khám
              của bác sĩ. Tại đây chỉ xem lại và SỬA đơn đã có (nút Sửa bên dưới). */}
          <p className="help">
            Kê đơn mới được thực hiện trong lượt khám. Tại đây có thể xem và sửa
            các đơn thuốc đã có.
          </p>
        </Panel>
      </div>
      <Panel title="Lịch sử đơn thuốc">
        <LoadState
          loading={list.loading}
          error={list.error}
          empty={!list.data?.items.length}
          onRetry={list.reload}
        >
          <DataTable
            headers={[
              "Mã đơn",
              "Ngày kê",
              "Bác sĩ",
              "Lượt khám",
              "Thuốc",
              "Ghi chú",
              "Thao tác",
            ]}
          >
            {list.data?.items.map((p) => (
              <tr key={p.id}>
                <td className="mono">#{p.id}</td>
                <td className="mono">{fmtDate(p.issuedAt, true)}</td>
                <td>{p.doctorName}</td>
                <td className="mono">{p.visitId ? `#${p.visitId}` : "—"}</td>
                <td className="wrap-text">
                  {p.items
                    .map(
                      (x) =>
                        `${x.drugName} ${x.dose} · ${x.timesPerDay} lần/ngày · ${x.durationDays} ngày`,
                    )
                    .join("; ")}
                </td>
                <td className="wrap-text">{p.note || "—"}</td>
                <td>
                  <div className="actions">
                    {can.prescribe(user) && (
                      <Button onClick={() => setEditor(p)}>Sửa</Button>
                    )}
                    {/* Void đơn thuốc: CHỈ Bác sĩ. */}
                    {can.voidPrescription(user) && (
                      <Button kind="danger" onClick={() => setVoiding(p)}>
                        Void
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </LoadState>
      </Panel>
      {editor && (
        <PrescriptionEditor
          patientId={patientId}
          value={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            list.reload();
          }}
        />
      )}
      {voiding && (
        <ConfirmDialog
          title="Void đơn thuốc"
          message={`Thu hồi đơn #${voiding.id}. Nhật ký uống thuốc đã xác nhận vẫn được giữ lại.`}
          requireReason
          danger
          onClose={() => setVoiding(null)}
          onConfirm={voidRx}
        />
      )}
    </>
  );
}

function PrescriptionEditor({
  patientId,
  value,
  onClose,
  onSaved,
}: {
  patientId: number;
  value: PrescriptionDto | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const data = useData();
  const toast = useToast();
  const isNew = value === "new";
  const [note, setNote] = useState(isNew ? "" : value.note || "");
  const [items, setItems] = useState<PrescriptionItemDto[]>(
    isNew
      ? [
          {
            drugName: "",
            dose: "",
            timesPerDay: 1,
            durationDays: 30,
            instruction: "",
          },
        ]
      : value.items.map((x) => ({ ...x })),
  );
  const [busy, setBusy] = useState(false);
  const patch = (i: number, k: keyof PrescriptionItemDto, v: unknown) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const visitId = value !== "new" ? value.visitId ?? null : null;
  const save = async () => {
    if (
      !items.length ||
      items.some((x) => !x.drugName.trim() || !x.dose.trim())
    ) {
      toast.push("Tên thuốc và liều là bắt buộc.", "error");
      return;
    }
    setBusy(true);
    try {
      // Khi TẠO mới: bỏ id (chưa có, để backend sinh).
      // Khi SỬA: GIỮ id của từng dòng thuốc — backend cần PrescriptionItem.Id
      // để biết dòng nào cập nhật, dòng nào thêm mới (id rỗng), dòng nào đã xoá.
      const baseBody = {
        patientId,
        visitId,
        note: note || null,
        items: isNew
          ? items.map(({ id, ...x }) => x)
          : items.map((x) => ({ ...x })),
      };
      if (isNew) {
        await data.prescriptions.create(baseBody);
      } else {
        await data.prescriptions.update(value.id, {
          ...baseBody,
          rowVersion: value.rowVersion,
        });
      }
      toast.push("Đã lưu đơn thuốc.", "success");
      onSaved();
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={isNew ? "Tạo đơn thuốc" : `Sửa đơn #${value.id}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button kind="primary" busy={busy} onClick={save}>
            Lưu đơn
          </Button>
        </>
      }
    >
      <DataTable
        headers={["Tên thuốc", "Liều", "Lần/ngày", "Số ngày", "Hướng dẫn", ""]}
      >
        {items.map((x, i) => (
          <tr key={i}>
            <td>
              <input
                value={x.drugName}
                onChange={(e) => patch(i, "drugName", e.target.value)}
              />
            </td>
            <td>
              <input
                value={x.dose}
                onChange={(e) => patch(i, "dose", e.target.value)}
              />
            </td>
            <td>
              <input
                type="number"
                min="1"
                max="6"
                value={x.timesPerDay}
                onChange={(e) =>
                  patch(i, "timesPerDay", Number(e.target.value))
                }
              />
            </td>
            <td>
              <input
                type="number"
                min="1"
                max="365"
                value={x.durationDays}
                onChange={(e) =>
                  patch(i, "durationDays", Number(e.target.value))
                }
              />
            </td>
            <td>
              <input
                value={x.instruction || ""}
                onChange={(e) => patch(i, "instruction", e.target.value)}
              />
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
          setItems((x) => [
            ...x,
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
    </Modal>
  );
}

function MonitoringTab({ patientId }: { patientId: number }) {
  const data = useData();
  const [type, setType] = useState("");
  const metrics = useAsync(
    () => data.monitoring.metrics({ patientId, type, size: 100 }),
    [patientId, type],
  );
  const summary = useAsync(
    () => data.monitoring.summary(patientId),
    [patientId],
  );
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
            headers={[
              "Ngày",
              "Loại",
              "Giá trị",
              "Bối cảnh",
              "Đánh giá",
              "Ghi chú",
            ]}
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
