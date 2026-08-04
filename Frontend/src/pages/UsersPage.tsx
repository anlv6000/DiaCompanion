import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAsync, useDebounce } from "@/lib/hooks";
import {
  PageHeader,
  Panel,
  Field,
  Button,
  DataTable,
  LoadState,
  Pagination,
  StatusBadge,
  Modal,
  ConfirmDialog,
  Icon,
} from "@/components/ui";
import { roles } from "@/lib/enums";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import type { StaffUserDto, TempCredentialResponse } from "@/types/api";

export function UsersPage() {
  const data = useData();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 300);
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<StaffUserDto | "new" | null>(null);
  const [confirm, setConfirm] = useState<StaffUserDto | null>(null);
  const [cred, setCred] = useState<TempCredentialResponse | null>(null);

  const list = useAsync(
    () =>
      data.users.list({
        q: dq,
        role,
        isActive: active,
        page,
        pageSize: 25,
        sort: "name",
      }),
    [dq, role, active, page],
  );

  const toggle = async (u: StaffUserDto) => {
    await data.users.setActive(u.id, !u.isActive, u.rowVersion);
    toast.push(
      u.isActive ? "Đã khóa tài khoản." : "Đã mở tài khoản.",
      "success",
    );
    setConfirm(null);
    list.reload();
  };
  const reset = async (u: StaffUserDto) => {
    setCred(await data.users.resetPassword(u.id, u.rowVersion));
    toast.push("Đã cấp mật khẩu tạm mới.", "success");
  };

  return (
    <>
      <PageHeader
        title="Tài khoản nhân viên"
        subtitle="Quản lý Admin, Bác sĩ và Điều dưỡng."
        actions={
          <Button kind="primary" onClick={() => setEditor("new")}>
            <Icon name="plus" />
            Tạo tài khoản
          </Button>
        }
      />
      <Panel>
        <div className="toolbar">
          <Field labelText="Tìm kiếm" className="inline">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Họ tên, email, chứng chỉ"
            />
          </Field>
          <Field labelText="Vai trò" className="inline">
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field labelText="Trạng thái" className="inline">
            <select
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              <option value="true">Hoạt động</option>
              <option value="false">Đã khóa</option>
            </select>
          </Field>
        </div>
        <LoadState
          loading={list.loading}
          error={list.error}
          empty={!list.data?.items.length}
          onRetry={list.reload}
        >
          <DataTable
            headers={[
              "Họ tên",
              "Email",
              "Vai trò",
              "Chứng chỉ",
              "Đăng nhập cuối",
              "Trạng thái",
              "Thao tác",
            ]}
          >
            {list.data?.items.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.fullName}</b>
                </td>
                <td className="mono">{u.email || "—"}</td>
                <td>{u.role}</td>
                <td className="mono">{u.licenseNo || "—"}</td>
                <td className="mono">{fmtDate(u.lastLoginAt, true)}</td>
                <td>
                  <StatusBadge
                    text={u.isActive ? "Hoạt động" : "Đã khóa"}
                    kind={u.isActive ? "ok" : "alert"}
                  />
                </td>
                <td>
                  <div className="actions">
                    <Button onClick={() => setEditor(u)}>
                      <Icon name="edit" />
                      Sửa
                    </Button>
                    <Button onClick={() => reset(u)}>Reset MK</Button>
                    <Button
                      kind={u.isActive ? "danger" : "default"}
                      onClick={() => setConfirm(u)}
                    >
                      {u.isActive ? "Khóa" : "Mở"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
          <Pagination
            page={page}
            pageSize={25}
            total={list.data?.totalItems || 0}
            onPage={setPage}
          />
        </LoadState>
      </Panel>
      {editor && (
        <UserEditor
          user={editor}
          onClose={() => setEditor(null)}
          onSaved={(c) => {
            setEditor(null);
            if (c) setCred(c);
            list.reload();
          }}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.isActive ? "Khóa tài khoản" : "Mở tài khoản"}
          message={`Xác nhận ${confirm.isActive ? "khóa" : "mở"} tài khoản ${confirm.fullName}?`}
          danger={confirm.isActive}
          onClose={() => setConfirm(null)}
          onConfirm={() => toggle(confirm)}
        />
      )}
      {cred && <CredentialModal value={cred} onClose={() => setCred(null)} />}
    </>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user: StaffUserDto | "new";
  onClose: () => void;
  onSaved: (c?: TempCredentialResponse) => void;
}) {
  const data = useData();
  const isNew = user === "new";
  const [fullName, setName] = useState(isNew ? "" : user.fullName);
  const [email, setEmail] = useState(isNew ? "" : user.email || "");
  const [role, setRole] = useState<number>(
    isNew ? 1 : roles.find((x) => x.key === user.role)?.value || 1,
  );
  const [license, setLicense] = useState(isNew ? "" : user.licenseNo || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (
      !fullName.trim() ||
      (isNew && !email.trim()) ||
      (role === 1 && !license.trim())
    ) {
      setError("Vui lòng nhập đầy đủ các trường bắt buộc.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (isNew) {
        const c = await data.users.create({
          fullName,
          email,
          role,
          licenseNo: license || null,
        });
        onSaved(c);
      } else {
        await data.users.update(user.id, {
          fullName,
          licenseNo: license || null,
          rowVersion: user.rowVersion,
        });
        onSaved();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isNew ? "Tạo tài khoản nhân viên" : "Cập nhật tài khoản"}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button kind="primary" busy={busy} onClick={save}>
            Lưu tài khoản
          </Button>
        </>
      }
    >
      <div className="form-row">
        <Field labelText="Họ tên" required>
          <input value={fullName} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field labelText="Email" required={isNew}>
          <input
            type="email"
            disabled={!isNew}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field labelText="Vai trò" required>
          <select
            disabled={!isNew}
            value={role}
            onChange={(e) => setRole(Number(e.target.value))}
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field labelText="Số chứng chỉ" required={role === 1}>
          <input value={license} onChange={(e) => setLicense(e.target.value)} />
        </Field>
      </div>
      {error && <div className="state error">{error}</div>}
    </Modal>
  );
}

function CredentialModal({
  value,
  onClose,
}: {
  value: TempCredentialResponse;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Thông tin đăng nhập tạm"
      onClose={onClose}
      footer={
        <Button kind="primary" onClick={onClose}>
          Đã lưu thông tin
        </Button>
      }
    >
      <div className="credential">
        <div>
          <small>Định danh đăng nhập</small>
          <div>
            <code>{value.loginId}</code>
          </div>
        </div>
        <hr />
        <div>
          <small>Mật khẩu tạm</small>
          <div>
            <code>{value.tempPassword}</code>
          </div>
        </div>
        <p>{value.note}</p>
      </div>
    </Modal>
  );
}
