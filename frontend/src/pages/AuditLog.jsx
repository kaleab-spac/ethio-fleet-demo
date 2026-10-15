import { useEffect, useState } from "react";
import axios from "axios";

function formatTime(iso) {
  return new Date(iso + "Z").toLocaleString("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AuditLog() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/audit/", { params: { limit: 200 } })
      .then((res) => setRows(res.data))
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="error-box">Cannot load the audit log.</div>;
  if (!rows) return <p>Loading...</p>;

  return (
    <div>
      <h2>Audit log ({rows.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time (EAT)</th><th>Who</th><th>Action</th><th>Details</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="4" className="muted">Nothing recorded yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.actor_name || "-"}</td>
                <td>{r.action}</td>
                <td style={{ whiteSpace: "normal" }}>{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AuditLog;