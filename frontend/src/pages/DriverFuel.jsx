import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/driver/fuel-requests";

const BADGE = {
  pending: "maintenance", approved: "active", rejected: "offline", cancelled: "idle",
};

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

function DriverFuel() {
  const [vehicles, setVehicles] = useState([]);
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState({
    vehicle_id: "", fuel_type: "diesel", requested_liters: "", odometer_km: "", purpose: "", notes: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([axios.get("http://localhost:8000/api/driver/vehicles"), axios.get(API)])
      .then(([v, r]) => {
        setVehicles(v.data);
        setRows(r.data);
        setForm((f) => (f.vehicle_id || !v.data.length ? f : {
          ...f, vehicle_id: String(v.data[0].id), odometer_km: v.data[0].odometer_km,
        }));
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
      .post(API, {
        vehicle_id: Number(form.vehicle_id),
        fuel_type: form.fuel_type,
        requested_liters: Number(form.requested_liters),
        odometer_km: Number(form.odometer_km) || 0,
        purpose: form.purpose || null,
        notes: form.notes || null,
      })
      .then(() => {
        setForm({ ...form, requested_liters: "", purpose: "", notes: "" });
        setMessage("Request sent. Your manager has been notified.");
        load();
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };

  const cancel = (r) => {
    if (!window.confirm("Cancel this request?")) return;
    axios.put(`${API}/${r.id}/cancel`).then(load).catch((err) => setError(errorText(err)));
  };

  if (!rows) return error ? <div className="error-box">{error}</div> : <p>Loading...</p>;

  return (
    <div>
      <h2>Fuel requests</h2>

      {vehicles.length === 0 ? (
        <p className="muted">No vehicle is assigned to you, so you cannot request fuel.</p>
      ) : (
        <div className="chart-card" style={{ maxWidth: 560, marginBottom: "1.5rem" }}>
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
              <label>Fuel type</label>
              <select value={form.fuel_type} onChange={set("fuel_type")}>
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
              </select>
            </div>
            <div><label>Liters requested *</label><input type="number" min="0" step="0.1" value={form.requested_liters} onChange={set("requested_liters")} /></div>
            <div><label>Current odometer (km)</label><input type="number" min="0" value={form.odometer_km} onChange={set("odometer_km")} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label>Purpose / trip</label><input value={form.purpose} onChange={set("purpose")} placeholder="For example: trip to Adama" /></div>
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
            <tr><th>Time (EAT)</th><th>Vehicle</th><th>Requested</th><th>Approved</th><th>Status</th><th>Manager's answer</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="7" className="muted">No requests yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.requested_liters} L</td>
                <td>{r.approved_liters ? `${r.approved_liters} L` : "-"}</td>
                <td><span className={`badge ${BADGE[r.status]}`}>{r.status}</span></td>
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

export default DriverFuel;