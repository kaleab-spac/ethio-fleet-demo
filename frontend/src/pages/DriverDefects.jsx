import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/driver/";

function formatTime(iso) {
  return new Date(iso + "Z").toLocaleString("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DriverDefects() {
  const [vehicles, setVehicles] = useState([]);
  const [reports, setReports] = useState(null);
  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([axios.get(API + "vehicles"), axios.get(API + "defects")])
      .then(([v, r]) => {
        setVehicles(v.data);
        setReports(r.data);
        if (v.data.length && !vehicleId) setVehicleId(String(v.data[0].id));
      })
      .catch(() => setError("Cannot load data."));

  useEffect(() => {
    load();
  }, []);

  const submit = () => {
    setError("");
    setMessage("");
    axios
      .post(API + "defects", {
        vehicle_id: Number(vehicleId),
        description,
        severity,
      })
      .then(() => {
        setDescription("");
        setMessage("Report sent. Your manager has been notified.");
        load();
      })
      .catch((err) => {
        const d = err.response?.data?.detail;
        setError(
          typeof d === "string"
            ? d
            : "Please describe the problem (at least 5 characters)."
        );
      });
  };

  if (!reports) return error ? <div className="error-box">{error}</div> : <p>Loading...</p>;

  return (
    <div>
      <h2>Report a defect</h2>

      {vehicles.length === 0 ? (
        <p className="muted">No vehicle is assigned to you, so you cannot report a defect.</p>
      ) : (
        <div className="chart-card" style={{ maxWidth: 560, marginBottom: "1.5rem" }}>
          {message && <div className="success-box">{message}</div>}
          {error && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{error}</div>}
          <div className="form-grid">
            <div>
              <label>Vehicle</label>
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>
                ))}
              </select>
            </div>
            <div>
              <label>How serious is it?</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="low">Low - can wait</option>
                <option value="medium">Medium</option>
                <option value="high">High - unsafe to drive</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>What is wrong?</label>
              <textarea
                rows="4"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="For example: brakes feel soft, warning light is on..."
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: 6, fontFamily: "inherit" }}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={submit}>Send report</button>
          </div>
        </div>
      )}

      <div className="section-title">MY REPORTS ({reports.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time (EAT)</th><th>Vehicle</th><th>Severity</th><th>Description</th><th>Status</th></tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr><td colSpan="5" className="muted">No reports yet.</td></tr>
            )}
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.vehicle_name}</td>
                <td><span className={`badge ${r.severity}`}>{r.severity}</span></td>
                <td style={{ whiteSpace: "normal" }}>{r.description}</td>
                <td>{r.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DriverDefects;