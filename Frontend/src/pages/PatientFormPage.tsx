import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "@/contexts/DataContext";
import { Button, Field, Input, Panel, PanelHeader, Select } from "@/components/ui/primitives";
import type { CreatePatientPayload } from "@/types/models";

const EMPTY: CreatePatientPayload = {
  fullName: "",
  dateOfBirth: "",
  gender: "Male",
  phone: "",
  address: "",
  diabetesType: "Type2",
  diabetesDurationYears: null,
};

// Handles both /patients/new and /patients/:id/edit
export function PatientFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const pid = Number(id);
  const navigate = useNavigate();
  const { patientRecord, loadPatientRecord, createPatient, updatePatient, loading } = useData();
  const [form, setForm] = useState<CreatePatientPayload>(EMPTY);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (editing) loadPatientRecord(pid);
  }, [editing, pid, loadPatientRecord]);

  useEffect(() => {
    if (editing && patientRecord?.patient?.id === pid) {
      const p = patientRecord.patient;
      setForm({
        fullName: p.fullName,
        dateOfBirth: p.dateOfBirth ?? "",
        gender: p.gender ?? "Male",
        phone: p.phone ?? "",
        address: p.address ?? "",
        diabetesType: p.diabetesType ?? "Type2",
        diabetesDurationYears: p.diabetesDurationYears,
      });
    }
  }, [editing, patientRecord, pid]);

  async function submit() {
    setErr(null);
    if (!form.fullName) {
      setErr("Nhập họ tên bệnh nhân.");
      return;
    }
    try {
      if (editing) {
        await updatePatient(pid, {
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          diabetesType: form.diabetesType,
          diabetesDurationYears: form.diabetesDurationYears,
        });
        navigate(`/patients/${pid}`);
      } else {
        const created = await createPatient(form);
        navigate(`/patients/${created.id}`);
      }
    } catch {
      setErr("Không lưu được. Kiểm tra dữ liệu / máy chủ.");
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="font-serif text-title text-ink">{editing ? "Sửa hồ sơ bệnh nhân" : "Tạo hồ sơ bệnh nhân"}</h1>
      <Panel>
        <PanelHeader title="Thông tin & tiền sử tiểu đường" />
        <div className="grid grid-cols-2 gap-3 p-4">
          <Field label="Họ tên">
            <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label="Giới tính">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="Male">Nam</option>
              <option value="Female">Nữ</option>
              <option value="Other">Khác</option>
            </Select>
          </Field>
          {!editing && (
            <Field label="Ngày sinh">
              <Input
                type="date"
                value={form.dateOfBirth ?? ""}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </Field>
          )}
          <Field label="SĐT">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Địa chỉ">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Loại tiểu đường">
            <Select value={form.diabetesType} onChange={(e) => setForm({ ...form, diabetesType: e.target.value })}>
              <option value="Type1">Type 1</option>
              <option value="Type2">Type 2</option>
              <option value="Gestational">Thai kỳ</option>
              <option value="None">Không</option>
            </Select>
          </Field>
          <Field label="Thời gian mắc (năm)">
            <Input
              type="number"
              value={form.diabetesDurationYears ?? ""}
              onChange={(e) =>
                setForm({ ...form, diabetesDurationYears: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
        </div>
        {err && <div className="px-4 text-meta text-risk-alert">{err}</div>}
        <div className="flex gap-2 p-4">
          <Button variant="primary" onClick={submit} disabled={loading.createPatient || loading.updatePatient}>
            {editing ? "Lưu thay đổi" : "Tạo hồ sơ"}
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Hủy
          </Button>
        </div>
      </Panel>
    </div>
  );
}
