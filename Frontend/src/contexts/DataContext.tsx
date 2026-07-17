import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/apiClient";
import { API_ROUTES } from "@/config/api";
import type {
  AiDiagnosis,
  ConflictExport,
  DashboardStats,
  ModelVersion,
  PatientPage,
  PatientRecord,
  ProgressionData,
  ReviewPayload,
  SystemConfig,
} from "@/types/models";

/**
 * DataContext is the ONLY place that talks to the backend.
 * Rule (per architecture): pages call these loaders/actions and read the state
 * slices below; presentational components receive data via props and never fetch.
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
}

interface DataContextValue extends DataState {
  loading: LoadFlags;
  error: LoadErrors;
  // loaders (read)
  loadTriage: () => Promise<void>;
  loadPatients: (q?: string, diabetesType?: string, page?: number) => Promise<void>;
  loadPatientRecord: (id: number) => Promise<void>;
  loadProgression: (patientId: number) => Promise<void>;
  loadDashboard: () => Promise<void>;
  loadConflicts: () => Promise<void>;
  loadConfigs: () => Promise<void>;
  loadModels: () => Promise<void>;
  // actions (write) — refresh affected slices afterwards
  runAi: (fundusImageId: number) => Promise<AiDiagnosis>;
  submitReview: (aiDiagnosisId: number, payload: ReviewPayload) => Promise<void>;
  saveConfig: (key: string, value: string, description?: string) => Promise<void>;
  activateModel: (id: number) => Promise<void>;
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

  // generic runner: manages loading/error per key and assigns into state
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

  const loadTriage = useCallback(
    () => run("triage", () => api.get<AiDiagnosis[]>(API_ROUTES.triage), (d) => ({ triage: d })).then(() => undefined),
    [run],
  );

  const loadPatients = useCallback(
    (q?: string, diabetesType?: string, page = 1) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (diabetesType) params.set("diabetesType", diabetesType);
      params.set("page", String(page));
      params.set("pageSize", "20");
      return run(
        "patients",
        () => api.get<PatientPage>(`${API_ROUTES.patients}?${params.toString()}`),
        (d) => ({ patients: d }),
      ).then(() => undefined);
    },
    [run],
  );

  const loadPatientRecord = useCallback(
    (id: number) =>
      run("patientRecord", () => api.get<PatientRecord>(API_ROUTES.patient(id)), (d) => ({ patientRecord: d })).then(
        () => undefined,
      ),
    [run],
  );

  const loadProgression = useCallback(
    (patientId: number) =>
      run(
        "progression",
        () => api.get<ProgressionData>(API_ROUTES.progression(patientId)),
        (d) => ({ progression: d }),
      ).then(() => undefined),
    [run],
  );

  const loadDashboard = useCallback(
    () =>
      run("dashboard", () => api.get<DashboardStats>(API_ROUTES.dashboard), (d) => ({ dashboard: d })).then(
        () => undefined,
      ),
    [run],
  );

  const loadConflicts = useCallback(
    () =>
      run("conflicts", () => api.get<ConflictExport>(API_ROUTES.conflicts), (d) => ({ conflicts: d })).then(
        () => undefined,
      ),
    [run],
  );

  const loadConfigs = useCallback(
    () => run("configs", () => api.get<SystemConfig[]>(API_ROUTES.configs), (d) => ({ configs: d })).then(() => undefined),
    [run],
  );

  const loadModels = useCallback(
    () => run("models", () => api.get<ModelVersion[]>(API_ROUTES.models), (d) => ({ models: d })).then(() => undefined),
    [run],
  );

  const runAi = useCallback(
    async (fundusImageId: number) => {
      const diag = await run("runAi", () => api.post<AiDiagnosis>(API_ROUTES.runAi(fundusImageId)));
      return diag;
    },
    [run],
  );

  const submitReview = useCallback(
    async (aiDiagnosisId: number, payload: ReviewPayload) => {
      await run("review", () => api.post(API_ROUTES.review(aiDiagnosisId), payload));
      await loadTriage(); // refresh queue after a decision
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
      runAi,
      submitReview,
      saveConfig,
      activateModel,
    }),
    [
      state,
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
      runAi,
      submitReview,
      saveConfig,
      activateModel,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within <DataProvider>");
  return ctx;
}
