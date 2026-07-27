import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAsync } from "@/lib/hooks";
import {
  PageHeader,
  Panel,
  Button,
  LoadState,
  DataTable,
  GradeBadge,
  EyeBadge,
  StatusBadge,
  Icon,
} from "@/components/ui";
import { fmtDate, pct, num } from "@/lib/format";
import { diabetesTypes, genders, referralTypes, label } from "@/lib/enums";
import type { VisitReport } from "@/types/api";

const vi = {
  patient: "Thông tin bệnh nhân",
  visit: "Lượt khám và kết luận",
  findings: "Kết quả xác nhận",
  prescriptions: "Đơn thuốc",
  disclaimer: "Lưu ý lâm sàng",
};
const en = {
  patient: "Patient information",
  visit: "Visit and conclusion",
  findings: "Confirmed findings",
  prescriptions: "Prescriptions",
  disclaimer: "Clinical notice",
};

export function VisitReportPage({ visitId }: { visitId: number }) {
  const ctx = useData();
  const data = useAsync<VisitReport>(
    () => ctx.exports.visitReport(visitId),
    [visitId],
  );
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [sections, setSections] = useState({
    patient: true,
    visit: true,
    findings: true,
    prescriptions: true,
    disclaimer: true,
  });
  const labels = language === "vi" ? vi : en;
  const toggle = (key: keyof typeof sections) =>
    setSections((x) => ({ ...x, [key]: !x[key] }));
  return (
    <>
      <PageHeader
        title={`Báo cáo lượt khám #${visitId}`}
        subtitle="Dữ liệu lấy trực tiếp từ GET /api/export/visit-report/{visitId}; frontend chỉ dựng bản xem trước và lệnh in PDF."
        actions={
          <Button kind="primary" onClick={() => window.print()}>
            <Icon name="download" />
            Tạo PDF / In
          </Button>
        }
      />
      <div className="report-layout">
        <Panel title="Thiết lập báo cáo">
          <label className="field">
            <span>Ngôn ngữ</span>
            <select
              value={language}
              onChange={(e: any) => setLanguage(e.target.value)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
          <div className="stack" style={{ marginTop: 12 }}>
            {(Object.keys(sections) as (keyof typeof sections)[]).map((k) => (
              <label className="checkbox" key={k}>
                <input
                  type="checkbox"
                  checked={sections[k]}
                  onChange={() => toggle(k)}
                />
                {labels[k]}
              </label>
            ))}
          </div>
          <p className="help">
            Chọn “Save as PDF” trong hộp thoại in của trình duyệt để lưu tệp.
          </p>
        </Panel>
        <LoadState
          loading={data.loading}
          error={data.error}
          empty={!data.data}
          onRetry={data.reload}
        >
          {data.data && (
            <article className="report-preview">
              <header className="report-header">
                <div>
                  <h1>{data.data.clinic.name}</h1>
                  <p>{data.data.clinic.subtitle}</p>
                </div>
                <div className="mono">
                  #{visitId}
                  <br />
                  {fmtDate(data.data.generatedAt, true)}
                </div>
              </header>
              {sections.patient && (
                <ReportSection title={labels.patient}>
                  <div className="detail-grid">
                    <Info k="Mã bệnh nhân" v={data.data.patient.code} />
                    <Info k="Họ tên" v={data.data.patient.fullName} />
                    <Info
                      k="Ngày sinh"
                      v={fmtDate(data.data.patient.dateOfBirth)}
                    />
                    <Info
                      k="Giới tính"
                      v={label(genders, data.data.patient.gender)}
                    />
                    <Info k="Số điện thoại" v={data.data.patient.phone} />
                    <Info
                      k="Loại ĐTĐ"
                      v={label(diabetesTypes, data.data.patient.diabetesType)}
                    />
                    <Info
                      k="Thời gian mắc"
                      v={
                        data.data.patient.diabetesDurationYears == null
                          ? "—"
                          : `${data.data.patient.diabetesDurationYears} năm`
                      }
                    />
                  </div>
                </ReportSection>
              )}
              {sections.visit && (
                <ReportSection title={labels.visit}>
                  <div className="detail-grid">
                    <Info
                      k="Ngày khám"
                      v={fmtDate(data.data.visit.visitDate, true)}
                    />
                    <Info k="Bác sĩ" v={data.data.visit.doctorName} />
                    <Info k="Số chứng chỉ" v={data.data.visit.doctorLicense} />
                    <Info
                      k="Trạng thái"
                      v={data.data.visit.status === 1 ? "Đã đóng" : "Đang khám"}
                    />
                    <Info
                      k="Chuyển tuyến"
                      v={label(referralTypes, data.data.visit.referral)}
                    />
                    <Info
                      k="Tái khám"
                      v={
                        data.data.visit.recheckMonths == null
                          ? "—"
                          : `${data.data.visit.recheckMonths} tháng`
                      }
                    />
                    <Info
                      k="Đóng lúc"
                      v={fmtDate(data.data.visit.closedAt, true)}
                    />
                  </div>
                  <div className="report-conclusion">
                    <b>Kết luận</b>
                    <p>{data.data.visit.conclusion || "—"}</p>
                  </div>
                </ReportSection>
              )}
              {sections.findings && (
                <ReportSection title={labels.findings}>
                  {data.data.findings.length ? (
                    <DataTable
                      headers={[
                        "Mắt",
                        "Phân độ cuối",
                        "AI đề xuất",
                        "Tin cậy",
                        "Bất đồng",
                        "Model",
                        "Xác nhận bởi",
                      ]}
                    >
                      {data.data.findings.map((f, i) => (
                        <tr key={`${f.imageId}-${i}`}>
                          <td>
                            <EyeBadge eye={f.eye} />
                          </td>
                          <td>
                            <GradeBadge grade={f.finalGrade} />
                          </td>
                          <td>
                            <GradeBadge grade={f.ai.grade} />
                            {f.ai.wasOverridden && (
                              <StatusBadge text="Đã ghi đè" kind="defer" />
                            )}
                          </td>
                          <td className="mono">{pct(f.ai.confidence)}</td>
                          <td className="mono">{num(f.ai.disagreement, 3)}</td>
                          <td className="mono">{f.ai.model || "—"}</td>
                          <td>
                            {f.confirmedBy}
                            <div className="mono faint">
                              {fmtDate(f.createdAt, true)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </DataTable>
                  ) : (
                    <p>Chưa có kết quả được bác sĩ xác nhận.</p>
                  )}
                </ReportSection>
              )}
              {sections.prescriptions && (
                <ReportSection title={labels.prescriptions}>
                  {data.data.prescriptions.length ? (
                    data.data.prescriptions.map((p, i) => (
                      <div className="report-rx" key={`${p.issuedAt}-${i}`}>
                        <div className="split">
                          <b>{fmtDate(p.issuedAt, true)}</b>
                          <span>{p.note || ""}</span>
                        </div>
                        <ul>
                          {p.items.map((x, j) => (
                            <li key={j}>
                              <b>{x.drugName}</b> — {x.dose}, {x.timesPerDay}{" "}
                              lần/ngày trong {x.durationDays} ngày
                              {x.instruction ? ` · ${x.instruction}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  ) : (
                    <p>Không có đơn thuốc trong lượt khám này.</p>
                  )}
                </ReportSection>
              )}
              {sections.disclaimer && (
                <footer className="report-disclaimer">
                  {data.data.disclaimer}
                </footer>
              )}
            </article>
          )}
        </LoadState>
      </div>
    </>
  );
}
function ReportSection({ title, children }: { title: string; children?: any }) {
  return (
    <section className="report-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Info({ k, v }: { k: string; v: any }) {
  return (
    <div className="detail-item">
      <small>{k}</small>
      <strong>{v ?? "—"}</strong>
    </div>
  );
}
