import { useState } from "react";
import { Link } from "react-router-dom";
import { uploadExamination, runModule, Examination } from "../api";
import ModuleResultCard from "../components/ModuleResultCard";

const MODULES = [
  { id: 1, name: "Module 1 - DR Grading", modality: "fundus" },
  { id: 2, name: "Module 2 - Lesion Segmentation", modality: "fundus" },
  { id: 3, name: "Module 3 - Fractal Dimension", modality: "fundus" },
  { id: 4, name: "Module 4 - OCT Classification", modality: "oct" },
  { id: 5, name: "Module 5 - OCT Layer Segmentation", modality: "oct" }
];

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageType, setImageType] = useState<"fundus" | "oct">("fundus");
  const [patientName, setPatientName] = useState("Demo Patient");
  const [examination, setExamination] = useState<Examination | null>(null);
  const [loadingModule, setLoadingModule] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleModules = MODULES.filter((m) => m.modality === imageType);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setExamination(null);
    setError(null);
    if (selected) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const exam = await uploadExamination(file, imageType, patientName, []);
      setExamination(exam);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRunModule(moduleId: number) {
    if (!examination) return;
    setLoadingModule(moduleId);
    setError(null);
    try {
      const updated = await runModule(examination._id, moduleId);
      setExamination(updated);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoadingModule(null);
    }
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <h1 style={styles.title}>DiaCompanion - AI Demo</h1>
          <Link to="/history" style={styles.historyLink}>
            View History &rarr;
          </Link>
        </div>
        <p style={styles.subtitle}>
          Smart Diabetes &amp; Complications Tracker - Local demo build
        </p>
      </header>

      <section style={styles.card}>
        <h2 style={styles.sectionTitle}>1. Upload an image</h2>

        <div style={styles.row}>
          <label style={styles.label}>Patient name</label>
          <input
            style={styles.input}
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
          />
        </div>

        <div style={styles.row}>
          <label style={styles.label}>Image type</label>
          <select
            style={styles.input}
            value={imageType}
            onChange={(e) => setImageType(e.target.value as "fundus" | "oct")}
          >
            <option value="fundus">Fundus photograph (Modules 1-3)</option>
            <option value="oct">OCT B-scan (Modules 4-5)</option>
          </select>
        </div>

        <div style={styles.row}>
          <label style={styles.label}>Image file</label>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>

        {previewUrl && (
          <img src={previewUrl} alt="preview" style={styles.previewImage} />
        )}

        <button
          style={styles.primaryButton}
          disabled={!file || uploading}
          onClick={handleUpload}
        >
          {uploading ? "Uploading..." : "Upload to Examination"}
        </button>
      </section>

      {error && <div style={styles.errorBox}>{error}</div>}

      {examination && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>2. Run AI modules</h2>
          <div style={styles.moduleGrid}>
            {visibleModules.map((m) => (
              <button
                key={m.id}
                style={styles.moduleButton}
                disabled={loadingModule !== null}
                onClick={() => handleRunModule(m.id)}
              >
                {loadingModule === m.id ? "Running..." : `Run ${m.name}`}
              </button>
            ))}
          </div>

          <h2 style={styles.sectionTitle}>3. Results</h2>
          <div style={styles.resultsGrid}>
            {visibleModules.map((m) => (
              <ModuleResultCard
                key={m.id}
                moduleName={m.name}
                result={(examination.results as any)[`module${m.id}`]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 960, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif" },
  header: { marginBottom: 24 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  historyLink: { color: "#2E5395", textDecoration: "none", fontWeight: "bold" },
  title: { margin: 0, color: "#1F3864" },
  subtitle: { margin: 0, color: "#666" },
  card: {
    background: "#fff",
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 20,
    marginBottom: 20
  },
  sectionTitle: { color: "#2E5395", marginTop: 0 },
  row: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  label: { width: 140, fontWeight: "bold" },
  input: { flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 4 },
  previewImage: { maxWidth: 300, marginTop: 12, borderRadius: 4, border: "1px solid #ddd" },
  primaryButton: {
    marginTop: 12,
    padding: "10px 20px",
    background: "#1F3864",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer"
  },
  moduleGrid: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  moduleButton: {
    padding: "10px 16px",
    background: "#2E5395",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer"
  },
  resultsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  errorBox: {
    background: "#FCE4D6",
    border: "1px solid #D85A30",
    borderRadius: 6,
    padding: 12,
    marginBottom: 20,
    color: "#8a3a1f"
  }
};
