import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { DataState } from "@/components/clinical";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { ProgressionChart } from "@/components/charts";
import { fmtDate } from "@/lib/format";

export function ProgressionPage() {
  const { patientId } = useParams();
  const pid = patientId ? Number(patientId) : null;
  const { progression, patients, loading, error, loadProgression, loadPatients } = useData();

  useEffect(() => {
    if (pid) loadProgression(pid);
    else loadPatients();
  }, [pid, loadProgression, loadPatients]);

  if (!pid) {
    // picker: choose a patient to view progression
    return (
      <div className="space-y-4">
        <h1 className="font-serif text-title text-ink">Diễn tiến</h1>
        <Panel className="overflow-hidden">
          <PanelHeader title="Chọn bệnh nhân" />
          <DataState loading={loading.patients} error={error.patients} empty={patients?.items.length === 0}>
            <ul className="divide-y divide-hairline">
              {(patients?.items ?? []).map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/progression/${p.id}`}
                    className="flex items-center justify-between px-4 h-10 text-dense hover:bg-canvas"
                  >
                    <span className="text-ink">
                      <span className="font-mono text-ink-muted mr-2">{p.code}</span>
                      {p.fullName}
                    </span>
                    <span className="text-ink-faint text-micro">{p.diabetesType ?? "—"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </DataState>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-title text-ink">Diễn tiến — bệnh nhân #{pid}</h1>
      <p className="text-meta text-ink-faint -mt-2">
        Mức DR + fractal dimension + HbA1c trên cùng trục thời gian (tiên lượng kết hợp).
      </p>

      <Panel className="p-4">
        <DataState
          loading={loading.progression}
          error={error.progression}
          empty={progression?.fractalAndGrade.length === 0}
          emptyLabel="Chưa đủ dữ liệu chẩn đoán để vẽ diễn tiến."
          onRetry={() => loadProgression(pid)}
        >
          {progression && <ProgressionChart data={progression} />}
        </DataState>
      </Panel>

      {progression && progression.hba1c.length > 0 && (
        <Panel className="overflow-hidden">
          <PanelHeader title="HbA1c (kiểm soát đường huyết)" />
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Thời điểm</th>
                <th>HbA1c (%)</th>
              </tr>
            </thead>
            <tbody>
              {progression.hba1c.map((h, i) => (
                <tr key={i} className="border-t border-hairline [&>td]:px-3 [&>td]:h-8">
                  <td className="tabular-nums">{fmtDate(h.recordedAt)}</td>
                  <td className="font-mono tabular-nums">{h.value.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
