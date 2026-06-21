import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Examination,
  listExaminations,
  getExamination
} from "../api";
import ModuleResultCard from "../components/ModuleResultCard";

const MODULE_LABELS: Record<string, string> = {
  module1: "Module 1 - DR Grading",
  module2: "Module 2 - Lesion Segmentation",
  module3: "Module 3 - Fractal Dimension",
  module4: "Module 4 - OCT Classification",
  module5: "Module 5 - OCT Layer Segmentation"
};

export default function HistoryPage() {
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<Examination | null>(null);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadList();
  }, []);

  async function loadList() {
    setLoadingList(true);
    setError(null);
    try {
      const data = await listExaminations();
      setExaminations(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoadingList(false);
    }
  }

  // Re-reads one stored examination from MongoDB: the backend decodes the
  // saved Base64 string back into a data URI we can drop straight into <img>.
  async function openExamination(id: string) {
    setSelectedId(id);
    setLoadingDetail(true);
    setError(null);
    try {
      const { examination, imageDataUri } = await getExamination(id);
      setSelectedExam(examination);
      setSelectedImageUri(imageDataUri);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  const modulesForType = (type: "fundus" | "oct") =>
    type === "fundus" ? ["module1", "module2", "module3"] : ["module4", "module5"];

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Examination History</h1>
        <Link to="/" style={styles.backLink}>
          &larr; Back to upload
        </Link>
      </header>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.layout}>
        {/* Left: list of all past examinations, pulled from MongoDB */}
        <section style={styles.listCard}>
          <h2 style={styles.sectionTitle}>Past Examinations</h2>
          {loadingList && <p>Loading...</p>}
          {!loadingList && examinations.length === 0 && (
            <p style={styles.placeholder}>No examinations stored yet.</p>
          )}
          <ul style={styles.list}>
            {examinations.map((exam) => (
              <li
                key={exam._id}
                style={{
                  ...styles.listItem,
                  ...(selectedId === exam._id ? styles.listItemActive : {})
                }}
                onClick={() => openExamination(exam._id)}
              >
                <div style={styles.listItemTitle}>{exam.patientName}</div>
                <div style={styles.listItemMeta}>
                  {exam.imageType.toUpperCase()} &middot;{" "}
                  {new Date(exam.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Right: the selected examination's image (decoded from Base64) + results */}
        <section style={styles.detailCard}>
          <h2 style={styles.sectionTitle}>Details</h2>

          {!selectedId && <p style={styles.placeholder}>Select an examination on the left.</p>}
          {loadingDetail && <p>Loading image from database...</p>}

          {selectedExam && selectedImageUri && !loadingDetail && (
            <>
              <div style={styles.detailHeaderRow}>
                <img src={selectedImageUri} alt="stored examination" style={styles.detailImage} />
                <div>
                  <p>
                    <strong>Patient:</strong> {selectedExam.patientName}
                  </p>
                  <p>
                    <strong>Type:</strong> {selectedExam.imageType}
                  </p>
                  <p>
                    <strong>Uploaded:</strong>{" "}
                    {new Date(selectedExam.createdAt).toLocaleString()}
                  </p>
                  <p>
                    <strong>File:</strong> {selectedExam.originalFileName || "-"}
                  </p>
                </div>
              </div>

              <h3 style={styles.sectionTitle}>Previously run AI results</h3>
              <div style={styles.resultsGrid}>
                {modulesForType(selectedExam.imageType).map((key) => (
                  <ModuleResultCard
                    key={key}
                    moduleName={MODULE_LABELS[key]}
                    result={(selectedExam.results as any)[key]}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { margin: 0, color: "#1F3864" },
  backLink: { color: "#2E5395", textDecoration: "none", fontWeight: "bold" },
  layout: { display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 },
  listCard: { background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 16, height: "fit-content" },
  detailCard: { background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 16, minHeight: 300 },
  sectionTitle: { color: "#2E5395", marginTop: 0 },
  placeholder: { color: "#999", fontStyle: "italic" },
  list: { listStyle: "none", padding: 0, margin: 0 },
  listItem: {
    padding: 10,
    borderRadius: 6,
    cursor: "pointer",
    marginBottom: 6,
    border: "1px solid transparent"
  },
  listItemActive: {
    background: "#D9E2F3",
    border: "1px solid #2E5395"
  },
  listItemTitle: { fontWeight: "bold", fontSize: 14 },
  listItemMeta: { fontSize: 12, color: "#666" },
  detailHeaderRow: { display: "flex", gap: 20, marginBottom: 20, alignItems: "flex-start" },
  detailImage: { maxWidth: 280, borderRadius: 6, border: "1px solid #ccc" },
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
