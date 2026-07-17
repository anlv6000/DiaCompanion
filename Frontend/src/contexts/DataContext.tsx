import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/apiClient";
import { API_ROUTES } from "@/config/api";
import type {
  AiDiagnosis,
  Adherence,
  Appointment,
  BlogPost,
  ConflictExport,
  CreateBlogPayload,
  CreatePatientPayload,
  CreatePrescriptionPayload,
  CreateStaffPayload,
  CreateVisitPayload,
  CompleteVisitPayload,
  DashboardStats,
  Feedback,
  FundusImage,
  HealthMetric,
  ModelVersion,
  Patient,
  PatientPage,
  PatientRecord,
  Prescription,
  ProgressionData,
  ReviewPayload,
  StaffUser,
  SymptomReport,
  SystemConfig,
  UpdatePatientPayload,
  UploadFundusPayload,
} from "@/types/models";

/**
 * DataContext is the ONLY place that talks to the backend.
 * Rule: pages call these loaders/actions and read the state slices below;
 * presentational components receive data via props and never fetch.
 */

type LoadFlags = Record<string, boolean>;
type LoadErrors = Record<string, string | null>;

interface DataState {
  triage: AiDiagnosis[] | null;
  patients: PatientPage | null;
  patientRecord: PatientRecord | null;
  progression: ProgressionData | null;
  dashboard: DashboardStats | null;
  conflicts: ConflictExport | null;
  configs: SystemConfig[] | null;
  models: ModelVersion[] | null;
  // added
  users: StaffUser[] | null;
  fundusList: FundusImage[] | null;
  prescriptions: Prescription[] | null;
  clinic: Appointment[] | null;
  metrics: HealthMetric[] | null;
  adherence: Adherence | null;
  symptoms: SymptomReport[] | null;
  blog: BlogPost[] | null;
  feedback: Feedback[] | null;
}

interface DataContextValue extends DataState {
  loading: LoadFlags;
  error: LoadErrors;
  // reads
  loadTriage: () => Promise<void>;
  loadPatients: (q?: string, diabetesType?: string, page?: number) => Promise<void>;
  loadPatientRecord: (id: number) => Promise<void>;
  loadProgression: (patientId: number) => Promise<void>;
  loadDashboard: () => Promise<void>;
  loadConflicts: () => Promise<void>;
  loadConfigs: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadUsers: (role?: string) => Promise<void>;
  loadFundusByPatient: (patientId: number) => Promise<void>;
  loadPrescriptions: (patientId: number) => Promise<void>;
  loadClinic: (from?: string, to?: string) => Promise<void>;
  loadMetrics: (patientId: number, type?: string) => Promise<void>;
  loadAdherence: (patientId: number) => Promise<void>;
  loadSymptoms: (patientId: number) => Promise<void>;
  loadBlog: () => Promise<void>;
  loadFeedback: () => Promise<void>;
  // writes
  runAi: (fundusImageId: number) => Promise<AiDiagnosis>;
  submitReview: (aiDiagnosisId: number, payload: ReviewPayload) => Promise<void>;
  saveConfig: (key: string, value: string, description?: string) => Promise<void>;
  activateModel: (id: number) => Promise<void>;
  createUser: (payload: CreateStaffPayload) => Promise<void>;
  lockUser: (id: number, active: boolean) => Promise<void>;
  createPatient: (payload: CreatePatientPayload) => Promise<Patient>;
  updatePatient: (id: number, payload: UpdatePatientPayload) => Promise<void>;
  createVisit: (payload: CreateVisitPayload) => Promise<void>;
  completeVisit: (id: number, payload: CompleteVisitPayload) => Promise<void>;
  uploadFundus: (payload: UploadFundusPayload) => Promise<void>;
  setQuality: (id: number, qualityStatus: string) => Promise<void>;
  createPrescription: (payload: CreatePrescriptionPayload) => Promise<void>;
  createBlog: (payload: CreateBlogPayload) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const emptyState: DataState = {
  triage: null,
  patients: null,
  patientRecord: null,
  progression: null,
  dashboard: null,
  conflicts: null,
  configs: null,
  models: null,
  users: null,
  fundusList: null,
  prescriptions: null,
  clinic: null,
  metrics: null,
  adherence: null,
  symptoms: null,
  blog: null,
  feedback: null,
};

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Phiên đăng nhập hết hạn hoặc không có quyền.";
    if (e.status === 403) return "Bạn không có quyền truy cập mục này.";
    return e.body || e.message;
  }
  return e instanceof Error ? e.message : "Đã xảy ra lỗi không xác định.";
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(emptyState);
  const [loading, setLoading] = useState<LoadFlags>({});
  const [error, setError] = useState<LoadErrors>({});

  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, assign?: (data: T) => Partial<DataState>) => {
      setLoading((s) => ({ ...s, [key]: true }));
      setError((s) => ({ ...s, [key]: null }));
      try {
        const data = await fn();
        if (assign) setState((s) => ({ ...s, ...assign(data) }));
        return data;
      } catch (e) {
        setError((s) => ({ ...s, [key]: errMsg(e) }));
        throw e;
      } finally {
        setLoading((s) => ({ ...s, [key]: false }));
      }
    },
    [],
  );

  const v = (p: Promise<unknown>) => p.then(() => undefined);

  // ---------- reads ----------
  const loadTriage = useCallback(
    () => v(run("triage", () => api.get<AiDiagnosis[]>(API_ROUTES.triage), (d) => ({ triage: d }))),
    [run],
  );

  const loadPatients = useCallback(
    (q?: string, diabetesType?: string, page = 1) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (diabetesType) params.set("diabetesType", diabetesType);
      params.set("page", String(page));
      params.set("pageSize", "20");
      return v(
        run("patients", () => api.get<PatientPage>(`${API_ROUTES.patients}?${params}`), (d) => ({ patients: d })),
      );
    },
    [run],
  );

  const loadPatientRecord = useCallback(
    (id: number) =>
      v(run("patientRecord", () => api.get<PatientRecord>(API_ROUTES.patient(id)), (d) => ({ patientRecord: d }))),
    [run],
  );

  const loadProgression = useCallback(
    (patientId: number) =>
      v(run("progression", () => api.get<ProgressionData>(API_ROUTES.progression(patientId)), (d) => ({ progression: d }))),
    [run],
  );

  const loadDashboard = useCallback(
    () => v(run("dashboard", () => api.get<DashboardStats>(API_ROUTES.dashboard), (d) => ({ dashboard: d }))),
    [run],
  );

  const loadConflicts = useCallback(
    () => v(run("conflicts", () => api.get<ConflictExport>(API_ROUTES.conflicts), (d) => ({ conflicts: d }))),
    [run],
  );

  const loadConfigs = useCallback(
    () => v(run("configs", () => api.get<SystemConfig[]>(API_ROUTES.configs), (d) => ({ configs: d }))),
    [run],
  );

  const loadModels = useCallback(
    () => v(run("models", () => api.get<ModelVersion[]>(API_ROUTES.models), (d) => ({ models: d }))),
    [run],
  );

  const loadUsers = useCallback(
    (role?: string) => {
      const qs = role ? `?role=${encodeURIComponent(role)}` : "";
      return v(run("users", () => api.get<StaffUser[]>(`${API_ROUTES.users}${qs}`), (d) => ({ users: d })));
    },
    [run],
  );

  const loadFundusByPatient = useCallback(
    (patientId: number) =>
      v(run("fundusList", () => api.get<FundusImage[]>(API_ROUTES.fundusByPatient(patientId)), (d) => ({ fundusList: d }))),
    [run],
  );

  const loadPrescriptions = useCallback(
    (patientId: number) =>
      v(run("prescriptions", () => api.get<Prescription[]>(API_ROUTES.prescriptionsByPatient(patientId)), (d) => ({ prescriptions: d }))),
    [run],
  );

  const loadClinic = useCallback(
    (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString() ? `?${params}` : "";
      return v(run("clinic", () => api.get<Appointment[]>(`${API_ROUTES.clinic}${qs}`), (d) => ({ clinic: d })));
    },
    [run],
  );

  const loadMetrics = useCallback(
    (patientId: number, type?: string) => {
      const qs = type ? `?type=${encodeURIComponent(type)}` : "";
      return v(run("metrics", () => api.get<HealthMetric[]>(`${API_ROUTES.metricsByPatient(patientId)}${qs}`), (d) => ({ metrics: d })));
    },
    [run],
  );

  const loadAdherence = useCallback(
    (patientId: number) =>
      v(run("adherence", () => api.get<Adherence>(API_ROUTES.adherence(patientId)), (d) => ({ adherence: d }))),
    [run],
  );

  const loadSymptoms = useCallback(
    (patientId: number) =>
      v(run("symptoms", () => api.get<SymptomReport[]>(API_ROUTES.symptomsByPatient(patientId)), (d) => ({ symptoms: d }))),
    [run],
  );

  const loadBlog = useCallback(
    () => v(run("blog", () => api.get<BlogPost[]>(API_ROUTES.blog), (d) => ({ blog: d }))),
    [run],
  );

  const loadFeedback = useCallback(
    () => v(run("feedback", () => api.get<Feedback[]>(API_ROUTES.feedback), (d) => ({ feedback: d }))),
    [run],
  );

  // ---------- writes ----------
  const runAi = useCallback(
    (fundusImageId: number) => run("runAi", () => api.post<AiDiagnosis>(API_ROUTES.runAi(fundusImageId))),
    [run],
  );

  const submitReview = useCallback(
    async (aiDiagnosisId: number, payload: ReviewPayload) => {
      await run("review", () => api.post(API_ROUTES.review(aiDiagnosisId), payload));
      await loadTriage();
    },
    [run, loadTriage],
  );

  const saveConfig = useCallback(
    async (key: string, value: string, description?: string) => {
      await run("saveConfig", () => api.put(API_ROUTES.configs, { key, value, description }));
      await loadConfigs();
    },
    [run, loadConfigs],
  );

  const activateModel = useCallback(
    async (id: number) => {
      await run("activateModel", () => api.put(API_ROUTES.activateModel(id)));
      await loadModels();
    },
    [run, loadModels],
  );

  const createUser = useCallback(
    async (payload: CreateStaffPayload) => {
      await run("createUser", () => api.post(API_ROUTES.users, payload));
      await loadUsers();
    },
    [run, loadUsers],
  );

  const lockUser = useCallback(
    async (id: number, active: boolean) => {
      await run("lockUser", () => api.put(`${API_ROUTES.lockUser(id)}?active=${active}`));
      await loadUsers();
    },
    [run, loadUsers],
  );

  const createPatient = useCallback(
    (payload: CreatePatientPayload) => run("createPatient", () => api.post<Patient>(API_ROUTES.patients, payload)),
    [run],
  );

  const updatePatient = useCallback(
    async (id: number, payload: UpdatePatientPayload) => {
      await run("updatePatient", () => api.put(API_ROUTES.patient(id), payload));
      await loadPatientRecord(id);
    },
    [run, loadPatientRecord],
  );

  const createVisit = useCallback(
    async (payload: CreateVisitPayload) => {
      await run("createVisit", () => api.post(API_ROUTES.visits, payload));
      await loadPatientRecord(payload.patientId);
    },
    [run, loadPatientRecord],
  );

  const completeVisit = useCallback(
    (id: number, payload: CompleteVisitPayload) => v(run("completeVisit", () => api.put(API_ROUTES.completeVisit(id), payload))),
    [run],
  );

  const uploadFundus = useCallback(
    async (payload: UploadFundusPayload) => {
      await run("uploadFundus", () => api.post(API_ROUTES.fundus, payload));
      await loadFundusByPatient(payload.patientId);
    },
    [run, loadFundusByPatient],
  );

  const setQuality = useCallback(
    (id: number, qualityStatus: string) => v(run("setQuality", () => api.put(API_ROUTES.fundusQuality(id), { qualityStatus }))),
    [run],
  );

  const createPrescription = useCallback(
    async (payload: CreatePrescriptionPayload) => {
      await run("createPrescription", () => api.post(API_ROUTES.prescriptions, payload));
      await loadPrescriptions(payload.patientId);
    },
    [run, loadPrescriptions],
  );

  const createBlog = useCallback(
    async (payload: CreateBlogPayload) => {
      await run("createBlog", () => api.post(API_ROUTES.blog, payload));
      await loadBlog();
    },
    [run, loadBlog],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      loading,
      error,
      loadTriage,
      loadPatients,
      loadPatientRecord,
      loadProgression,
      loadDashboard,
      loadConflicts,
      loadConfigs,
      loadModels,
      loadUsers,
      loadFundusByPatient,
      loadPrescriptions,
      loadClinic,
      loadMetrics,
      loadAdherence,
      loadSymptoms,
      loadBlog,
      loadFeedback,
      runAi,
      submitReview,
      saveConfig,
      activateModel,
      createUser,
      lockUser,
      createPatient,
      updatePatient,
      createVisit,
      completeVisit,
      uploadFundus,
      setQuality,
      createPrescription,
      createBlog,
    }),
    [
      state, loading, error,
      loadTriage, loadPatients, loadPatientRecord, loadProgression, loadDashboard, loadConflicts,
      loadConfigs, loadModels, loadUsers, loadFundusByPatient, loadPrescriptions, loadClinic,
      loadMetrics, loadAdherence, loadSymptoms, loadBlog, loadFeedback,
      runAi, submitReview, saveConfig, activateModel, createUser, lockUser, createPatient,
      updatePatient, createVisit, completeVisit, uploadFundus, setQuality, createPrescription, createBlog,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}
