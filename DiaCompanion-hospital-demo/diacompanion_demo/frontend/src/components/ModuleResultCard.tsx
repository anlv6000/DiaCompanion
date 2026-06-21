interface Props {
  moduleName: string;
  result: any | null;
}

export default function ModuleResultCard({ moduleName, result }: Props) {
  if (!result) {
    return (
      <div style={styles.card}>
        <h3 style={styles.title}>{moduleName}</h3>
        <p style={styles.placeholder}>Not run yet.</p>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div style={styles.card}>
        <h3 style={styles.title}>{moduleName}</h3>
        <p style={styles.errorText}>Error: {result.message}</p>
      </div>
    );
  }

  const data = result.result || {};

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>{moduleName}</h3>

      {/* Generic key/value rendering for scalar fields */}
      <table style={styles.table}>
        <tbody>
          {Object.entries(data)
            .filter(([key, value]) => !key.toLowerCase().includes("base64") && typeof value !== "object")
            .map(([key, value]) => (
              <tr key={key}>
                <td style={styles.keyCell}>{key}</td>
                <td style={styles.valCell}>{String(value)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* Nested objects (e.g. lesionCounts, classProbabilities) */}
      {Object.entries(data)
        .filter(([_, value]) => typeof value === "object" && value !== null)
        .map(([key, value]) => (
          <div key={key} style={{ marginTop: 8 }}>
            <strong>{key}:</strong>
            <table style={styles.table}>
              <tbody>
                {Object.entries(value as Record<string, any>).map(([k, v]) => (
                  <tr key={k}>
                    <td style={styles.keyCell}>{k}</td>
                    <td style={styles.valCell}>{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* Any base64 image fields are rendered directly */}
      {Object.entries(data)
        .filter(([key, value]) => key.toLowerCase().includes("base64") && typeof value === "string")
        .map(([key, value]) => (
          <div key={key} style={{ marginTop: 8 }}>
            <p style={styles.imageLabel}>{key}</p>
            <img src={value as string} alt={key} style={styles.resultImage} />
          </div>
        ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 14,
    background: "#fafafa"
  },
  title: { margin: "0 0 8px 0", color: "#1F3864", fontSize: 16 },
  placeholder: { color: "#999", fontStyle: "italic" },
  errorText: { color: "#c0392b" },
  table: { width: "100%", fontSize: 13, borderCollapse: "collapse" },
  keyCell: { fontWeight: "bold", padding: "2px 6px", color: "#444", verticalAlign: "top" },
  valCell: { padding: "2px 6px", color: "#222" },
  imageLabel: { fontSize: 12, color: "#666", margin: "4px 0" },
  resultImage: { maxWidth: "100%", border: "1px solid #ccc", borderRadius: 4 }
};
