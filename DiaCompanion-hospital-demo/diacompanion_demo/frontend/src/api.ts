import axios from "axios";

export const API_BASE_URL = "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_BASE_URL
});

export interface ExaminationResults {
  module1: any | null;
  module2: any | null;
  module3: any | null;
  module4: any | null;
  module5: any | null;
}

export interface Examination {
  _id: string;
  patientName: string;
  imageType: "fundus" | "oct";
  imageBase64?: string;
  originalFileName?: string;
  results: ExaminationResults;
  createdAt: string;
  updatedAt: string;
}

export async function uploadExamination(
  file: File,
  imageType: "fundus" | "oct",
  patientName: string,
  modulesToRun: number[]
): Promise<Examination> {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("imageType", imageType);
  formData.append("patientName", patientName);
  if (modulesToRun.length > 0) {
    formData.append("modules", modulesToRun.join(","));
  }

  const res = await api.post("/examinations", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data.examination;
}

export async function runModule(
  examinationId: string,
  moduleNumber: number
): Promise<Examination> {
  const res = await api.post(`/examinations/${examinationId}/run/${moduleNumber}`);
  return res.data.examination;
}

export async function listExaminations(): Promise<Examination[]> {
  const res = await api.get("/examinations");
  return res.data.examinations;
}

export async function getExamination(id: string): Promise<{ examination: Examination; imageDataUri: string }> {
  const res = await api.get(`/examinations/${id}`);
  return res.data;
}
