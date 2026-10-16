import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/driver/";

const BADGE = {
  pending: "maintenance", approved: "active", rejected: "offline", scheduled: "medium",
  in_progress: "medium", completed: "active", cancelled: "idle",
};
const CATEGORIES = [
  ["oil_change", "Oil change"], ["brakes", "Brakes"], ["tires", "Tires"], ["engine", "Engine"],
  ["electrical", "Electrical"], ["body", "Body"], ["inspection", "Inspection"], ["other", "Other"],
];

const today = () => new Date().toISOString().slice(0, 10);
const label = (s) => s.replace("_", " ");

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
  return "Could not send the request.";
}

function DriverMaintenance() {
  const [vehicles, setVehicles] = useState([]);
  const [defects, setDefects] = useState([]);
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({
    vehicle_id: "", category: "oil_change", urgency: "medium", odometer_km: "",
    preferred_date: "", defect_id: "", description: "", notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([
      axios.get(API + "vehicles"),
      axios.get(API + "maintenance-requests"),
      axios.get(API + "defects"),
    ])
      .then(([v, r, d]) => {
        setVehicles(v.data);
        setRows(r.data);
        setDefects(d.data);
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

  // Defects that are still open and not already used by an active request
  const usedDefects = (rows || [])
    .filter((r) => ["pending", "approved", "scheduled", "in_progress"].includes(r.status) && r.defect_id)
    .map((r) => r.defect_id);
  const linkable = defects.filter(
    (d) => String(d.vehicle_id) === String(form.vehicle_id) &&
      !["closed", "rejected"].includes(d.status) && !usedDefects.includes(d.id)
  );

  const submit = () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const body = {
      vehicle_id: Number(form.vehicle_id),
      category: form.category,
      urgency: form.urgency,
      description: form.description,
      odometer_km: Number(form.odometer_km) || 0,
      notes: form.notes || null,
    };
    if (form.preferred_date) body.preferred_date = form.preferred_date;
    if (form.defect_id) body.defect_id = Number(form.defect_id);
    axios
      .post(API + "maintenance-requests", body)
      .then(() => {
        setForm({ ...form, description: "", notes: "", preferred_date: "", defect_id: "", urgency: "medium" });
        setMessage("Request sent. Your manager has been notified.");
        load();
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };

  const cancel = (r) => {
    if (!window.confirm("Cancel this request?")) return;
    axios.put(`${API}maintenance-requests/${r.id}/cancel`).then(load).catch((err) => setError(errorText(err)));
  };

  if (!rows) return error ? <div className="error-box">{error}</div> : <p>Loading...</p>;

  return (
    <div>
      <h2>Maintenance requests</h2>

      {vehicles.length === 0 ? (
        <p className="muted">No vehicle is assigned to you, so you cannot request maintenance.</p>
      ) : (
        <div className="chart-card" style={{ maxWidth: 640, marginBottom: "1.5rem" }}>
          {message && <div className="success-box">{message}</div>}
          {error && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{error}</div>}
          <div className="form-grid">
            <div>
              <label>Vehicle</label>
              <select value={form.vehicle_id} onChange={(e) => setForm({ ...form, vehicle_id: e.target.value, defect_id: "" })}>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}
              </select>
            </div>
            <div>
              <label>Type of service</label>
              <select value={form.category} onChange={set("category")}>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label>Urgency</label>
              <select value={form.urgency} onChange={set("urgency")}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div><label>Current odometer (km)</label><input type="number" min="0" value={form.odometer_km} onChange={set("odometer_km")} /></div>
            <div><label>Preferred date</label><input type="date" min={today()} value={form.preferred_date} onChange={set("preferred_date")} /></div>
            <div>
              <label>Related defect report</label>
              <select value={form.defect_id} onChange={set("defect_id")}>
                <option value="">None</option>
                {linkable.map((d) => (
                  <option key={d.id} value={d.id}>#{d.id} ({d.severity}): {d.description.slice(0, 40)}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>What does the vehicle need? *</label>
              <textarea
                rows="3" value={form.description} onChange={set("description")}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #cbd5e1", borderRadius: 6, fontFamily: "inherit" }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}><label>Notes</label><input value={form.notes} onChange={set("notes")} /></div>
          </div>
          <div className="modal-actions">
            <button className="btn" disabled={busy} onClick={submit}>{busy ? "Sending..." : "Send request"}</button>
          </div>
        </div>
      )}

      <div className="section-title">MY REQUESTS ({rows.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time (EAT)</th><th>Vehicle</th><th>Service</th><th>Urgency</th><th>Status</th><th>Schedule</th><th>Manager's message</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="8" className="muted">No requests yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.vehicle_name}</td>
                <td>{label(r.category)}</td>
                <td>{r.urgency}</td>
                <td><span className={`badge ${BADGE[r.status]}`}>{label(r.status)}</span></td>
                <td style={{ whiteSpace: "normal" }}>{r.scheduled_date ? `${r.scheduled_date}, ${r.provider}` : "-"}</td>
                <td style={{ whiteSpace: "normal" }}>{r.decision_reason || "-"}</td>
                <td>{r.status === "pending" && <button className="btn secondary" onClick={() => cancel(r)}>Cancel</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DriverMaintenance;