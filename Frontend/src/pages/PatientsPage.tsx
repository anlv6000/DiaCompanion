import { useEffect, useState, Fragment, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LineChart, Plus } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { DataState, GradeChip } from "@/components/clinical";
import { Badge, Button, Field, Input, Panel, PanelHeader, Select, cx } from "@/components/ui/primitives";
import { fmtDate, fmtDateTime, pct } from "@/lib/format";
import type { CompleteVisitPayload, PrescriptionItem } from "@/types/models";

// ---------------- list + search ----------------
export function PatientsPage() {
  const { patients, loading, error, loadPatients } = useData();
  const { hasRole } = useAuth();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    loadPatients(q || undefined, type || undefined, 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-title text-ink">Bệnh nhân</h1>
        {hasRole("Admin", "Doctor", "Nurse") && (
          <Link
            to="/patients/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-primary text-white text-dense hover:bg-primary-active"
          >
            <Plus size={14} /> Tạo bệnh nhân
          </Link>
        )}
      </div>

      <Panel className="p-3">
        <form onSubmit={onSearch} className="flex items-end gap-3">
          <div className="flex-1">
            <Field label="Tìm theo tên / mã / SĐT">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="vd: Anh, BN20260001…" />
            </Field>
          </div>
          <div className="w-48">
            <Field label="Loại tiểu đường">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Tất cả</option>
                <option value="Type1">Type 1</option>
                <option value="Type2">Type 2</option>
                <option value="Gestational">Thai kỳ</option>
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="primary">Tìm</Button>
        </form>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Danh sách"
          right={<span className="text-meta text-ink-faint tabular-nums">{patients ? `${patients.total}` : ""}</span>}
        />
        <DataState
          loading={loading.patients}
          error={error.patients}
          empty={patients?.items.length === 0}
          emptyLabel="Không tìm thấy bệnh nhân."
          onRetry={() => loadPatients(q || undefined, type || undefined)}
        >
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Mã</th><th>Họ tên</th><th>Giới</th><th>Ngày sinh</th><th>Tiểu đường</th><th>Mắc</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(patients?.items ?? []).map((p) => (
                <tr key={p.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="font-mono text-ink-muted tabular-nums">{p.code}</td>
                  <td className="text-ink">{p.fullName}</td>
                  <td className="text-ink-muted">{p.gender ?? "—"}</td>
                  <td className="text-ink-muted tabular-nums">{fmtDate(p.dateOfBirth)}</td>
                  <td className="text-ink-muted">{p.diabetesType ?? "—"}</td>
                  <td className="text-ink-muted tabular-nums">
                    {p.diabetesDurationYears != null ? `${p.diabetesDurationYears}n` : "—"}
                  </td>
                  <td className="text-right">
                    <Link to={`/patients/${p.id}`} className="text-primary text-micro hover:underline">Hồ sơ →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Panel>
    </div>
  );
}

// ---------------- record hub (tabs) ----------------
type Tab = "profile" | "visits" | "imaging" | "prescriptions" | "monitoring";

export function PatientRecordPage() {
  const { id } = useParams();
  const pid = Number(id);
  const { patientRecord, loading, error, loadPatientRecord } = useData();
  const [tab, setTab] = useState<Tab>("profile");

  useEffect(() => {
    loadPatientRecord(pid);
  }, [pid, loadPatientRecord]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Hồ sơ" },
    { id: "visits", label: "Lượt khám" },
    { id: "imaging", label: "Ảnh & AI" },
    { id: "prescriptions", label: "Đơn thuốc" },
    { id: "monitoring", label: "Theo dõi" },
  ];

  return (
    <div className="space-y-4">
      <DataState loading={loading.patientRecord} error={error.patientRecord} onRetry={() => loadPatientRecord(pid)}>
        {patientRecord && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-serif text-title text-ink">{patientRecord.patient.fullName}</h1>
                <p className="text-meta text-ink-faint font-mono">{patientRecord.patient.code}</p>
              </div>
              <div className="flex gap-2">
                <Link to={`/patients/${pid}/edit`} className="h-8 px-3 grid place-items-center rounded-sm border border-hairline text-dense text-ink hover:bg-canvas">
                  Sửa hồ sơ
                </Link>
                <Link to={`/progression/${pid}`} className="h-8 px-3 inline-flex items-center gap-1.5 rounded-sm border border-hairline text-dense text-ink hover:bg-canvas">
                  <LineChart size={14} /> Diễn tiến
                </Link>
              </div>
            </div>

            <div className="flex gap-1 border-b border-hairline">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cx(
                    "h-9 px-3 text-dense -mb-px border-b-2",
                    tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-ink-muted hover:text-ink",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "profile" && <ProfileTab />}
            {tab === "visits" && <VisitsTab pid={pid} />}
            {tab === "imaging" && <ImagingTab pid={pid} />}
            {tab === "prescriptions" && <PrescriptionsTab pid={pid} />}
            {tab === "monitoring" && <MonitoringTab pid={pid} />}
          </>
        )}
      </DataState>
    </div>
  );
}

function ProfileTab() {
  const { patientRecord } = useData();
  const p = patientRecord!.patient;
  return (
    <Panel className="p-4 grid grid-cols-4 gap-4 text-dense">
      <Info label="Giới tính" value={p.gender ?? "—"} />
      <Info label="Ngày sinh" value={fmtDate(p.dateOfBirth)} />
      <Info label="Loại tiểu đường" value={p.diabetesType ?? "—"} />
      <Info label="Thời gian mắc" value={p.diabetesDurationYears != null ? `${p.diabetesDurationYears} năm` : "—"} />
      <Info label="SĐT" value={p.phone ?? "—"} />
      <Info label="Địa chỉ" value={p.address ?? "—"} />
    </Panel>
  );
}

function VisitsTab({ pid }: { pid: number }) {
  const { patientRecord, createVisit, completeVisit, loadPatientRecord, loading } = useData();
  const visits = patientRecord?.visits ?? [];
  const [completing, setCompleting] = useState<number | null>(null);
  const [form, setForm] = useState<CompleteVisitPayload>({ conclusion: "", referral: "" });

  async function submitComplete(id: number) {
    await completeVisit(id, form);
    setCompleting(null);
    setForm({ conclusion: "", referral: "" });
    await loadPatientRecord(pid);
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Lượt khám"
        right={
          <Button variant="primary" onClick={() => createVisit({ patientId: pid })} disabled={loading.createVisit}>
            <Plus size={14} /> Tạo lượt khám
          </Button>
        }
      />
      {visits.length === 0 ? (
        <div className="p-6 text-center text-ink-faint text-dense">Chưa có lượt khám.</div>
      ) : (
        <table className="w-full text-dense">
          <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
            <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
              <th>Ngày</th><th>Trạng thái</th><th>Kết luận</th><th>Chuyển tuyến</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <Fragment key={v.id}>
                <tr className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="tabular-nums">{fmtDate(v.visitDate)}</td>
                  <td><Badge tone={v.status === "Completed" ? "ok" : "neutral"}>{v.status}</Badge></td>
                  <td className="text-ink-muted">{v.conclusion ?? "—"}</td>
                  <td className="text-ink-muted">{v.referral ?? "—"}</td>
                  <td className="text-right">
                    {v.status !== "Completed" && (
                      <Button variant="outline" onClick={() => setCompleting(completing === v.id ? null : v.id)}>
                        Nhập kết luận
                      </Button>
                    )}
                  </td>
                </tr>
                {completing === v.id && (
                  <tr key={`c-${v.id}`} className="border-t border-hairline bg-canvas">
                    <td colSpan={5} className="p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Kết luận">
                          <Input value={form.conclusion} onChange={(e) => setForm({ ...form, conclusion: e.target.value })} />
                        </Field>
                        <Field label="Chuyển tuyến">
                          <Input value={form.referral} onChange={(e) => setForm({ ...form, referral: e.target.value })} />
                        </Field>
                      </div>
                      <div className="mt-2">
                        <Button variant="primary" onClick={() => submitComplete(v.id)} disabled={loading.completeVisit}>
                          Đóng lượt khám
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function ImagingTab({ pid }: { pid: number }) {
  const { fundusList, loading, error, loadFundusByPatient, uploadFundus, setQuality } = useData();
  const { patientRecord } = useData();
  const [eye, setEye] = useState("OD");
  const [visitId, setVisitId] = useState<string>("");

  useEffect(() => {
    loadFundusByPatient(pid);
  }, [pid, loadFundusByPatient]);

  async function upload() {
    const vid = visitId ? Number(visitId) : null;
    await uploadFundus({
      patientId: pid,
      visitId: vid,
      eye,
      filePath: `/images/${pid}/${Date.now()}_${eye}.jpg`,
    });
  }

  const visits = patientRecord?.visits ?? [];

  return (
    <div className="space-y-4">
      <Panel className="p-3">
        <div className="flex items-end gap-3">
          <Field label="Mắt">
            <Select value={eye} onChange={(e) => setEye(e.target.value)}>
              <option value="OD">OD (phải)</option>
              <option value="OS">OS (trái)</option>
            </Select>
          </Field>
          <Field label="Gắn lượt khám">
            <Select value={visitId} onChange={(e) => setVisitId(e.target.value)}>
              <option value="">— không —</option>
              {visits.map((v) => (
                <option key={v.id} value={v.id}>#{v.id} · {fmtDate(v.visitDate)}</option>
              ))}
            </Select>
          </Field>
          <Button variant="primary" onClick={upload} disabled={loading.uploadFundus}>
            <Plus size={14} /> Nạp ảnh
          </Button>
        </div>
        <p className="mt-2 text-micro text-ink-faint">
          Demo dùng đường dẫn ảnh giả lập; tích hợp thật thì thay bằng upload file.
        </p>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader title="Ảnh đáy mắt" />
        <DataState loading={loading.fundusList} error={error.fundusList} empty={fundusList?.length === 0}
          emptyLabel="Chưa có ảnh." onRetry={() => loadFundusByPatient(pid)}>
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Ảnh</th><th>Mắt</th><th>Chất lượng</th><th>Tải lúc</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(fundusList ?? []).map((f) => (
                <tr key={f.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="font-mono text-ink-muted tabular-nums">#{f.id}</td>
                  <td className="font-mono">{f.eye}</td>
                  <td>
                    <Select
                      value={f.qualityStatus}
                      onChange={(e) => setQuality(f.id, e.target.value).then(() => loadFundusByPatient(pid))}
                      className="w-32"
                    >
                      <option value="Pending">Chờ duyệt</option>
                      <option value="Gradable">Đạt</option>
                      <option value="Ungradable">Không đạt</option>
                    </Select>
                  </td>
                  <td className="text-micro text-ink-faint tabular-nums">{fmtDateTime(f.uploadedAt)}</td>
                  <td className="text-right">
                    <Link to={`/fundus/${f.id}`} className="text-primary text-micro hover:underline">Xem / chạy AI →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Panel>
    </div>
  );
}

function PrescriptionsTab({ pid }: { pid: number }) {
  const { prescriptions, loading, error, loadPrescriptions, createPrescription } = useData();
  const [note, setNote] = useState("");
  const [items, setItems] = useState<PrescriptionItem[]>([{ drugName: "", dose: "", frequency: "", durationDays: 30 }]);

  useEffect(() => {
    loadPrescriptions(pid);
  }, [pid, loadPrescriptions]);

  function setItem(i: number, patch: Partial<PrescriptionItem>) {
    setItems((s) => s.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  async function submit() {
    const valid = items.filter((i) => i.drugName.trim());
    if (valid.length === 0) return;
    await createPrescription({ patientId: pid, note: note || undefined, items: valid });
    setNote("");
    setItems([{ drugName: "", dose: "", frequency: "", durationDays: 30 }]);
  }

  return (
    <div className="space-y-4">
      <Panel className="p-4 space-y-3">
        <div className="text-sub font-serif text-ink">Kê đơn mới</div>
        <div className="grid grid-cols-4 gap-2 font-semibold mb-2">
          <div>Tên thuốc</div>
          <div>Liều</div>
          <div>Tần suất</div>
          <div>Số ngày</div>
        </div>

        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-4 gap-2">
            <Input
              placeholder="Ví dụ: Metformin"
              value={it.drugName}
              onChange={(e) => setItem(i, { drugName: e.target.value })}
            />
            <Input
              placeholder="Ví dụ: 500 mg"
              value={it.dose}
              onChange={(e) => setItem(i, { dose: e.target.value })}
            />
            <Input
              placeholder="Ví dụ: 2 lần/ngày"
              value={it.frequency}
              onChange={(e) => setItem(i, { frequency: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Ví dụ: 7"
              value={it.durationDays ?? ""}
              onChange={(e) => setItem(i, { durationDays: e.target.value ? Number(e.target.value) : null })}
            />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setItems((s) => [...s, { drugName: "", dose: "", frequency: "", durationDays: 30 }])}>
            + Thêm thuốc
          </Button>
        </div>
        <Field label="Ghi chú đơn">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd: Kiểm soát đường huyết & huyết áp" />
        </Field>
        <Button variant="primary" onClick={submit} disabled={loading.createPrescription}>Lưu đơn</Button>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader title="Lịch sử đơn thuốc" />
        <DataState loading={loading.prescriptions} error={error.prescriptions} empty={prescriptions?.length === 0}
          emptyLabel="Chưa có đơn." onRetry={() => loadPrescriptions(pid)}>
          <ul className="divide-y divide-hairline">
            {(prescriptions ?? []).map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-dense text-ink">Đơn #{p.id} · {fmtDate(p.issuedAt)}</span>
                  <span className="text-micro text-ink-faint">{p.note}</span>
                </div>
                <ul className="mt-1 text-meta text-ink-muted">
                  {p.items.map((it, idx) => (
                    <li key={idx} className="font-mono">
                      • {it.drugName} {it.dose} — {it.frequency} {it.durationDays ? `(${it.durationDays}n)` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </DataState>
      </Panel>
    </div>
  );
}

function MonitoringTab({ pid }: { pid: number }) {
  const { metrics, adherence, symptoms, loading, error, loadMetrics, loadAdherence, loadSymptoms } = useData();

  useEffect(() => {
    loadMetrics(pid);
    loadAdherence(pid);
    loadSymptoms(pid);
  }, [pid, loadMetrics, loadAdherence, loadSymptoms]);

  const latest = (type: string) => {
    const arr = (metrics ?? []).filter((m) => m.metricType === type);
    return arr.length ? arr[arr.length - 1] : null;
  };
  const glucose = latest("Glucose");
  const hba1c = latest("HbA1c");
  const sys = latest("SystolicBP");
  const dia = latest("DiastolicBP");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Metric label="Glucose gần nhất" value={glucose ? `${glucose.value} ${glucose.unit ?? ""}` : "—"} />
        <Metric label="HbA1c gần nhất" value={hba1c ? `${hba1c.value}%` : "—"} />
        <Metric label="Huyết áp" value={sys && dia ? `${sys.value}/${dia.value}` : "—"} />
        <Metric label="Tuân thủ thuốc" value={adherence ? pct(adherence.rate, 0) : "—"} tone="primary" />
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader title="Triệu chứng bệnh nhân báo" />
        <DataState loading={loading.symptoms} error={error.symptoms} empty={symptoms?.length === 0}
          emptyLabel="Chưa có báo cáo triệu chứng.">
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Triệu chứng</th><th>Mức độ</th><th>Khuyến cáo</th><th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {(symptoms ?? []).map((s) => (
                <tr key={s.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="text-ink">{s.description}</td>
                  <td>
                    <Badge tone={s.severity === "High" ? "alert" : s.severity === "Medium" ? "watch" : "neutral"}>
                      {s.severity}
                    </Badge>
                  </td>
                  <td className="text-ink-muted">{s.adviceGiven ?? "—"}</td>
                  <td className="text-micro text-ink-faint tabular-nums">{fmtDateTime(s.reportedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Panel>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-micro text-ink-faint">{label}</div>
      <div className="text-ink">{value}</div>
    </div>
  );
}
function Metric({ label, value, tone }: { label: string; value: string; tone?: "primary" }) {
  return (
    <Panel className="p-4">
      <div className="text-meta text-ink-faint">{label}</div>
      <div className={cx("mt-1 font-mono text-section tabular-nums", tone === "primary" ? "text-primary" : "text-ink")}>{value}</div>
    </Panel>
  );
}
