import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  authApi,
  usersApi,
  patientsApi,
  visitsApi,
  imagesApi,
  diagnosesApi,
  triageApi,
  prescriptionsApi,
  appointmentsApi,
  recheckApi,
  monitoringApi,
  engagementApi,
  blogApi,
  adminApi,
  exportApi,
} from "@/api/services";
import type * as T from "@/types/api";

/**
 * DataContext — tầng dữ liệu DUY NHẤT giữa UI và backend.
 *
 * Nguyên tắc:
 *  - Dữ liệu từ backend PHẢI đi qua DataContext trước khi tới màn hình.
 *  - Chỉ PAGE gọi useData(); COMPONENT nhận dữ liệu qua props, không tự fetch.
 *  - Không page nào import trực tiếp @/api/services — luôn qua useData().
 *
 * DataContext bọc toàn bộ nhóm service thành "action" trả Promise, kèm vài
 * mẩu state dùng chung (doctors, dashboard, triageCount, activeModel) nạp sẵn.
 */

interface DataValue {
  // state dùng chung
  doctors: T.DoctorDto[] | null;
  dashboard: T.DashboardDto | null;
  triageCount: T.TriageCountDto | null;
  activeModel: T.ModelVersionDto | null;
  loadDoctors: () => Promise<T.DoctorDto[]>;
  loadDashboard: () => Promise<T.DashboardDto>;
  loadTriageCount: () => Promise<T.TriageCountDto>;
  loadActiveModel: () => Promise<T.ModelVersionDto | null>;
  // nhóm action theo nghiệp vụ
  auth: ReturnType<typeof buildAuth>;
  users: ReturnType<typeof buildUsers>;
  patients: ReturnType<typeof buildPatients>;
  visits: ReturnType<typeof buildVisits>;
  images: ReturnType<typeof buildImages>;
  diagnoses: ReturnType<typeof buildDiagnoses>;
  triage: ReturnType<typeof buildTriage>;
  prescriptions: ReturnType<typeof buildPrescriptions>;
  appointments: ReturnType<typeof buildAppointments>;
  recheck: ReturnType<typeof buildRecheck>;
  monitoring: ReturnType<typeof buildMonitoring>;
  engagement: ReturnType<typeof buildEngagement>;
  blog: ReturnType<typeof buildBlog>;
  admin: ReturnType<typeof buildAdmin>;
  exports: ReturnType<typeof buildExports>;
}

const buildAuth = () => ({
  me: () => authApi.me(),
  change: (b: T.ChangePasswordRequest) => authApi.change(b),
});
const buildUsers = () => ({
  list: (p: Record<string, unknown>) => usersApi.list(p),
  get: (id: number) => usersApi.get(id),
  create: (b: T.CreateStaffRequest) => usersApi.create(b),
  update: (id: number, b: T.UpdateStaffRequest) => usersApi.update(id, b),
  setActive: (id: number, v: boolean) => usersApi.active(id, v),
  resetPassword: (id: number) => usersApi.reset(id),
  doctors: () => usersApi.doctors(),
});
const buildPatients = () => ({
  list: (p: Record<string, unknown>) => patientsApi.list(p),
  get: (id: number) => patientsApi.get(id),
  create: (b: T.CreatePatientRequest) => patientsApi.create(b),
  update: (id: number, b: T.UpdatePatientRequest) => patientsApi.update(id, b),
  reissue: (id: number) => patientsApi.reissue(id),
  void: (id: number, reason: string) => patientsApi.void(id, reason),
});
const buildVisits = () => ({
  list: (p: Record<string, unknown>) => visitsApi.list(p),
  get: (id: number) => visitsApi.get(id),
  create: (b: T.CreateVisitRequest) => visitsApi.create(b),
  close: (id: number, b: T.CloseVisitRequest) => visitsApi.close(id, b),
  void: (id: number, reason: string) => visitsApi.void(id, reason),
});
const buildImages = () => ({
  list: (p: Record<string, unknown>) => imagesApi.list(p),
  upload: (
    file: File,
    patientId: number,
    visitId: number | null,
    eye: number,
  ) => imagesApi.upload(file, patientId, visitId, eye),
  quality: (id: number, status: number, note?: string) =>
    imagesApi.quality(id, status, note),
  void: (id: number, reason: string) => imagesApi.void(id, reason),
  content: (id: number) => imagesApi.content(id),
});
const buildDiagnoses = () => ({
  run: (imageId: number) => diagnosesApi.run(imageId),
  get: (id: number) => diagnosesApi.get(id),
  byImage: (imageId: number) => diagnosesApi.byImage(imageId),
  void: (id: number, reason: string) => diagnosesApi.void(id, reason),
  progression: (patientId: number, months: number) =>
    diagnosesApi.progression(patientId, months),
});
const buildTriage = () => ({
  queue: (p: Record<string, unknown>) => triageApi.queue(p),
  count: () => triageApi.count(),
  approve: (id: number, rowVersion?: string | null) =>
    triageApi.approve(id, rowVersion),
  override: (id: number, b: T.OverrideRequest) => triageApi.override(id, b),
  voidReview: (id: number, reason: string) => triageApi.voidReview(id, reason),
});
const buildPrescriptions = () => ({
  list: (p: Record<string, unknown>) => prescriptionsApi.list(p),
  get: (id: number) => prescriptionsApi.get(id),
  create: (b: T.CreatePrescriptionRequest) => prescriptionsApi.create(b),
  update: (id: number, b: T.CreatePrescriptionRequest) =>
    prescriptionsApi.update(id, b),
  void: (id: number, reason: string) => prescriptionsApi.void(id, reason),
  adherence: (patientId: number, days?: number) =>
    prescriptionsApi.adherence(patientId, days),
});
const buildAppointments = () => ({
  list: (p: Record<string, unknown>) => appointmentsApi.list(p),
  slots: (date: string, doctorId?: number | null) =>
    appointmentsApi.slots(date, doctorId),
  create: (b: T.CreateAppointmentRequest) => appointmentsApi.create(b),
  reschedule: (id: number, scheduledAt: string) =>
    appointmentsApi.reschedule(id, scheduledAt),
  cancel: (id: number, reason?: string) => appointmentsApi.cancel(id, reason),
  status: (id: number, status: number) => appointmentsApi.status(id, status),
});
const buildRecheck = () => ({
  me: () => recheckApi.me(),
  patient: (patientId: number) => recheckApi.patient(patientId),
  due: (p: Record<string, unknown>) => recheckApi.due(p),
  overdueCount: () => recheckApi.overdueCount(),
});
const buildMonitoring = () => ({
  metrics: (p: Record<string, unknown>) => monitoringApi.metrics(p),
  summary: (id: number, days?: number) => monitoringApi.summary(id, days),
  lifestyle: (p: Record<string, unknown>) => monitoringApi.lifestyle(p),
  today: (patientId?: number) => monitoringApi.today(patientId),
});
const buildEngagement = () => ({
  notifications: (p: Record<string, unknown>) => engagementApi.notifications(p),
  unread: () => engagementApi.unread(),
  read: (id: number) => engagementApi.read(id),
  readAll: () => engagementApi.readAll(),
  symptoms: (p: Record<string, unknown>) => engagementApi.symptoms(p),
  reply: (id: number, reply: string) => engagementApi.reply(id, reply),
  feedback: (p: Record<string, unknown>) => engagementApi.feedback(p),
  feedbackSummary: () => engagementApi.feedbackSummary(),
});
const buildBlog = () => ({
  manage: (p: Record<string, unknown>) => blogApi.manage(p),
  published: (p: Record<string, unknown>) => blogApi.published(p),
  get: (id: number) => blogApi.get(id),
  create: (b: T.SaveBlogRequest) => blogApi.create(b),
  update: (id: number, b: T.SaveBlogRequest) => blogApi.update(id, b),
  publish: (id: number, v: boolean) => blogApi.publish(id, v),
  delete: (id: number) => blogApi.delete(id),
});
const buildAdmin = () => ({
  dashboard: () => adminApi.dashboard(),
  configs: () => adminApi.configs(),
  updateConfig: (key: string, v: string) => adminApi.updateConfig(key, v),
  impact: (key: string, proposed: number) => adminApi.impact(key, proposed),
  models: () => adminApi.models(),
  registerModel: (b: T.RegisterModelRequest) => adminApi.registerModel(b),
  activate: (id: number) => adminApi.activate(id),
  deleteModel: (id: number) => adminApi.deleteModel(id),
  audit: (p: Record<string, unknown>) => adminApi.audit(p),
});
const buildExports = () => ({
  visitReport: (id: number) => exportApi.visitReport(id),
  conflicts: (modelVersionId?: number | null) =>
    exportApi.conflicts(modelVersionId),
  conflictsCsv: (modelVersionId?: number | null) =>
    exportApi.conflictsCsv(modelVersionId),
});

const DataContext = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children?: ReactNode }) {
  const [doctors, setDoctors] = useState<T.DoctorDto[] | null>(null);
  const [dashboard, setDashboard] = useState<T.DashboardDto | null>(null);
  const [triageCount, setTriageCount] = useState<T.TriageCountDto | null>(null);
  const [activeModel, setActiveModel] = useState<T.ModelVersionDto | null>(
    null,
  );

  const loadDoctors = useCallback(async () => {
    const d = await usersApi.doctors();
    setDoctors(d);
    return d;
  }, []);
  const loadDashboard = useCallback(async () => {
    const d = await adminApi.dashboard();
    setDashboard(d);
    return d;
  }, []);
  const loadTriageCount = useCallback(async () => {
    const c = await triageApi.count();
    setTriageCount(c);
    return c;
  }, []);
  const loadActiveModel = useCallback(async () => {
    const list = await adminApi.models();
    const active = list.find((m) => m.isActive) ?? null;
    setActiveModel(active);
    return active;
  }, []);

  const value = useMemo<DataValue>(
    () => ({
      doctors,
      dashboard,
      triageCount,
      activeModel,
      loadDoctors,
      loadDashboard,
      loadTriageCount,
      loadActiveModel,
      auth: buildAuth(),
      users: buildUsers(),
      patients: buildPatients(),
      visits: buildVisits(),
      images: buildImages(),
      diagnoses: buildDiagnoses(),
      triage: buildTriage(),
      prescriptions: buildPrescriptions(),
      appointments: buildAppointments(),
      recheck: buildRecheck(),
      monitoring: buildMonitoring(),
      engagement: buildEngagement(),
      blog: buildBlog(),
      admin: buildAdmin(),
      exports: buildExports(),
    }),
    [
      doctors,
      dashboard,
      triageCount,
      activeModel,
      loadDoctors,
      loadDashboard,
      loadTriageCount,
      loadActiveModel,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData phải nằm trong <DataProvider>");
  return ctx;
}
