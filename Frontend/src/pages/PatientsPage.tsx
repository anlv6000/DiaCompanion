import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { LineChart } from "lucide-react";
import { useData } from "@/contexts/DataContext";
import { DataState } from "@/components/clinical";
import { Button, Field, Input, Panel, PanelHeader, Select } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";

export function PatientsPage() {
  const { patients, loading, error, loadPatients } = useData();
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
      <h1 className="font-serif text-title text-ink">Bệnh nhân</h1>

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
          <Button type="submit" variant="primary">
            Tìm
          </Button>
        </form>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Danh sách"
          right={
            <span className="text-meta text-ink-faint tabular-nums">
              {patients ? `${patients.total} bệnh nhân` : ""}
            </span>
          }
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
                <th>Mã</th>
                <th>Họ tên</th>
                <th>Giới</th>
                <th>Ngày sinh</th>
                <th>Tiểu đường</th>
                <th>Thời gian mắc</th>
                <th></th>
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
                    {p.diabetesDurationYears != null ? `${p.diabetesDurationYears} năm` : "—"}
                  </td>
                  <td className="text-right">
                    <Link to={`/patients/${p.id}`} className="text-primary text-micro hover:underline">
                      Hồ sơ →
                    </Link>
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

export function PatientRecordPage() {
  const { id } = useParams();
  const pid = Number(id);
  const { patientRecord, loading, error, loadPatientRecord } = useData();

  useEffect(() => {
    if (pid) loadPatientRecord(pid);
  }, [pid, loadPatientRecord]);

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
              <Link
                to={`/progression/${pid}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm border border-hairline text-dense text-ink hover:bg-canvas"
              >
                <LineChart size={14} />
                Xem diễn tiến
              </Link>
            </div>

            <Panel className="p-4 grid grid-cols-4 gap-4 text-dense">
              <Info label="Giới tính" value={patientRecord.patient.gender ?? "—"} />
              <Info label="Ngày sinh" value={fmtDate(patientRecord.patient.dateOfBirth)} />
              <Info label="Loại tiểu đường" value={patientRecord.patient.diabetesType ?? "—"} />
              <Info
                label="Thời gian mắc"
                value={
                  patientRecord.patient.diabetesDurationYears != null
                    ? `${patientRecord.patient.diabetesDurationYears} năm`
                    : "—"
                }
              />
              <Info label="SĐT" value={patientRecord.patient.phone ?? "—"} />
              <Info label="Địa chỉ" value={patientRecord.patient.address ?? "—"} />
            </Panel>

            <Panel className="overflow-hidden">
              <PanelHeader title="Lịch sử khám" />
              {patientRecord.visits.length === 0 ? (
                <div className="p-6 text-center text-ink-faint text-dense">Chưa có lượt khám.</div>
              ) : (
                <table className="w-full text-dense">
                  <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
                    <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                      <th>Ngày khám</th>
                      <th>Trạng thái</th>
                      <th>Kết luận</th>
                      <th>Chuyển tuyến</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientRecord.visits.map((v) => (
                      <tr key={v.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                        <td className="tabular-nums">{fmtDate(v.visitDate)}</td>
                        <td className="text-ink-muted">{v.status}</td>
                        <td className="text-ink-muted">{v.conclusion ?? "—"}</td>
                        <td className="text-ink-muted">{v.referral ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </>
        )}
      </DataState>
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
