export type Role = "Admin" | "Doctor" | "Nurse" | "Patient";

export interface AuthUser {
  id: number;
  fullName: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  userId: number;
  fullName: string;
  role: Role;
}

export type DrGrade = "Normal" | "Mild" | "Moderate" | "Severe" | "PDR";

export interface AiDiagnosis {
  id: number;
  fundusImageId: number;
  drGrade: DrGrade;
  referable: boolean;
  confidence: number;
  lesionSummary: string | null;
  fractalDimension: number | null;
  crossTaskDisagreement: number;
  deferred: boolean;
  modelVersion: string;
  createdAt: string;
}

export interface Patient {
  id: number;
  code: string;
  userId: number | null;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  diabetesType: string | null;
  diabetesDurationYears: number | null;
  createdAt: string;
}

export interface Visit {
  id: number;
  patientId: number;
  doctorId: number | null;
  visitDate: string;
  status: string;
  conclusion: string | null;
  referral: string | null;
  createdAt: string;
}

export interface PatientRecord {
  patient: Patient;
  visits: Visit[];
}

export interface PatientPage {
  total: number;
  page: number;
  pageSize: number;
  items: Patient[];
}

export interface DiagnosisReview {
  id: number;
  aiDiagnosisId: number;
  doctorId: number;
  action: "Approve" | "Override";
  finalGrade: DrGrade;
  note: string | null;
  reviewedAt: string;
}

export interface DashboardStats {
  totalPatients: number;
  totalVisits: number;
  totalDiag: number;
  gradeDistribution: { grade: DrGrade; count: number }[];
  deferRate: number;
  referralYield: number;
  overrideRate: number;
}

export interface ProgressionData {
  fractalAndGrade: {
    createdAt: string;
    drGrade: DrGrade;
    fractalDimension: number | null;
    referable: boolean;
  }[];
  hba1c: { recordedAt: string; value: number }[];
}

export interface ConflictItem {
  id: number;
  patientId: number;
  filePath: string;
  eye: string;
  aiGrade: DrGrade;
  doctorGrade: DrGrade;
  confidence: number;
  crossTaskDisagreement: number;
  deferred: boolean;
  fractalDimension: number | null;
  modelVersion: string;
  reviewedAt: string;
}

export interface ConflictExport {
  count: number;
  items: ConflictItem[];
}

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string | null;
}

export interface ModelVersion {
  id: number;
  name: string;
  filePath: string | null;
  metrics: string | null;
  isActive: boolean;
  activatedAt: string | null;
  createdAt: string;
}

export interface ReviewPayload {
  action: "Approve" | "Override";
  finalGrade: DrGrade;
  note?: string;
}

// ---- staff user (admin management) ----
export interface StaffUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  licenseNo: string | null;
  isActive: boolean;
  createdAt: string;
}
export interface CreateStaffPayload {
  fullName: string;
  email: string;
  password: string;
  role: Role;
  licenseNo?: string;
}

// ---- patient create/update ----
export interface CreatePatientPayload {
  fullName: string;
  dateOfBirth?: string | null;
  gender?: string;
  phone?: string;
  address?: string;
  diabetesType?: string;
  diabetesDurationYears?: number | null;
}
export interface UpdatePatientPayload {
  fullName: string;
  phone?: string;
  address?: string;
  diabetesType?: string;
  diabetesDurationYears?: number | null;
}

// ---- visit ----
export interface CreateVisitPayload {
  patientId: number;
  doctorId?: number | null;
  visitDate?: string | null;
}
export interface CompleteVisitPayload {
  conclusion: string;
  referral?: string;
}

// ---- fundus ----
export interface FundusImage {
  id: number;
  patientId: number;
  visitId: number | null;
  eye: string;
  filePath: string;
  qualityStatus: string; // Pending | Gradable | Ungradable
  uploadedById: number;
  uploadedAt: string;
}
export interface UploadFundusPayload {
  patientId: number;
  visitId?: number | null;
  eye: string;
  filePath: string;
}

// ---- prescription ----
export interface PrescriptionItem {
  id?: number;
  drugName: string;
  dose?: string;
  frequency?: string;
  durationDays?: number | null;
}
export interface Prescription {
  id: number;
  patientId: number;
  visitId: number | null;
  issuedAt: string;
  note: string | null;
  items: PrescriptionItem[];
}
export interface CreatePrescriptionPayload {
  patientId: number;
  visitId?: number | null;
  note?: string;
  items: PrescriptionItem[];
}

// ---- appointment ----
export interface Appointment {
  id: number;
  patientId: number;
  doctorId: number | null;
  scheduledAt: string;
  status: string;
  reason: string | null;
  createdAt: string;
}

// ---- monitoring (doctor view) ----
export interface HealthMetric {
  id: number;
  patientId: number;
  metricType: string;
  value: number;
  unit: string | null;
  recordedAt: string;
}
export interface Adherence {
  total: number;
  taken: number;
  rate: number;
}
export interface SymptomReport {
  id: number;
  patientId: number;
  description: string;
  severity: string;
  adviceGiven: string | null;
  reportedAt: string;
}

// ---- blog / feedback ----
export interface BlogPost {
  id: number;
  authorId: number;
  title: string;
  body: string;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}
export interface CreateBlogPayload {
  title: string;
  body: string;
  isPublished: boolean;
}
export interface Feedback {
  id: number;
  patientId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}
