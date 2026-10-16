import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/driver/";

const STATUS_BADGE = {
  open: "high", acknowledged: "medium", in_progress: "medium",
  resolved: "active", closed: "idle", rejected: "idle",
};

const CATEGORIES = ["brakes", "engine", "tires", "electrical", "body", "steering", "other"];

function formatTime(iso) {
  return new Date(iso + "Z").toLocaleString("en-GB", {
    timeZone: "Africa/Addis_Ababa", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

function errorText(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join("; ");
  return "Could not send the report.";
}

const label = (s) => s.replace("_", " ");

function DriverDefects() {
  const [vehicles, setVehicles] = useState([]);
  const [reports, setReports] = useState(null);
  const [form, setForm] = useState({
    vehicle_id: "", category: "", severity: "medium", odometer_km: "", description: "",
  });
  const [detail, setDetail] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([axios.get(API + "vehicles"), axios.get(API + "defects")])
      .then(([v, r]) => {
        setVehicles(v.data);
        setReports(r.data);
        if (v.data.length) {
          setForm((f) => (f.vehicle_id ? f : { ...f, vehicle_id: String(v.data[0].id), odometer_km: v.data[0].odometer_km }));
        }
      })
      .catch(() => setError("Cannot load data."));

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    axios
      .post(API + "defects", {
        vehicle_id: Number(form.vehicle_id),
        description: form.description,
        severity: form.severity,
        category: form.category || null,
        odometer_km: form.odometer_km === "" ? null : Number(form.odometer_km),
      })
      .then(() => {
        setForm({ ...form, description: "", category: "", severity: "medium" });
        setMessage(
          form.severity === "critical"
            ? "Critical report sent. Your manager has been alerted. Do not drive the vehicle until they confirm it is safe."
            : "Report sent. Your manager has been notified."
        );
        load();
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };

  const openDetail = (id) =>
    axios.get(`${API}defects/${id}`).then((res) => setDetail(res.data)).catch(() => setError("Cannot load the report."));

  if (!reports) return error ? <div className="error-box">{error}</div> : <p>Loading...</p>;

  return (
    <div>
      <h2>Report a defect</h2>

      {vehicles.length === 0 ? (
        <p className="muted">No vehicle is assigned to you, so you cannot report a defect.</p>
      ) : (
        <div className="chart-card" style={{ maxWidth: 640, marginBottom: "1.5rem" }}>
          {message && <div className="success-box">{message}</div>}
          {error && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{error}</div>}
          <div className="form-grid">
            <div>
              <label>Vehicle</label>
              <select value={form.vehicle_id} onChange={set("vehicle_id")}>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}
              </select>
            </div>
            <div>
              <label>Category</label>
              <select value={form.category} onChange={set("category")}>
                <option value="">Choose...</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>How serious is it?</label>
              <select value={form.severity} onChange={set("severity")}>
                <option value="low">Low - can wait</option>
                <option value="medium">Medium</option>
                <option value="high">High - needs attention soon</option>
                <option value="critical">Critical - unsafe to drive</option>
              </select>
            </div>
            <div>
              <label>Odometer (km)</label>
              <input type="number" min="0" value={form.odometer_km} onChange={set("odometer_km")} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>What is wrong? *</label>
              <textarea
                rows="4" value={form.description} onChange={set("description")}
                placeholder="For example: brake pedal feels soft, warning light is on..."
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: 6, fontFamily: "inherit" }}
              />
            </div>
          </div>
          {form.severity === "critical" && (
            <div className="warn-box">
              Critical: your vehicle will be marked out of service and your manager alerted immediately.
              Do not drive it.
            </div>
          )}
          <div className="modal-actions">
            <button className="btn" disabled={busy} onClick={submit}>{busy ? "Sending..." : "Send report"}</button>
          </div>
        </div>
      )}

      <div className="section-title">MY REPORTS ({reports.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time (EAT)</th><th>Vehicle</th><th>Severity</th><th>Description</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {reports.length === 0 && <tr><td colSpan="6" className="muted">No reports yet.</td></tr>}
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.vehicle_name}</td>
                <td><span className={`badge ${r.severity}`}>{r.severity}</span></td>
                <td style={{ whiteSpace: "normal" }}>{r.description}</td>
                <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{label(r.status)}</span></td>
                <td><button className="btn" onClick={() => openDetail(r.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="modal-back">
          <div className="modal wide">
            <h3>
              Report #{detail.id}: {detail.vehicle_name}{" "}
              <span className={`badge ${STATUS_BADGE[detail.status]}`}>{label(detail.status)}</span>
            </h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{detail.description}</p>
            {detail.resolution && (
              <div className="success-box"><strong>Manager's answer:</strong> {detail.resolution}</div>
            )}
            {detail.severity === "critical" && !["closed", "rejected"].includes(detail.status) && (
              <div className="warn-box">
                Critical report. Do not treat this vehicle as safe until your manager confirms it.
              </div>
            )}

            <div className="section-title">PROGRESS</div>
            <ul className="timeline">
              {detail.history.map((h) => (
                <li key={h.id}>
                  <strong>{h.from_status ? `${label(h.from_status)} → ${label(h.to_status)}` : "Reported"}</strong>
                  {h.note ? `: ${h.note}` : ""}
                  <div className="when">{formatTime(h.created_at)}</div>
                </li>
              ))}
            </ul>

            <div className="section-title">MESSAGES FROM YOUR MANAGER</div>
            {detail.comments.length === 0 && <p className="muted">No messages yet.</p>}
            {detail.comments.map((c) => (
              <div key={c.id} className="comment-box">
                <div className="who">{c.author_name} · {formatTime(c.created_at)}</div>
                {c.body}
              </div>
            ))}

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverDefects;