import { useEffect, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { DataState } from "@/components/clinical";
import { Badge, Button, Field, Input, Panel, PanelHeader, Select } from "@/components/ui/primitives";
import type { CreateStaffPayload, Role } from "@/types/models";
import { fmtDate } from "@/lib/format";

const EMPTY: CreateStaffPayload = { fullName: "", email: "", password: "", role: "Doctor", licenseNo: "" };

export function UsersPage() {
  const { users, loading, error, loadUsers, createUser, lockUser } = useData();
  const [form, setForm] = useState<CreateStaffPayload>(EMPTY);
  const [open, setOpen] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function submit() {
    setFormErr(null);
    if (!form.fullName || !form.email || !form.password) {
      setFormErr("Điền đủ họ tên, email, mật khẩu.");
      return;
    }
    try {
      await createUser({ ...form, licenseNo: form.licenseNo || undefined });
      setForm(EMPTY);
      setOpen(false);
    } catch {
      setFormErr("Không tạo được (email trùng hoặc lỗi máy chủ).");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-title text-ink">Quản lý tài khoản</h1>
        <Button variant="primary" onClick={() => setOpen((v) => !v)}>
          {open ? "Đóng" : "Tạo tài khoản"}
        </Button>
      </div>

      {open && (
        <Panel className="p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Họ tên">
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Mật khẩu">
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="Vai trò">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="Doctor">Bác sĩ</option>
                <option value="Nurse">Điều dưỡng</option>
                <option value="Admin">Admin</option>
              </Select>
            </Field>
            <Field label="Số chứng chỉ (nếu là bác sĩ)">
              <Input value={form.licenseNo} onChange={(e) => setForm({ ...form, licenseNo: e.target.value })} />
            </Field>
          </div>
          {formErr && <div className="mt-2 text-meta text-risk-alert">{formErr}</div>}
          <div className="mt-3">
            <Button variant="primary" onClick={submit} disabled={loading.createUser}>
              Lưu tài khoản
            </Button>
          </div>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <PanelHeader
          title="Danh sách"
          right={<span className="text-meta text-ink-faint tabular-nums">{users ? `${users.length}` : ""}</span>}
        />
        <DataState loading={loading.users} error={error.users} empty={users?.length === 0} onRetry={loadUsers}>
          <table className="w-full text-dense">
            <thead className="bg-canvas text-ink-faint text-micro uppercase tracking-wide">
              <tr className="[&>th]:text-left [&>th]:font-medium [&>th]:px-3 [&>th]:h-8">
                <th>Họ tên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Chứng chỉ</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-hairline [&>td]:px-3 [&>td]:h-9">
                  <td className="text-ink">{u.fullName}</td>
                  <td className="font-mono text-micro text-ink-muted">{u.email}</td>
                  <td>{u.role}</td>
                  <td className="font-mono text-micro text-ink-faint">{u.licenseNo ?? "—"}</td>
                  <td>
                    {u.isActive ? (
                      <Badge tone="ok">Hoạt động</Badge>
                    ) : (
                      <Badge tone="alert">Đã khóa</Badge>
                    )}
                  </td>
                  <td className="text-micro text-ink-faint tabular-nums">{fmtDate(u.createdAt)}</td>
                  <td className="text-right">
                    <Button variant="outline" onClick={() => lockUser(u.id, !u.isActive)} disabled={loading.lockUser}>
                      {u.isActive ? "Khóa" : "Mở"}
                    </Button>
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
