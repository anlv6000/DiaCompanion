import { useEffect, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { DataState, GradeChip } from "@/components/clinical";
import { Badge, Button, Input, Panel, PanelHeader } from "@/components/ui/primitives";
import { fmtDateTime, num, pct } from "@/lib/format";

// UC-19 — AI vs doctor disagreement export
export function ConflictsPage() {
  const { conflicts, loading, error, loadConflicts } = useData();
  useEffect(() => {
    loadConflicts();
  }, [loadConflicts]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-title text-ink">Ca người – máy mâu thuẫn</h1>
        <p className="text-meta text-ink-faint mt-0.5">
          Các ca bác sĩ ghi đè kết quả AI — dữ liệu làm giàu cho vòng huấn luyện lại (Gap 2).
        </p>
      </div>
      <Panel className="overflow-hidden">
        <PanelHeader
          title="Danh sách"
          right={<span className="text-meta text-ink-faint tabular-nums">{conflicts ? `${conflicts.count} ca` : ""}</span>}
        />
        <DataState
          loading={loading.conflicts}
          error={error.conflicts}
          empty={conflicts?.items.length === 0}
          emptyLabel="Chưa có ca ghi đè nào."
          onRetry={loadConflicts}
        >
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>BN</th>
                <th>Mắt</th>
                <th>AI</th>
                <th>Bác sĩ</th>
                <th>Tin cậy</th>
                <th>Bất đồng</th>
                <th>Fractal</th>
                <th>Model</th>
                <th>Thời điểm</th>
              </tr>
            </thead>
            <tbody>
              {(conflicts?.items ?? []).map((c) => (
                <tr key={c.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="font-mono text-ink-muted tabular-nums">#{c.patientId}</td>
                  <td className="font-mono text-ink-muted">{c.eye}</td>
                  <td>
                    <GradeChip grade={c.aiGrade} />
                  </td>
                  <td>
                    <GradeChip grade={c.doctorGrade} />
                  </td>
                  <td className="font-mono tabular-nums">{pct(c.confidence)}</td>
                  <td className="font-mono tabular-nums text-defer">{num(c.crossTaskDisagreement)}</td>
                  <td className="font-mono tabular-nums">{num(c.fractalDimension, 4)}</td>
                  <td className="font-mono text-micro text-ink-faint">{c.modelVersion}</td>
                  <td className="text-micro text-ink-faint tabular-nums">{fmtDateTime(c.reviewedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Panel>
    </div>
  );
}

// UC-28 — dashboard
export function DashboardPage() {
  const { dashboard, loading, error, loadDashboard } = useData();
  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-title text-ink">Thống kê</h1>
      <DataState loading={loading.dashboard} error={error.dashboard} onRetry={loadDashboard}>
        {dashboard && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Bệnh nhân" value={String(dashboard.totalPatients)} />
              <Stat label="Lượt khám" value={String(dashboard.totalVisits)} />
              <Stat label="Chẩn đoán AI" value={String(dashboard.totalDiag)} />
              <Stat label="Tỉ lệ defer" value={pct(dashboard.deferRate, 1)} tone="defer" />
              <Stat label="Tỉ lệ cần chuyển tuyến" value={pct(dashboard.referralYield, 1)} tone="alert" />
              <Stat label="Tỉ lệ ghi đè" value={pct(dashboard.overrideRate, 1)} />
            </div>

            <Panel className="p-4">
              <div className="text-meta text-ink-faint mb-3">Phân bố mức DR</div>
              <div className="space-y-1.5">
                {dashboard.gradeDistribution.map((g) => {
                  const max = Math.max(...dashboard.gradeDistribution.map((x) => x.count), 1);
                  return (
                    <div key={g.grade} className="flex items-center gap-3">
                      <div className="w-24">
                        <GradeChip grade={g.grade} />
                      </div>
                      <div className="flex-1 h-4 bg-canvas rounded-xs overflow-hidden">
                        <div
                          className="h-full rounded-xs"
                          style={{
                            width: `${(g.count / max) * 100}%`,
                            backgroundColor: "var(--primary)",
                            opacity: 0.85,
                          }}
                        />
                      </div>
                      <div className="w-10 text-right font-mono text-dense tabular-nums">{g.count}</div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </>
        )}
      </DataState>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "defer" | "alert" }) {
  const color = tone === "defer" ? "text-defer" : tone === "alert" ? "text-risk-alert" : "text-ink";
  return (
    <Panel className="p-4">
      <div className="text-meta text-ink-faint">{label}</div>
      <div className={`mt-1 font-mono text-title tabular-nums ${color}`}>{value}</div>
    </Panel>
  );
}

// UC-03 — system config + model versioning
export function AdminConfigPage() {
  const { configs, models, loading, error, loadConfigs, loadModels, saveConfig, activateModel } = useData();
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConfigs();
    loadModels();
  }, [loadConfigs, loadModels]);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-title text-ink">Cấu hình hệ thống</h1>

      <Panel className="overflow-hidden">
        <PanelHeader title="Ngưỡng & tham số" />
        <DataState loading={loading.configs} error={error.configs} empty={configs?.length === 0} onRetry={loadConfigs}>
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Khóa</th>
                <th>Giá trị</th>
                <th>Mô tả</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(configs ?? []).map((c) => (
                <tr key={c.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-11">
                  <td className="font-mono text-ink-muted">{c.key}</td>
                  <td className="w-48">
                    <Input
                      value={edits[c.key] ?? c.value}
                      onChange={(e) => setEdits((s) => ({ ...s, [c.key]: e.target.value }))}
                    />
                  </td>
                  <td className="text-ink-faint text-micro">{c.description}</td>
                  <td className="text-right">
                    <Button
                      variant="outline"
                      onClick={() => saveConfig(c.key, edits[c.key] ?? c.value, c.description ?? undefined)}
                      disabled={loading.saveConfig}
                    >
                      Lưu
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader title="Phiên bản model" />
        <DataState loading={loading.models} error={error.models} empty={models?.length === 0} onRetry={loadModels}>
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Tên</th>
                <th>Metrics</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(models ?? []).map((m) => (
                <tr key={m.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-10">
                  <td className="font-mono text-ink">{m.name}</td>
                  <td className="font-mono text-micro text-ink-faint">{m.metrics}</td>
                  <td>
                    {m.isActive ? <Badge tone="primary">Đang dùng</Badge> : <span className="text-ink-faint text-micro">—</span>}
                  </td>
                  <td className="text-right">
                    {!m.isActive && (
                      <Button variant="outline" onClick={() => activateModel(m.id)} disabled={loading.activateModel}>
                        Kích hoạt
                      </Button>
                    )}
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

export function NotFoundPage() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2">
      <div className="font-serif text-title text-ink">404</div>
      <div className="text-dense text-ink-faint">Không tìm thấy trang.</div>
    </div>
  );
}
