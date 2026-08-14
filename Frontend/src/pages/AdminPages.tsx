import { useState, useEffect } from "react";
import { useAsync } from "@/lib/hooks";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole } from "@/lib/roles";
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
import { modelTypes, modelTypeShortLabel } from "@/lib/enums";
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
  const isAdmin = hasRole(user, "Admin");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [model, setModel] = useState("");
  const dash = useAsync(
    () =>
      data.admin.dashboard({
        from: from || undefined,
        to: to || undefined,
        modelVersionId: model ? Number(model) : undefined,
      }),
    [from, to, model],
  );
  const models = useAsync(
    async () => (isAdmin ? data.admin.models() : [] as ModelVersionDto[]),
    [isAdmin],
  );
  const impacts = useAsyncImpacts(data, isAdmin);
  const active = parseActiveModelSet(dash.data?.activeModel);
  const filteredPeriod = Boolean(from || to);

  return (
    <>
      <PageHeader
        title="Dashboard thống kê"
        subtitle="Thống kê toàn hệ thống; một lượt AI chỉ chạy khi đủ mô hình DR, Lesion và Fractal đang hoạt động."
      />

      <Panel>
        <div className="toolbar">
          <Field labelText="Từ ngày" className="inline">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field labelText="Đến ngày" className="inline">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          {isAdmin && (
            <Field labelText="Lọc theo model" className="inline">
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Tất cả model</option>
                {models.data?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {modelTypeShortLabel(m.modelType)} · {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {(from || to || model) && (
            <Button onClick={() => { setFrom(""); setTo(""); setModel(""); }}>
              Xóa bộ lọc
            </Button>
          )}
        </div>
        {dash.data && (
          <div className="faint">
            Kỳ thống kê: <b>{dash.data.periodFrom}</b> → <b>{dash.data.periodTo}</b>
            {dash.data.scope === "AssignedDoctor" ? " · phạm vi bác sĩ phụ trách" : " · toàn hệ thống"}
          </div>
        )}
      </Panel>

      <LoadState
        loading={dash.loading}
        error={dash.error}
        empty={!dash.data}
        onRetry={dash.reload}
      >
        {dash.data && (
          <>
            <div className="stats">
              <Stat k={filteredPeriod ? "Bệnh nhân trong kỳ" : "Bệnh nhân hệ thống"} v={dash.data.totalPatients} />
              <Stat k="Lượt khám trong kỳ" v={dash.data.visitsThisMonth} />
              <Stat k="Chờ triage" v={dash.data.pendingTriage} />
              <Stat k="Defer chờ" v={dash.data.deferredPending} />
              <Stat k="Tỉ lệ defer" v={`${dash.data.deferralRate}%`} />
              <Stat k="Chuyển chuyên khoa" v={`${dash.data.referralRate}%`} />
              <Stat k="Ghi đè" v={`${dash.data.overrideRate}%`} />
            </div>

            <div className="grid2" style={{ marginTop: 12 }}>
              <Panel title="Phân bố mức DR đã được bác sĩ xác nhận">
                <GradeBars distribution={dash.data.gradeDistribution} />
              </Panel>
              <Panel title="Ngưỡng tin cậy → tỉ lệ defer ước tính">
                <LoadState
                  loading={impacts.loading}
                  error={impacts.error}
                  empty={!impacts.data?.length}
                  emptyText={
                    isAdmin
                      ? "Chưa có đủ ca để ước tính."
                      : "Chỉ Admin được truy vấn ảnh hưởng ngưỡng."
                  }
                >
                  <LineChart
                    xLabel="Ngưỡng confidence"
                    yLabel="Tỉ lệ defer (%)"
                    series={[
                      {
                        name: "Tỉ lệ defer dự kiến",
                        points: impacts.data || [],
                      },
                    ]}
                  />
                  {isAdmin && (
                    <div className="faint" style={{ marginTop: 6 }}>
                      Biểu đồ này sử dụng dữ liệu lịch sử toàn hệ thống để ước tính ảnh hưởng của ngưỡng;
                      không áp dụng bộ lọc ngày/model phía trên.
                    </div>
                  )}
                </LoadState>
              </Panel>
            </div>

            <Panel title="Bộ 3 model đang hoạt động">
              <div className="grid3 model-active-grid">
                {(["DR", "Lesion", "Fractal"] as const).map((kind) => (
                  <div className="model-active-card" key={kind}>
                    <div className="split">
                      <b>{kind}</b>
                      <StatusBadge
                        text={active[kind] ? "Active" : "Thiếu"}
                        kind={active[kind] ? "ok" : "alert"}
                      />
                    </div>
                    <code>{active[kind] || "Chưa kích hoạt"}</code>
                  </div>
                ))}
              </div>
              {!active.DR || !active.Lesion || !active.Fractal ? (
                <div className="state error" style={{ marginTop: 10 }}>
                  Chưa đủ 3 mô hình đang hoạt động nên hệ thống chưa thể chạy phân tích AI.
                </div>
              ) : (
                <div className="state ok" style={{ marginTop: 10 }}>
                  Đủ 3/3 model. Luồng suy luận AI sẵn sàng.
                </div>
              )}
            </Panel>
          </>
        )}
      </LoadState>
    </>
  );
}

function parseActiveModelSet(value?: string | null) {
  const result: Record<"DR" | "Lesion" | "Fractal", string> = {
    DR: "",
    Lesion: "",
    Fractal: "",
  };
  if (!value) return result;
  for (const part of value.split("|")) {
    const [rawKey, ...rest] = part.split(":");
    const key = rawKey.trim().toLowerCase();
    const name = rest.join(":").trim();
    if (key === "dr") result.DR = name;
    else if (key === "lesion") result.Lesion = name;
    else if (key === "fractal") result.Fractal = name;
  }
  return result;
}

function useAsyncImpacts(data: ReturnType<typeof useData>, isAdmin: boolean) {
  return useAsync(async () => {
    if (!isAdmin) return [] as { x: string; y: number }[];
    const points: { x: string; y: number }[] = [];
    for (const proposed of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      try {
        const x = await data.admin.impact("ai.confidence_threshold", proposed);
        points.push({ x: proposed.toFixed(1), y: x.projectedRate });
      } catch {
        /* bỏ qua điểm lỗi */
      }
    }
    return points;
  }, [isAdmin]);
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
                {modelTypeShortLabel(m.modelType)} · {m.name}
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

  const activeByType = new Map(
    (list.data || []).filter((m) => m.isActive).map((m) => [m.modelType, m]),
  );
  const ready = modelTypes.every((t) => activeByType.has(t.value));

  const act = async () => {
    if (!confirm) return;
    try {
      if (confirm.action === "activate")
        await data.admin.activate(confirm.item.id, confirm.item.rowVersion);
      else await data.admin.deleteModel(confirm.item.id, confirm.item.rowVersion);
      toast.push(
        confirm.action === "activate"
          ? `Đã kích hoạt ${modelTypeShortLabel(confirm.item.modelType)} model.`
          : "Đã xóa model.",
        "success",
      );
      setConfirm(null);
      list.reload();
    } catch (e) {
      toast.push((e as Error).message, "error");
    }
  };

  return (
    <>
      <PageHeader
        title="Phiên bản model"
        subtitle="Mỗi loại DR, Lesion và Fractal có tối đa một phiên bản active; một lượt AI cần đủ cả 3 loại."
        actions={
          <Button kind="primary" onClick={() => setEditor(true)}>
            <Icon name="plus" />
            Đăng ký model
          </Button>
        }
      />

      <div className="grid3 model-active-grid">
        {modelTypes.map((t) => {
          const active = activeByType.get(t.value);
          return (
            <div className="model-active-card" key={t.value}>
              <div className="split">
                <b>{t.label}</b>
                <StatusBadge
                  text={active ? "Đang dùng" : "Chưa active"}
                  kind={active ? "ok" : "alert"}
                />
              </div>
              <div className="mono wrap-text">{active?.name || "—"}</div>
            </div>
          );
        })}
      </div>
      <div className={`state ${ready ? "ok" : "error"}`} style={{ marginBottom: 12 }}>
        {ready
          ? "Đủ 3/3 mô hình đang hoạt động. Hệ thống sẵn sàng chạy phân tích AI."
          : "Thiếu mô hình đang hoạt động. Cần đủ DR, Lesion và Fractal trước khi bác sĩ chạy phân tích AI."}
      </div>

      <Panel>
        <LoadState
          loading={list.loading}
          error={list.error}
          empty={!list.data?.length}
          onRetry={list.reload}
        >
          <DataTable
            headers={[
              "Loại",
              "Tên",
              "Đường dẫn",
              "SHA-256",
              "QWK",
              "Dice",
              "IoU",
              "Lượt AI tham chiếu",
              "Trạng thái",
              "Kích hoạt lúc",
              "Thao tác",
            ]}
          >
            {list.data?.map((m) => (
              <tr key={m.id}>
                <td>
                  <StatusBadge text={m.modelTypeLabel || modelTypeShortLabel(m.modelType)} />
                </td>
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
                      onClick={() => setConfirm({ item: m, action: "activate" })}
                    >
                      {activeByType.has(m.modelType) && !m.isActive ? "Thay thế" : "Kích hoạt"}
                    </Button>
                    <Button
                      kind="danger"
                      disabled={m.wasActivated || m.isActive || m.diagnosisCount > 0}
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
          title={confirm.action === "activate" ? "Kích hoạt model" : "Xóa model"}
          message={
            confirm.action === "activate"
              ? activeByType.has(confirm.item.modelType)
                ? `Thay model ${modelTypeShortLabel(confirm.item.modelType)} hiện tại bằng ${confirm.item.name}? Model cũ cùng loại sẽ tự tắt; DR/Lesion/Fractal loại khác không bị ảnh hưởng.`
                : `Kích hoạt ${confirm.item.name} cho loại ${modelTypeShortLabel(confirm.item.modelType)}?`
              : `Xóa phiên bản ${confirm.item.name}?`
          }
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
    modelType: 1,
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
    const hasMetric = form.qwk != null || form.dice != null || form.ioU != null;
    const metrics = [form.qwk, form.dice, form.ioU].filter((x): x is number => x != null);
    if (!form.name.trim() || !form.filePath.trim() || form.sha256.trim().length !== 64) {
      toast.push("Tên, đường dẫn và SHA-256 đủ 64 ký tự là bắt buộc.", "error");
      return;
    }
    if (!/^[0-9a-fA-F]{64}$/.test(form.sha256.trim())) {
      toast.push("SHA-256 phải gồm đúng 64 ký tự hệ 16.", "error");
      return;
    }
    if (!hasMetric) {
      toast.push("Cần nhập ít nhất một chỉ số QWK, Dice hoặc IoU.", "error");
      return;
    }
    if (metrics.some((x) => x < 0 || x > 1)) {
      toast.push("QWK, Dice và IoU phải nằm trong khoảng 0 đến 1.", "error");
      return;
    }

    setBusy(true);
    try {
      await data.admin.registerModel({
        ...form,
        name: form.name.trim(),
        filePath: form.filePath.trim(),
        sha256: form.sha256.trim().toLowerCase(),
      });
      toast.push(`Đã đăng ký ${modelTypeShortLabel(form.modelType)} model.`, "success");
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
      <Field
        labelText="Loại model"
        required
        help="Mỗi loại có tối đa một phiên bản active."
      >
        <select
          value={form.modelType}
          onChange={(e) => p("modelType", Number(e.target.value) as 1 | 2 | 3)}
        >
          {modelTypes.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </Field>

      <div className="form-row">
        <Field labelText="Tên" required>
          <input value={form.name} onChange={(e) => p("name", e.target.value)} />
        </Field>
        <Field labelText="Đường dẫn" required>
          <input value={form.filePath} onChange={(e) => p("filePath", e.target.value)} />
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
              min="0"
              max="1"
              step="0.0001"
              value={(form[k] as number | null) ?? ""}
              onChange={(e) => p(k, e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
        ))}
      </div>
      <div className="faint" style={{ marginBottom: 8 }}>
        Gợi ý: DR thường đánh giá bằng QWK; Lesion/Fractal thường dùng Dice/IoU. Cần có ít nhất một chỉ số đánh giá.
      </div>
      <Field labelText="Ghi chú">
        <textarea value={form.note || ""} onChange={(e) => p("note", e.target.value)} />
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
