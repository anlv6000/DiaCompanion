// Base URL of the DiaCompanion .NET backend.
// Override at build/dev time with VITE_API_BASE if needed.
export const BASE_API: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:5080";

export const API_ROUTES = {
  login: "/api/auth/login",
  me: "/api/auth/me",
  triage: "/api/aidiagnosis/triage",
  runAi: (fundusImageId: number) => `/api/aidiagnosis/run/${fundusImageId}`,
  progression: (patientId: number) => `/api/aidiagnosis/progression/${patientId}`,
  review: (aiDiagnosisId: number) => `/api/reviews/${aiDiagnosisId}`,
  conflicts: "/api/reviews/conflicts",
  patients: "/api/patients",
  patient: (id: number) => `/api/patients/${id}`,
  dashboard: "/api/dashboard/stats",
  configs: "/api/adminconfig/configs",
  models: "/api/adminconfig/models",
  activateModel: (id: number) => `/api/adminconfig/models/${id}/activate`,
} as const;
