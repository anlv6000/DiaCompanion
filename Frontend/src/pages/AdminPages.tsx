import { useState, useEffect } from "react";
import { useAsync } from "@/lib/hooks";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  PageHeader,
  Panel,
  Button,
  LoadState,
  DataTable,
  StatusBadge,
  GradeBadge,
  EyeBadge,
  Field,
  Modal,
  ConfirmDialog,
  Icon,
} from "@/components/ui";
import { GradeBars, LineChart } from "@/components/charts";
import { fmtDate, num, pct, downloadText, toCsv } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import type {
  SystemConfigDto,
  ModelVersionDto,
  RegisterModelRequest,
  ThresholdImpactDto,
} from "@/types/api";

/* ---------------- Dashboard ---------------- */
export function DashboardPage() {
  const data = useData();
  const { user } = useAuth();
  const dash = useAsyncDashboard(data);
  const impacts = useAsyncImpacts(data, user?.role);

  return (
    <>
      <PageHeader
        title="Dashboard thống kê"
        subtitle="Các chỉ số lấy trực tiếp từ backend và phiên bản model đang kích hoạt."
      />
      <LoadState
        loading={dash.loading}
        error={dash.error}
        empty={!dash.data}
        onRetry={dash.reload}
      >
        {dash.data && (
          <>
            <div className="stats">
              <Stat k="Bệnh nhân" v={dash.data.totalPatients} />
              <Stat k="Lượt khám tháng" v={dash.data.visitsThisMonth} />
              <Stat k="Chờ triage" v={dash.data.pendingTriage} />
              <Stat k="Defer chờ" v={dash.data.deferredPending} />
              <Stat k="Tỉ lệ defer" v={`${dash.data.deferralRate}%`} />
              <Stat k="Ghi đè" v={`${dash.data.overrideRate}%`} />
            </div>
            <div className="grid2" style={{ marginTop: 12 }}>
              <Panel title="Phân bố mức DR">
                <GradeBars distribution={dash.data.gradeDistribution} />
              </Panel>
              <Panel title="Ngưỡng tin cậy → tỉ lệ defer ước tính">
                <LoadState
                  loading={impacts.loading}
                  error={impacts.error}
                  empty={!impacts.data?.length}
                  emptyText={
                    user?.role === "Admin"
                      ? "Backend chưa có đủ ca để ước tính."
                      : "Chỉ Admin được truy vấn ảnh hưởng ngưỡng."
                  }
                >
                  <LineChart
                    series={[
                      {
                        name: "Tỉ lệ defer dự kiến",
                        points: impacts.data || [],
                      },
                    ]}
                  />
                </LoadState>
              </Panel>
            </div>
            <Panel title="Phiên bản model đang hoạt động">
              <div className="credential">
                <code>{dash.data.activeModel || "Chưa kích hoạt model"}</code>
              </div>
            </Panel>
          </>
        )}
      </LoadState>
    </>
  );
}

function useAsyncDashboard(data: ReturnType<typeof useData>) {
  return useAsync(() => data.admin.dashboard(), []);
}
function useAsyncImpacts(data: ReturnType<typeof useData>, role?: string) {
  return useAsync(async () => {
    if (role !== "Admin") return [] as { x: string; y: number }[];
    const points: { x: string; y: number }[] = [];
    for (const proposed of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      try {
        const x = await data.admin.impact("ai.confidence_threshold", proposed);
        points.push({ x: String(proposed), y: x.projectedRate });
      } catch {
        /* bỏ qua điểm lỗi */
      }
    }
    return points;
  }, [role]);
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="stat">
      <span>{k}</span>
      <b className="mono">{v}</b>
    </div>
  );
}

/* ---------------- Conflicts ---------------- */
export function ConflictsPage() {
  const data = useData();
  const [model, setModel] = useState("");
  const models = useAsync(() => data.admin.models(), []);
  const report = useAsync(
    () => data.exports.conflicts(model ? Number(model) : null),
    [model],
  );

  const download = async () => {
    const blob = await data.exports.conflictsCsv(model ? Number(model) : null);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "disagreement-cases.csv";
    a.click();
  };

  const d = report.data;
  const cases = d?.cases || [];

  return (
    <>
      <PageHeader
        title="Ca người – máy mâu thuẫn"
        subtitle="Tập ca bác sĩ ghi đè dùng để đánh giá cơ chế deferral."
        actions={
          <Button onClick={download}>
            <Icon name="download" />
            Xuất CSV
          </Button>
        }
      />
      <Panel>
        <Field labelText="Phiên bản model" className="inline">
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Tất cả phiên bản</option>
            {models.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      </Panel>
      <LoadState
        loading={report.loading}
        error={report.error}
        empty={!d}
        onRetry={report.reload}
      >
        {d && (
          <>
            <div className="stats">
              <Stat k="Tổng đã duyệt" v={d.summary.totalReviewed} />
              <Stat k="Tổng ghi đè" v={d.summary.totalOverridden} />
              <Stat k="Tỉ lệ ghi đè" v={`${d.summary.overrideRate}%`} />
              <Stat
                k="Trong nhóm defer"
                v={`${d.summary.overrideRateWithinDeferred}%`}
              />
              <Stat
                k="Ngoài nhóm defer"
                v={`${d.summary.overrideRateOutsideDeferred}%`}
              />
              <Stat k="Bất đồng TB" v={num(d.summary.avgDisagreement, 4)} />
            </div>
            <div className="state" style={{ margin: "12px 0" }}>
              {d.summary.interpretation}
            </div>
            <Panel title="Danh sách ca">
              <DataTable
                headers={[
                  "Ca",
                  "Bệnh nhân",
                  "Mắt",
                  "Model",
                  "AI",
                  "Bác sĩ",
                  "Lệch bậc",
                  "Tin cậy",
                  "Bất đồng",
                  "Defer",
                  "Lý do",
                  "Ngày duyệt",
                ]}
              >
                {cases.map((x) => (
                  <tr key={x.aiDiagnosisId}>
                    <td className="mono">#{x.aiDiagnosisId}</td>
                    <td className="mono">{x.patientCode}</td>
                    <td>
                      <EyeBadge eye={x.eye} />
                    </td>
                    <td className="mono">{x.modelVersion}</td>
                    <td>
                      <GradeBadge grade={x.aiGrade} />
                    </td>
                    <td>
                      <GradeBadge grade={x.doctorGrade} />
                    </td>
                    <td className="mono">{x.gradeDistance}</td>
                    <td className="mono">{pct(x.confidence)}</td>
                    <td className="mono">{num(x.disagreement, 3)}</td>
                    <td>
                      {x.wasDeferred ? (
                        <StatusBadge text="Có" kind="defer" />
                      ) : (
                        <StatusBadge text="Không" />
                      )}
                    </td>
                    <td className="wrap-text">{x.reason || "—"}</td>
                    <td className="mono">{fmtDate(x.reviewedAt, true)}</td>
                  </tr>
                ))}
              </DataTable>
            </Panel>
          </>
        )}
      </LoadState>
    </>
  );
}

/* ---------------- Configs ---------------- */
export function ConfigsPage() {
  const data = useData();
  const toast = useToast();
  const list = useAsync(() => data.admin.configs(), []);
  const [edit, setEdit] = useState<SystemConfigDto | null>(null);

  const save = async (key: string, value: string) => {
    await data.admin.updateConfig(key, value, edit!.rowVersion);
    toast.push("Đã cập nhật cấu hình và ghi audit.", "success");
    setEdit(null);
    list.reload();
  };

  return (
    <>
      <PageHeader
        title="Cấu hình hệ thống"
        subtitle="Tham số nghiệp vụ; secret không được lưu ở đây."
      />
      <Panel>
        <LoadState
          loading={list.loading}
          error={list.error}
          empty={!list.data?.length}
          onRetry={list.reload}
        >
          <DataTable
            headers={[
              "Khóa",
              "Giá trị",
              "Kiểu",
              "Miền",
              "Mô tả",
              "Cập nhật",
              "Thao tác",
            ]}
          >
            {list.data?.map((c) => (
              <tr key={c.key}>
                <td className="mono">{c.key}</td>
                <td className="mono">{c.value}</td>
                <td>{c.valueType}</td>
                <td className="mono">
                  {c.minValue ?? "—"} … {c.maxValue ?? "—"}
                </td>
                <td className="wrap-text">{c.description || "—"}</td>
                <td className="mono">{fmtDate(c.updatedAt, true)}</td>
                <td>
                  <Button onClick={() => setEdit(c)}>Sửa</Button>
                </td>
              </tr>
            ))}
          </DataTable>
        </LoadState>
      </Panel>
      {edit && (
        <ConfigEditor
          value={edit}
          onClose={() => setEdit(null)}
          onSave={save}
        />
      )}
    </>
  );
}

function ConfigEditor({
  value,
  onClose,
  onSave,
}: {
  value: SystemConfigDto;
  onClose: () => void;
  onSave: (key: string, v: string) => void;
}) {
  const data = useData();
  const [v, setV] = useState(value.value);
  const [impact, setImpact] = useState<ThresholdImpactDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (
      !["ai.confidence_threshold", "ai.disagreement_threshold"].includes(
        value.key,
      )
    )
      return;
    const id = setTimeout(async () => {
      setBusy(true);
      try {
        setImpact(await data.admin.impact(value.key, Number(v)));
      } catch {
        /* ignore */
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      title={`Sửa ${value.key}`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button kind="primary" onClick={() => onSave(value.key, v)}>
            Xác nhận & lưu
          </Button>
        </>
      }
    >
      <Field
        labelText="Giá trị"
        required
        help={`${value.valueType}; miền ${value.minValue ?? "—"}–${value.maxValue ?? "—"}`}
      >
        <input value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
      <p>{value.description}</p>
      {busy && <div className="state">Đang ước tính ảnh hưởng…</div>}
      {impact && (
        <div className="credential">
          <div>
            Tỉ lệ defer hiện tại: <b>{impact.currentRate}%</b>
          </div>
          <div>
            Dự kiến sau thay đổi: <b>{impact.projectedRate}%</b>
          </div>
          <div>
            Số ca defer: {impact.currentDeferred} → {impact.projectedDeferred}
          </div>
          <p>{impact.note}</p>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Models ---------------- */
export function ModelsPage() {
  const data = useData();
  const toast = useToast();
  const list = useAsync(() => data.admin.models(), []);
  const [editor, setEditor] = useState(false);
  const [confirm, setConfirm] = useState<{
    item: ModelVersionDto;
    action: "activate" | "delete";
  } | null>(null);

  const act = async () => {
    if (!confirm) return;
    if (confirm.action === "activate")
      await data.admin.activate(confirm.item.id, confirm.item.rowVersion);
    else await data.admin.deleteModel(confirm.item.id, confirm.item.rowVersion);
    toast.push(
      confirm.action === "activate" ? "Đã kích hoạt model." : "Đã xóa model.",
      "success",
    );
    setConfirm(null);
    list.reload();
  };

  return (
    <>
      <PageHeader
        title="Phiên bản model"
        subtitle="Chỉ một model được kích hoạt; model từng active không thể xóa."
        actions={
          <Button kind="primary" onClick={() => setEditor(true)}>
            <Icon name="plus" />
            Đăng ký model
          </Button>
        }
      />
      <Panel>
        <LoadState
          loading={list.loading}
          error={list.error}
          empty={!list.data?.length}
          onRetry={list.reload}
        >
          <DataTable
            headers={[
              "Tên",
              "Đường dẫn",
              "SHA-256",
              "QWK",
              "Dice",
              "IoU",
              "Chẩn đoán",
              "Trạng thái",
              "Kích hoạt lúc",
              "Thao tác",
            ]}
          >
            {list.data?.map((m) => (
              <tr key={m.id}>
                <td>
                  <b>{m.name}</b>
                </td>
                <td className="mono wrap-text">{m.filePath}</td>
                <td className="mono">{m.sha256.slice(0, 12)}…</td>
                <td className="mono">{num(m.qwk, 4)}</td>
                <td className="mono">{num(m.dice, 4)}</td>
                <td className="mono">{num(m.ioU, 4)}</td>
                <td className="mono">{m.diagnosisCount}</td>
                <td>
                  <StatusBadge
                    text={
                      m.isActive
                        ? "Đang dùng"
                        : m.wasActivated
                          ? "Đã từng dùng"
                          : "Chưa dùng"
                    }
                    kind={m.isActive ? "ok" : m.wasActivated ? "watch" : ""}
                  />
                </td>
                <td className="mono">{fmtDate(m.activatedAt, true)}</td>
                <td>
                  <div className="actions">
                    <Button
                      disabled={m.isActive}
                      onClick={() =>
                        setConfirm({ item: m, action: "activate" })
                      }
                    >
                      Kích hoạt
                    </Button>
                    {/* Không xóa được model đang dùng hoặc đã từng dùng (giữ toàn vẹn lịch sử suy luận). */}
                    <Button
                      kind="danger"
                      disabled={m.wasActivated || m.isActive}
                      onClick={() => setConfirm({ item: m, action: "delete" })}
                    >
                      Xóa
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </LoadState>
      </Panel>
      {editor && (
        <ModelEditor
          onClose={() => setEditor(false)}
          onSaved={() => {
            setEditor(false);
            list.reload();
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={
            confirm.action === "activate" ? "Kích hoạt model" : "Xóa model"
          }
          message={`${confirm.action === "activate" ? "Kích hoạt" : "Xóa"} phiên bản ${confirm.item.name}?`}
          danger={confirm.action === "delete"}
          onClose={() => setConfirm(null)}
          onConfirm={act}
        />
      )}
    </>
  );
}

function ModelEditor({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const data = useData();
  const toast = useToast();
  const [form, setForm] = useState<RegisterModelRequest>({
    name: "",
    filePath: "",
    sha256: "",
    qwk: null,
    dice: null,
    ioU: null,
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const p = (k: keyof RegisterModelRequest, v: unknown) =>
    setForm((x) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!form.name || !form.filePath || form.sha256.length !== 64) {
      toast.push("Tên, đường dẫn và SHA-256 đủ 64 ký tự là bắt buộc.", "error");
      return;
    }
    setBusy(true);
    try {
      await data.admin.registerModel(form);
      toast.push("Đã đăng ký model.", "success");
      onSaved();
    } catch (e) {
      toast.push((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Đăng ký phiên bản model"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button kind="primary" busy={busy} onClick={save}>
            Đăng ký
          </Button>
        </>
      }
    >
      <div className="form-row">
        <Field labelText="Tên" required>
          <input
            value={form.name}
            onChange={(e) => p("name", e.target.value)}
          />
        </Field>
        <Field labelText="Đường dẫn" required>
          <input
            value={form.filePath}
            onChange={(e) => p("filePath", e.target.value)}
          />
        </Field>
      </div>
      <Field labelText="SHA-256" required>
        <input
          className="mono"
          maxLength={64}
          value={form.sha256}
          onChange={(e) => p("sha256", e.target.value)}
        />
      </Field>
      <div className="form-row three">
        {(["qwk", "dice", "ioU"] as const).map((k) => (
          <Field key={k} labelText={k.toUpperCase()}>
            <input
              type="number"
              step="0.0001"
              value={(form[k] as number | null) ?? ""}
              onChange={(e) =>
                p(k, e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </Field>
        ))}
      </div>
      <Field labelText="Ghi chú">
        <textarea
          value={form.note || ""}
          onChange={(e) => p("note", e.target.value)}
        />
      </Field>
    </Modal>
  );
}

/* ---------------- Audit ---------------- */
export function AuditPage() {
  const data = useData();
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [rows, setRows] = useState<any[]>([]);

  const page = useAsync(
    () =>
      data.admin.audit({
        action,
        entityType: entity,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
        cursor,
        size: 50,
      }),
    [action, entity, from, to, cursor],
  );

  useEffect(() => {
    if (page.data)
      setRows((r) => (cursor ? [...r, ...page.data!.items] : page.data!.items));
  }, [page.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setCursor(undefined);
    setRows([]);
  }, [action, entity, from, to]);

  const csv = () =>
    downloadText("audit.csv", toCsv(rows), "text/csv;charset=utf-8");

  return (
    <>
      <PageHeader
        title="Nhật ký audit"
        subtitle="Bản ghi chỉ đọc; bản thân audit chứa dữ liệu y tế và được kiểm soát quyền."
        actions={
          <Button onClick={csv} disabled={!rows.length}>
            Xuất CSV
          </Button>
        }
      />
      <Panel>
        <div className="toolbar">
          <Field labelText="Thao tác" className="inline">
            <input
              value={action}
              onChange={(e) => setAction(e.target.value.toUpperCase())}
              placeholder="LOGIN, OVERRIDE, VOID…"
            />
          </Field>
          <Field labelText="Loại đối tượng" className="inline">
            <input
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="Patient, Visit…"
            />
          </Field>
          <Field labelText="Từ ngày" className="inline">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field labelText="Đến ngày" className="inline">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        <LoadState
          loading={page.loading && !rows.length}
          error={page.error}
          empty={!rows.length}
          onRetry={page.reload}
        >
          <DataTable
            headers={[
              "Thời điểm",
              "Người dùng",
              "Hành động",
              "Đối tượng",
              "ID",
              "Chi tiết",
              "IP",
              "Giá trị cũ/mới",
            ]}
          >
            {rows.map((x) => (
              <tr key={x.id}>
                <td className="mono">{fmtDate(x.createdAt, true)}</td>
                <td>{x.userName || "Hệ thống"}</td>
                <td>
                  <StatusBadge
                    text={x.action}
                    kind={
                      x.action.includes("VOID") || x.action.includes("FAILED")
                        ? "alert"
                        : ""
                    }
                  />
                </td>
                <td>{x.entityType}</td>
                <td className="mono">{x.entityId ?? "—"}</td>
                <td className="wrap-text">{x.detail || "—"}</td>
                <td className="mono">{x.ipAddress || "—"}</td>
                <td>
                  <details>
                    <summary>Xem JSON</summary>
                    <div className="code-block">
                      {x.oldValue || "—"}
                      {"\n→\n"}
                      {x.newValue || "—"}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </DataTable>
        </LoadState>
        {page.data?.nextCursor && (
          <div className="pagination">
            <span />
            <Button
              onClick={() => setCursor(page.data?.nextCursor || undefined)}
            >
              Tải thêm
            </Button>
          </div>
        )}
      </Panel>
    </>
  );
}
