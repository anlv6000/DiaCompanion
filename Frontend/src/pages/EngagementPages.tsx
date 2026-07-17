import { useEffect, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { DataState } from "@/components/clinical";
import { Badge, Button, Field, Input, Panel, PanelHeader } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/format";
import type { CreateBlogPayload } from "@/types/models";

// UC — clinic appointment schedule (hospital side, web)
export function ClinicSchedulePage() {
  const { clinic, loading, error, loadClinic } = useData();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    loadClinic();
  }, [loadClinic]);

  const toneOf = (s: string): "alert" | "ok" | "watch" | "neutral" =>
    s === "Cancelled" ? "alert" : s === "Completed" ? "ok" : s === "Rescheduled" ? "watch" : "neutral";

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-title text-ink">Lịch khám (phía viện)</h1>
      <Panel className="p-3">
        <div className="flex items-end gap-3">
          <Field label="Từ ngày">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button variant="primary" onClick={() => loadClinic(from || undefined, to || undefined)}>
            Lọc
          </Button>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Lịch hẹn"
          right={<span className="text-meta text-ink-faint tabular-nums">{clinic ? `${clinic.length}` : ""}</span>}
        />
        <DataState loading={loading.clinic} error={error.clinic} empty={clinic?.length === 0} onRetry={() => loadClinic()}>
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Thời gian</th>
                <th>Bệnh nhân</th>
                <th>Bác sĩ</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {(clinic ?? []).map((a) => (
                <tr key={a.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="tabular-nums">{fmtDateTime(a.scheduledAt)}</td>
                  <td className="font-mono text-ink-muted">#{a.patientId}</td>
                  <td className="font-mono text-ink-muted">{a.doctorId ? `#${a.doctorId}` : "—"}</td>
                  <td className="text-ink-muted">{a.reason ?? "—"}</td>
                  <td>
                    <Badge tone={toneOf(a.status)}>{a.status}</Badge>
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

// UC-29 — blog compose + list (web, admin/doctor)
const EMPTY_BLOG: CreateBlogPayload = { title: "", body: "", isPublished: true };
export function BlogAdminPage() {
  const { blog, loading, error, loadBlog, createBlog } = useData();
  const [form, setForm] = useState<CreateBlogPayload>(EMPTY_BLOG);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadBlog();
  }, [loadBlog]);

  async function submit() {
    if (!form.title || !form.body) return;
    await createBlog(form);
    setForm(EMPTY_BLOG);
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-title text-ink">Blog sức khỏe</h1>
        <Button variant="primary" onClick={() => setOpen((v) => !v)}>
          {open ? "Đóng" : "Soạn bài"}
        </Button>
      </div>

      {open && (
        <Panel className="p-4 space-y-3">
          <Field label="Tiêu đề">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Nội dung">
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full h-40 p-2 rounded-sm border border-hairline text-dense resize-y"
            />
          </Field>
          <label className="flex items-center gap-2 text-dense text-ink">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            Đăng ngay
          </label>
          <Button variant="primary" onClick={submit} disabled={loading.createBlog}>
            Lưu bài
          </Button>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <PanelHeader title="Bài đã đăng" />
        <DataState loading={loading.blog} error={error.blog} empty={blog?.length === 0} onRetry={loadBlog}>
          <ul className="divide-y divide-hairline">
            {(blog ?? []).map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink font-medium">{b.title}</span>
                  {b.isPublished ? <Badge tone="ok">Đã đăng</Badge> : <Badge tone="neutral">Nháp</Badge>}
                </div>
                <p className="mt-1 text-meta text-ink-muted line-clamp-2">{b.body}</p>
              </li>
            ))}
          </ul>
        </DataState>
      </Panel>
    </div>
  );
}

// UC — feedback review (admin)
export function FeedbackPage() {
  const { feedback, loading, error, loadFeedback } = useData();
  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-title text-ink">Phản hồi dịch vụ</h1>
      <Panel className="overflow-hidden">
        <PanelHeader title="Danh sách" />
        <DataState loading={loading.feedback} error={error.feedback} empty={feedback?.length === 0} onRetry={loadFeedback}>
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>BN</th>
                <th>Điểm</th>
                <th>Nhận xét</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {(feedback ?? []).map((f) => (
                <tr key={f.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="font-mono text-ink-muted">#{f.patientId}</td>
                  <td className="font-mono tabular-nums">{"★".repeat(f.rating)}</td>
                  <td className="text-ink-muted">{f.comment ?? "—"}</td>
                  <td className="text-micro text-ink-faint tabular-nums">{fmtDateTime(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Panel>
    </div>
  );
}
