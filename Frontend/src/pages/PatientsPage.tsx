import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  GradeBadge,
  StatusBadge,
  ActionLink,
  Modal,
  Icon,
} from "@/components/ui";
import { genders, diabetesTypes, grades, label } from "@/lib/enums";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";
import type { CreatePatientRequest, TempCredentialResponse } from "@/types/api";

export function PatientsPage() {
  const data = useData();
  const { user } = useAuth();
  const isReceptionist = user?.role === "Receptionist";
  const [q, setQ] = useState("");
  const dq = useDebounce(q);
  const [type, setType] = useState("");
  const [grade, setGrade] = useState("");
  const [page, setPage] = useState(1);

  const list = useAsync(
    () =>
      data.patients.list({
        q: dq.trim().length >= 2 ? dq : undefined,
        diabetesType: type,
        grade,
        page,
        pageSize: 25,
        sort: "name",
      }),
    [dq, type, grade, page],
  );

  return (
    <>
      <PageHeader
        title="Bệnh nhân"
        subtitle={
          isReceptionist
            ? "Chỉ hiển thị thông tin cơ bản để hỗ trợ tiếp đón và tạo lượt khám."
            : "Tìm kiếm không phân biệt dấu theo họ tên, mã hoặc số điện thoại."
        }
        actions={
          /* Tạo hồ sơ bệnh nhân là nghiệp vụ LỄ TÂN. Staff không thấy nút. */
          can.createPatient(user?.role) ? (
            <ActionLink to="/reception/patients/new">
              <Button kind="primary">
                <Icon name="plus" />
                Tạo bệnh nhân
              </Button>
            </ActionLink>
          ) : undefined
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
              placeholder="Tối thiểu 2 ký tự"
            />
          </Field>
          <Field labelText="Loại tiểu đường" className="inline">
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {diabetesTypes.map(
                (x, i) =>
                  i > 0 && (
                    <option key={i} value={i}>
                      {x}
                    </option>
                  ),
              )}
            </select>
          </Field>
          <Field labelText="Mức DR xác nhận" className="inline">
            <select
              value={grade}
              onChange={(e) => {
                setGrade(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {grades.map((x, i) => (
                <option key={i} value={i}>
                  {x}
                </option>
              ))}
            </select>
          </Field>
          <Button
            onClick={() => {
              setQ("");
              setType("");
              setGrade("");
              setPage(1);
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>
        <LoadState
          loading={list.loading}
          error={list.error}
          empty={!list.data?.items.length}
          onRetry={list.reload}
        >
          <DataTable
            headers={
              isReceptionist
                ? [
                    "Mã",
                    "Họ tên",
                    "Tuổi",
                    "Giới tính",
                    "Số điện thoại",
                    "Lần khám gần nhất",
                    "Hồ sơ",
                  ]
                : [
                    "Mã",
                    "Họ tên",
                    "Tuổi",
                    "Giới tính",
                    "Số điện thoại",
                    "ĐTĐ",
                    "DR gần nhất",
                    "Lần khám gần nhất",
                    "Tài khoản",
                    "Hồ sơ",
                  ]
            }
          >
            {list.data?.items.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.code}</td>
                <td>
                  <b>{p.fullName}</b>
                </td>
                <td className="mono">{p.age}</td>
                <td>{label(genders, p.gender)}</td>
                <td className="mono">{p.phone}</td>
                {!isReceptionist && <td>{label(diabetesTypes, p.diabetesType)}</td>}
                {!isReceptionist && (
                  <td>
                    <GradeBadge grade={p.latestDrGrade} />
                  </td>
                )}
                <td className="mono">{fmtDate(p.latestVisitDate)}</td>
                {!isReceptionist && (
                  <td>
                    <StatusBadge
                      text={p.hasAccount ? "Đã cấp" : "Chưa cấp"}
                      kind={p.hasAccount ? "ok" : "watch"}
                    />
                  </td>
                )}
                <td>
                  <ActionLink to={`/patients/${p.id}`}>Mở hồ sơ →</ActionLink>
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
    </>
  );
}

const EMPTY: CreatePatientRequest = {
  fullName: "",
  gender: 0,
  dateOfBirth: "",
  phone: "",
  address: "",
  diabetesType: 2,
  diabetesDurationYears: null,
  baselineHbA1c: null,
  note: "",
  createAccount: true,
};

export function PatientFormPage({ id }: { id?: number }) {
  const edit = !!id;
  const data = useData();
  const navigate = useNavigate();
  const toast = useToast();
  const detail = useAsync(
    () => (id ? data.patients.get(id) : Promise.resolve(null)),
    [id],
  );
  const [form, setForm] = useState<CreatePatientRequest>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cred, setCred] = useState<TempCredentialResponse | null>(null);

  useEffect(() => {
    if (detail.data) {
      const d = detail.data;
      setForm({
        fullName: d.fullName,
        gender: d.gender,
        dateOfBirth: d.dateOfBirth,
        address: d.address || "",
        phone: d.phone,
        diabetesType: d.diabetesType,
        diabetesDurationYears: d.diabetesDurationYears ?? null,
        baselineHbA1c: d.baselineHbA1c ?? null,
        note: d.note || "",
        createAccount: d.hasAccount,
      });
    }
  }, [detail.data]);

  const patch = (k: keyof CreatePatientRequest, v: unknown) =>
    setForm((x) => ({ ...x, [k]: v }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.phone.trim() || !form.dateOfBirth) {
      setError("Vui lòng nhập họ tên, ngày sinh và số điện thoại.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (id) {
        const { createAccount, ...body } = form;
        await data.patients.update(id, body);
        toast.push("Đã cập nhật hồ sơ.", "success");
        navigate(`/patients/${id}`);
      } else {
        const r = await data.patients.create(form);
        if (r.account) setCred(r.account);
        toast.push("Đã tạo hồ sơ bệnh nhân.", "success");
        if (!r.account) navigate(`/patients/${r.patient.id}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (edit && detail.loading)
    return (
      <LoadState loading error={null}>
        {null}
      </LoadState>
    );

  return (
    <>
      <PageHeader
        title={edit ? "Cập nhật hồ sơ bệnh nhân" : "Tạo hồ sơ bệnh nhân"}
        subtitle="Thông tin lâm sàng được lưu vết; không xóa cứng hồ sơ."
      />
      <Panel>
        <form onSubmit={save}>
          <div className="form-row three">
            <Field labelText="Họ tên" required>
              <input
                value={form.fullName}
                onChange={(e) => patch("fullName", e.target.value)}
              />
            </Field>
            <Field labelText="Giới tính" required>
              <select
                value={form.gender}
                onChange={(e) => patch("gender", Number(e.target.value))}
              >
                {genders.map((x, i) => (
                  <option value={i} key={i}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>
            <Field labelText="Ngày sinh" required>
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.dateOfBirth}
                onChange={(e) => patch("dateOfBirth", e.target.value)}
              />
            </Field>
            <Field
              labelText="Số điện thoại"
              required
              help="Đây là định danh đăng nhập của bệnh nhân."
            >
              <input
                className="mono"
                value={form.phone}
                onChange={(e) => patch("phone", e.target.value)}
              />
            </Field>
            <Field labelText="Loại tiểu đường">
              <select
                value={form.diabetesType}
                onChange={(e) => patch("diabetesType", Number(e.target.value))}
              >
                {diabetesTypes.map((x, i) => (
                  <option value={i} key={i}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>
            <Field labelText="Thời gian mắc (năm)">
              <input
                type="number"
                min="0"
                max="100"
                value={form.diabetesDurationYears ?? ""}
                onChange={(e) =>
                  patch(
                    "diabetesDurationYears",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </Field>
            <Field labelText="HbA1c nền (%)">
              <input
                type="number"
                step="0.1"
                min="0"
                max="30"
                value={form.baselineHbA1c ?? ""}
                onChange={(e) =>
                  patch(
                    "baselineHbA1c",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </Field>
            <Field labelText="Địa chỉ">
              <input
                value={form.address || ""}
                onChange={(e) => patch("address", e.target.value)}
              />
            </Field>
            <Field labelText="Ghi chú">
              <textarea
                value={form.note || ""}
                onChange={(e) => patch("note", e.target.value)}
              />
            </Field>
          </div>
          {!edit && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.createAccount}
                onChange={(e) => patch("createAccount", e.target.checked)}
              />
              Cấp tài khoản bệnh nhân ngay khi tạo hồ sơ
            </label>
          )}
          {error && <div className="state error">{error}</div>}
          <div className="dialog-footer">
            <Button
              type="button"
              onClick={() => navigate(id ? `/patients/${id}` : "/patients")}
            >
              Hủy
            </Button>
            <Button kind="primary" type="submit" busy={busy}>
              {edit ? "Lưu thay đổi" : "Tạo hồ sơ"}
            </Button>
          </div>
        </form>
      </Panel>
      {cred && (
        <CredentialAfterCreate
          cred={cred}
          onDone={() => navigate("/patients")}
        />
      )}
    </>
  );
}

function CredentialAfterCreate({
  cred,
  onDone,
}: {
  cred: TempCredentialResponse;
  onDone: () => void;
}) {
  return (
    <Modal
      title="Tài khoản bệnh nhân đã được cấp"
      onClose={onDone}
      footer={
        <Button kind="primary" onClick={onDone}>
          Đã in / lưu thông tin
        </Button>
      }
    >
      <div className="credential">
        <p>Thông tin này chỉ hiển thị một lần.</p>
        <div>
          Đăng nhập: <code>{cred.loginId}</code>
        </div>
        <div>
          Mật khẩu tạm: <code>{cred.tempPassword}</code>
        </div>
        <p>{cred.note}</p>
      </div>
    </Modal>
  );
}
