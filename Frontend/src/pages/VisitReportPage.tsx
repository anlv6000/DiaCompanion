import { useEffect, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAsync } from "@/lib/hooks";
import {
  PageHeader,
  Panel,
  Button,
  LoadState,
  GradeBadge,
  StatusBadge,
  Icon,
} from "@/components/ui";
import { ProtectedImage } from "@/components/ProtectedImage";
import { fmtDate, pct, num } from "@/lib/format";
import {
  diabetesTypes,
  genders,
  referralTypes,
  metricContexts,
  label,
} from "@/lib/enums";
import type {
  VisitReport,
  VisitReportFinding,
  VisitReportImage,
} from "@/types/api";

const vi = {
  patient: "Hồ sơ bệnh án",
  visit: "Lượt khám",
  findings: "Ảnh đáy mắt",
  metrics: "Chỉ số",
  prescriptions: "Đơn thuốc",
  conclusion: "Kết luận",
  feedback: "Phản hồi bệnh nhân",
  disclaimer: "Lưu ý lâm sàng",
};

const en = {
  patient: "Medical record",
  visit: "Visit",
  findings: "Fundus images",
  metrics: "Health metrics",
  prescriptions: "Prescriptions",
  conclusion: "Conclusion",
  feedback: "Patient feedback",
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
    metrics: true,
    prescriptions: true,
    conclusion: true,
    feedback: true,
    disclaimer: true,
  });

  const labels = language === "vi" ? vi : en;
  const toggle = (key: keyof typeof sections) =>
    setSections((x) => ({ ...x, [key]: !x[key] }));

  const report = data.data;

  // Tương thích cả API cũ và API mới.
  // API cũ có thể chưa trả images / healthMetrics, nên tuyệt đối không đọc
  // .length hoặc property con trực tiếp từ undefined.
  const findings: VisitReportFinding[] = report?.findings ?? [];
  const images: VisitReportImage[] =
    report?.images ??
    findings.map(
      (f: any) =>
        ({
          imageId: f.imageId,
          eye: f.eye,
          qualityStatus: f.qualityStatus ?? 0,
          qualityStatusLabel: f.qualityStatusLabel ?? "Chưa có dữ liệu",
          qualityNote: f.qualityNote ?? null,
        }) as VisitReportImage,
    );
  const prescriptions = report?.prescriptions ?? [];
  const healthMetrics = report?.healthMetrics ?? {
    glucose: null,
    hba1c: null,
    bloodPressure: null,
  };

  return (
    <>
      <PageHeader
        title={`Báo cáo lượt khám #${visitId}`}
        subtitle="Hồ sơ bệnh án của một lượt khám đã hoàn tất, gồm ảnh đáy mắt, kết quả AI, xác nhận bác sĩ, chỉ số, đơn thuốc và phản hồi bệnh nhân."
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
          empty={!report}
          onRetry={data.reload}
        >
          {report && (
            <article className="report-preview medical-report">
              <header className="report-header medical-report-header">
                <div>
                  <div className="report-clinic-name">{report.clinic.name}</div>
                  <h1>HỒ SƠ BỆNH ÁN</h1>
                  <p>{report.clinic.subtitle}</p>
                </div>
                <div className="mono report-meta">
                  VISIT-{report.visit.id}
                  <br />
                  Xuất: {fmtDate(report.generatedAt, true)}
                </div>
              </header>

              {sections.patient && (
                <ReportSection title={labels.patient}>
                  <div className="detail-grid report-detail-grid">
                    <Info k="Mã bệnh nhân" v={report.patient.code} />
                    <Info k="Họ tên" v={report.patient.fullName} />
                    <Info k="Ngày sinh" v={fmtDate(report.patient.dateOfBirth)} />
                    <Info k="Giới tính" v={label(genders, report.patient.gender)} />
                    <Info
                      k="Loại ĐTĐ"
                      v={label(diabetesTypes, report.patient.diabetesType)}
                    />
                    <Info
                      k="Thời gian mắc"
                      v={
                        report.patient.diabetesDurationYears == null
                          ? "—"
                          : `${report.patient.diabetesDurationYears} năm`
                      }
                    />
                    <Info k="Số điện thoại" v={report.patient.phone} />
                  </div>
                </ReportSection>
              )}

              {sections.visit && (
                <ReportSection title={labels.visit}>
                  <div className="detail-grid report-detail-grid">
                    <Info k="Mã lượt" v={`#${report.visit.id}`} />
                    <Info k="Ngày khám" v={fmtDate(report.visit.visitDate, true)} />
                    <Info k="Bác sĩ" v={report.visit.doctorName} />
                    <Info k="Số chứng chỉ" v={report.visit.doctorLicense} />
                    <Info
                      k="Trạng thái"
                      v={report.visit.status === 1 ? "Đã đóng" : "Đang khám"}
                    />
                    <Info k="Đóng lúc" v={fmtDate(report.visit.closedAt, true)} />
                  </div>
                </ReportSection>
              )}

              {sections.findings && (
                <ReportSection title={labels.findings}>
                  {images.length ? (
                    <div className="report-eye-list">
                      {images.map((image) => (
                        <RetinalImageCard
                          key={image.imageId}
                          image={image}
                          finding={findings.find(
                            (f) => f.imageId === image.imageId,
                          )}
                        />
                      ))}
                    </div>
                  ) : (
                    <p>Không có ảnh đáy mắt trong lượt khám này.</p>
                  )}
                </ReportSection>
              )}

              {sections.metrics && (
                <ReportSection title={labels.metrics}>
                  <div className="report-metric-grid">
                    <MetricCard
                      title="Glucose"
                      value={
                        healthMetrics.glucose
                          ? `${num(healthMetrics.glucose.value)} ${healthMetrics.glucose.unit}`
                          : "Chưa ghi nhận"
                      }
                      detail={
                        healthMetrics.glucose
                          ? `${label(metricContexts, healthMetrics.glucose.context)} · ${fmtDate(healthMetrics.glucose.recordedAt, true)}`
                          : `Không có chỉ số trong ngày khám ${fmtDate(report.visit.visitDate)}`
                      }
                      abnormal={healthMetrics.glucose?.isAbnormal}
                    />
                    <MetricCard
                      title="HbA1c"
                      value={
                        healthMetrics.hba1c
                          ? `${num(healthMetrics.hba1c.value)} ${healthMetrics.hba1c.unit}`
                          : "Chưa ghi nhận"
                      }
                      detail={
                        healthMetrics.hba1c
                          ? fmtDate(healthMetrics.hba1c.recordedAt, true)
                          : `Không có chỉ số trong ngày khám ${fmtDate(report.visit.visitDate)}`
                      }
                      abnormal={healthMetrics.hba1c?.isAbnormal}
                    />
                    <MetricCard
                      title="Blood Pressure"
                      value={
                        healthMetrics.bloodPressure
                          ? `${num(healthMetrics.bloodPressure.systolic, 0)}/${num(healthMetrics.bloodPressure.diastolic, 0)} ${healthMetrics.bloodPressure.unit}`
                          : "Chưa ghi nhận"
                      }
                      detail={
                        healthMetrics.bloodPressure
                          ? fmtDate(
                              healthMetrics.bloodPressure.recordedAt,
                              true,
                            )
                          : `Không có chỉ số trong ngày khám ${fmtDate(report.visit.visitDate)}`
                      }
                      abnormal={healthMetrics.bloodPressure?.isAbnormal}
                    />
                  </div>
                </ReportSection>
              )}

              {sections.prescriptions && (
                <ReportSection title={labels.prescriptions}>
                  {prescriptions.length ? (
                    prescriptions.map((p, i) => (
                      <div className="report-rx" key={`${p.issuedAt}-${i}`}>
                        <div className="split report-rx-head">
                          <b>Ngày kê: {fmtDate(p.issuedAt, true)}</b>
                          <span>{p.note || ""}</span>
                        </div>
                        <div className="report-prescription-list">
                          {p.items.map((x, j) => (
                            <div className="report-prescription-item" key={j}>
                              <strong>{x.drugName}</strong>
                              <span>{x.dose}</span>
                              <span>{x.timesPerDay} lần/ngày</span>
                              <span>{x.durationDays} ngày</span>
                              {x.instruction && <small>{x.instruction}</small>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p>Không có đơn thuốc trong lượt khám này.</p>
                  )}
                </ReportSection>
              )}

              {sections.conclusion && (
                <ReportSection title={labels.conclusion}>
                  <div className="report-conclusion">
                    <p>{report.visit.conclusion || "Chưa có kết luận."}</p>
                  </div>
                  <div className="detail-grid report-detail-grid report-followup-grid">
                    <Info
                      k="Chuyển tuyến"
                      v={label(referralTypes, report.visit.referral)}
                    />
                    <Info
                      k="Tái khám"
                      v={
                        report.visit.recheckMonths == null
                          ? "—"
                          : `${report.visit.recheckMonths} tháng`
                      }
                    />
                    <Info
                      k="Ngày dự kiến"
                      v={fmtDate(report.visit.recheckDueDate)}
                    />
                  </div>
                </ReportSection>
              )}

              {sections.feedback && (
                <ReportSection title={labels.feedback}>
                  {report.feedback ? (
                    <div className="report-feedback">
                      <div className="report-rating" aria-label={`${report.feedback.rating}/5 sao`}>
                        <strong>{report.feedback.rating}/5 sao</strong>
                        <span>
                          {"★".repeat(report.feedback.rating)}
                          {"☆".repeat(Math.max(0, 5 - report.feedback.rating))}
                        </span>
                      </div>
                      {report.feedback.tags && (
                        <p>
                          <b>Nhãn:</b> {report.feedback.tags}
                        </p>
                      )}
                      <p>{report.feedback.comment || "Không có nhận xét."}</p>
                      <small className="faint">
                        Gửi lúc {fmtDate(report.feedback.createdAt, true)}
                      </small>
                    </div>
                  ) : (
                    <p>Bệnh nhân chưa gửi phản hồi cho lượt khám này.</p>
                  )}
                </ReportSection>
              )}

              {sections.disclaimer && (
                <footer className="report-disclaimer">{report.disclaimer}</footer>
              )}
            </article>
          )}
        </LoadState>
      </div>
    </>
  );
}

function RetinalImageCard({
  image,
  finding,
}: {
  image: VisitReportImage;
  finding?: VisitReportFinding;
}) {
  const eyeName = image.eye === 1 ? "Mắt trái (OS)" : "Mắt phải (OD)";
  const legacyFinding = finding as any;
  const action =
    finding?.action ?? (legacyFinding?.ai?.wasOverridden ? 1 : 0);
  const actionLabel =
    finding?.actionLabel ?? (action === 1 ? "Override" : "Approve");
  const reason =
    finding?.reason ?? legacyFinding?.ai?.overrideReason ?? null;

  return (
    <section className="report-eye-card">
      <h3>{eyeName}</h3>

      <div className="report-image-gallery">
        <div className="report-image-primary">
          <div className="report-image-label">
            <strong>Ảnh gốc</strong>
            <small className="mono">Image #{image.imageId}</small>
          </div>
          <ProtectedImage
            imageId={image.imageId}
            alt={`Ảnh đáy mắt gốc ${eyeName}`}
            className="report-clinical-image report-original-image"
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        <div className="report-image-derived-column">
          <ReportAiImage
            title="Lesion mask"
            diagnosisId={finding?.diagnosisId}
            kind="lesion"
            available={Boolean(finding?.urlImageLesionAfterMedical)}
            alt={`Ảnh lesion ${eyeName}`}
          />
          <ReportAiImage
            title="Vessel / Fractal"
            diagnosisId={finding?.diagnosisId}
            kind="fractal"
            available={Boolean(finding?.urlImageVesselAfterMedical)}
            alt={`Ảnh vessel fractal ${eyeName}`}
          />
        </div>
      </div>

      <div className="report-eye-details">
        <div className="report-subblock">
          <b>Quality</b>
          <div>
            <StatusBadge
              text={image.qualityStatusLabel}
              kind={
                image.qualityStatus === 1
                  ? "ok"
                  : image.qualityStatus === 2
                    ? "alert"
                    : ""
              }
            />
          </div>
          {image.qualityNote && <small>{image.qualityNote}</small>}
        </div>

        {finding ? (
          <>
            <div className="report-eye-summary-grid">
              <div className="report-subblock">
                <b>AI DR</b>
                <div className="report-inline-value">
                  <GradeBadge grade={finding.ai.grade} />
                </div>
                {finding.ai.isDeferred && (
                  <small>
                    AI đánh dấu cần bác sĩ xem xét do bất đồng chéo hoặc thiếu nhánh.
                  </small>
                )}
              </div>

              <div className="report-subblock">
                <b>Lesion</b>
                <div className="report-lesion-grid mono">
                  <span>MA: {finding.lesions.countMA ?? "—"}</span>
                  <span>HE: {finding.lesions.countHE ?? "—"}</span>
                  <span>EX: {finding.lesions.countEX ?? "—"}</span>
                  <span>SE: {finding.lesions.countSE ?? "—"}</span>
                </div>
              </div>

              <div className="report-subblock">
                <b>Fractal</b>
                <div className="mono">FD: {num(finding.fractal, 3)}</div>
              </div>
            </div>

            <div className="report-subblock report-doctor-confirmation">
              <b>Bác sĩ xác nhận</b>
              <div className="report-confirm-row">
                <span>Final Grade:</span>
                <GradeBadge grade={finding.finalGrade} />
              </div>
              <div className="report-confirm-row">
                <span>Action:</span>
                <StatusBadge
                  text={actionLabel}
                  kind={action === 1 ? "defer" : "ok"}
                />
              </div>
              <div className="report-confirm-row report-reason-row">
                <span>Reason:</span>
                <strong>{reason || "—"}</strong>
              </div>
              <small>
                {finding.confirmedBy} · {fmtDate(finding.createdAt, true)}
              </small>
            </div>
          </>
        ) : (
          <div className="report-subblock">
            <b>Kết quả AI / xác nhận</b>
            <p>
              {image.qualityStatus === 2
                ? "Ảnh Ungradable nên không có kết quả AI."
                : "Chưa có kết quả được bác sĩ xác nhận cho ảnh này."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ReportAiImage({
  title,
  diagnosisId,
  kind,
  available,
  alt,
}: {
  title: string;
  diagnosisId?: number;
  kind: "lesion" | "fractal";
  available: boolean;
  alt: string;
}) {
  const data = useData();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    setUrl("");
    setError("");

    if (!diagnosisId || !available) return;

    const loader =
      kind === "lesion"
        ? data.diagnoses.lesionMask(diagnosisId)
        : data.diagnoses.fractalImage(diagnosisId);

    loader
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [available, data.diagnoses, diagnosisId, kind]);

  return (
    <div className="report-image-derived">
      <div className="report-image-label">
        <strong>{title}</strong>
        {diagnosisId ? (
          <small className="mono">AI #{diagnosisId}</small>
        ) : null}
      </div>

      {!diagnosisId || !available ? (
        <div className="report-image-placeholder">Chưa có ảnh</div>
      ) : error ? (
        <div className="report-image-placeholder" title={error}>
          Không tải được ảnh
        </div>
      ) : !url ? (
        <div className="report-image-placeholder">Đang tải…</div>
      ) : (
        <img src={url} alt={alt} className="report-clinical-image" />
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  abnormal,
}: {
  title: string;
  value: string;
  detail: string;
  abnormal?: boolean;
}) {
  return (
    <div className={`report-metric-card ${abnormal ? "is-abnormal" : ""}`}>
      <small>{title}</small>
      <strong>{value}</strong>
      <span className="faint">{detail}</span>
    </div>
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
