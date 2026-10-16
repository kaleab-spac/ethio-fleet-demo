import { useEffect, useState } from "react";
import axios from "axios";

const REQ_API = "http://localhost:8000/api/driver/fuel-requests";
const FILL_API = "http://localhost:8000/api/driver/fill-ups";

const REQ_BADGE = {
  pending: "maintenance", approved: "active", rejected: "offline", cancelled: "idle",
  fulfilled: "active", partially_fulfilled: "medium",
};
const FILL_BADGE = {
  submitted: "maintenance", verified: "active", needs_correction: "medium", rejected: "offline",
};

const today = () => new Date().toISOString().slice(0, 10);

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
  return "Could not send.";
}

const etb = (n) => `${Math.round(n).toLocaleString()} ETB`;

function DriverFuel() {
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState(null);
  const [fillups, setFillups] = useState([]);
  const [reqForm, setReqForm] = useState({
    vehicle_id: "", fuel_type: "diesel", requested_liters: "", odometer_km: "", purpose: "", notes: "",
  });
  const [fillForm, setFillForm] = useState({
    vehicle_id: "", request_id: "", fuel_date: today(), liters: "", price_per_liter_etb: "",
    odometer_km: "", station: "", notes: "",
  });
  const [fix, setFix] = useState(null); // fill-up being corrected
  const [fixError, setFixError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fillError, setFillError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([
      axios.get("http://localhost:8000/api/driver/vehicles"),
      axios.get(REQ_API),
      axios.get(FILL_API),
    ])
      .then(([v, r, f]) => {
        setVehicles(v.data);
        setRequests(r.data);
        setFillups(f.data);
        if (v.data.length) {
          const id = String(v.data[0].id);
          setReqForm((x) => (x.vehicle_id ? x : { ...x, vehicle_id: id, odometer_km: v.data[0].odometer_km }));
          setFillForm((x) => (x.vehicle_id ? x : { ...x, vehicle_id: id }));
        }
      })
      .catch(() => setError("Cannot load data."));

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const setReq = (k) => (e) => setReqForm({ ...reqForm, [k]: e.target.value });
  const setFill = (k) => (e) => setFillForm({ ...fillForm, [k]: e.target.value });

  const sendRequest = () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    axios
      .post(REQ_API, {
        vehicle_id: Number(reqForm.vehicle_id),
        fuel_type: reqForm.fuel_type,
        requested_liters: Number(reqForm.requested_liters),
        odometer_km: Number(reqForm.odometer_km) || 0,
        purpose: reqForm.purpose || null,
        notes: reqForm.notes || null,
      })
      .then(() => {
        setReqForm({ ...reqForm, requested_liters: "", purpose: "", notes: "" });
        setMessage("Request sent. Your manager has been notified.");
        load();
      })
      .catch((err) => setError(errorText(err)))
      .finally(() => setBusy(false));
  };

  const cancel = (r) => {
    if (!window.confirm("Cancel this request?")) return;
    axios.put(`${REQ_API}/${r.id}/cancel`).then(load).catch((err) => setError(errorText(err)));
  };

  // Requests that can still receive a fill-up
  const openRequests = (requests || []).filter(
    (r) => ["approved", "partially_fulfilled"].includes(r.status) &&
      String(r.vehicle_id) === String(fillForm.vehicle_id)
  );

  const pickRequest = (e) => {
    const id = e.target.value;
    const req = openRequests.find((r) => String(r.id) === id);
    setFillForm({
      ...fillForm,
      request_id: id,
      liters: req && req.approved_liters ? req.approved_liters : fillForm.liters,
    });
  };

  const liveTotal = (Number(fillForm.liters) || 0) * (Number(fillForm.price_per_liter_etb) || 0);

  const sendFillup = () => {
    if (busy) return;
    setBusy(true);
    setFillError("");
    setMessage("");
    axios
      .post(FILL_API, {
        vehicle_id: Number(fillForm.vehicle_id),
        request_id: fillForm.request_id ? Number(fillForm.request_id) : null,
        fuel_date: fillForm.fuel_date,
        liters: Number(fillForm.liters),
        price_per_liter_etb: Number(fillForm.price_per_liter_etb),
        odometer_km: Number(fillForm.odometer_km),
        station: fillForm.station || null,
        notes: fillForm.notes || null,
      })
      .then(() => {
        setFillForm({ ...fillForm, request_id: "", liters: "", price_per_liter_etb: "", odometer_km: "", station: "", notes: "" });
        setMessage("Fill-up sent for verification. It counts as an expense once your manager verifies it.");
        load();
      })
      .catch((err) => setFillError(errorText(err)))
      .finally(() => setBusy(false));
  };

  const saveFix = () => {
    if (busy) return;
    setBusy(true);
    axios
      .put(`${FILL_API}/${fix.id}`, {
        fuel_date: fix.fuel_date,
        liters: Number(fix.liters),
        price_per_liter_etb: Number(fix.price_per_liter_etb),
        odometer_km: Number(fix.odometer_km),
        station: fix.station || null,
        notes: fix.notes || null,
      })
      .then(() => {
        setFix(null);
        setMessage("Correction sent for verification.");
        load();
      })
      .catch((err) => setFixError(errorText(err)))
      .finally(() => setBusy(false));
  };

  if (!requests) return error ? <div className="error-box">{error}</div> : <p>Loading...</p>;

  const fixTotal = fix ? (Number(fix.liters) || 0) * (Number(fix.price_per_liter_etb) || 0) : 0;

  return (
    <div>
      <h2>Fuel</h2>
      {message && <div className="success-box">{message}</div>}

      {vehicles.length === 0 ? (
        <p className="muted">No vehicle is assigned to you, so you cannot request or record fuel.</p>
      ) : (
        <div className="chart-grid">
          <div className="chart-card">
            <h3>1. Request fuel approval</h3>
            {error && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{error}</div>}
            <div className="form-grid">
              <div>
                <label>Vehicle</label>
                <select value={reqForm.vehicle_id} onChange={setReq("vehicle_id")}>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}
                </select>
              </div>
              <div>
                <label>Fuel type</label>
                <select value={reqForm.fuel_type} onChange={setReq("fuel_type")}>
                  <option value="diesel">Diesel</option>
                  <option value="petrol">Petrol</option>
                </select>
              </div>
              <div><label>Liters requested *</label><input type="number" min="0" step="0.1" value={reqForm.requested_liters} onChange={setReq("requested_liters")} /></div>
              <div><label>Current odometer (km)</label><input type="number" min="0" value={reqForm.odometer_km} onChange={setReq("odometer_km")} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Purpose / trip</label><input value={reqForm.purpose} onChange={setReq("purpose")} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Notes</label><input value={reqForm.notes} onChange={setReq("notes")} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn" disabled={busy} onClick={sendRequest}>Send request</button>
            </div>
          </div>

          <div className="chart-card">
            <h3>2. Record the actual fill-up</h3>
            {fillError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{fillError}</div>}
            <div className="form-grid">
              <div>
                <label>Vehicle</label>
                <select value={fillForm.vehicle_id} onChange={(e) => setFillForm({ ...fillForm, vehicle_id: e.target.value, request_id: "" })}>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}
                </select>
              </div>
              <div>
                <label>Approved request</label>
                <select value={fillForm.request_id} onChange={pickRequest}>
                  <option value="">No request</option>
                  {openRequests.map((r) => (
                    <option key={r.id} value={r.id}>#{r.id}: {r.approved_liters} L approved</option>
                  ))}
                </select>
              </div>
              <div><label>Date *</label><input type="date" max={today()} value={fillForm.fuel_date} onChange={setFill("fuel_date")} /></div>
              <div><label>Odometer (km) *</label><input type="number" min="0" value={fillForm.odometer_km} onChange={setFill("odometer_km")} /></div>
              <div><label>Actual liters *</label><input type="number" min="0" step="0.1" value={fillForm.liters} onChange={setFill("liters")} /></div>
              <div><label>Price per liter (ETB) *</label><input type="number" min="0" step="0.01" value={fillForm.price_per_liter_etb} onChange={setFill("price_per_liter_etb")} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Fuel station</label><input value={fillForm.station} onChange={setFill("station")} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Notes</label><input value={fillForm.notes} onChange={setFill("notes")} /></div>
              <div style={{ gridColumn: "1 / -1", fontWeight: 600 }}>
                Total cost: {etb(liveTotal)} <span className="muted">(the server recalculates it)</span>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" disabled={busy} onClick={sendFillup}>Send for verification</button>
            </div>
          </div>
        </div>
      )}

      <div className="section-title">MY REQUESTS ({requests.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time (EAT)</th><th>Vehicle</th><th>Requested</th><th>Approved</th><th>Status</th><th>Manager's answer</th><th></th></tr>
          </thead>
          <tbody>
            {requests.length === 0 && <tr><td colSpan="7" className="muted">No requests yet.</td></tr>}
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.requested_liters} L</td>
                <td>{r.approved_liters ? `${r.approved_liters} L` : "-"}</td>
                <td><span className={`badge ${REQ_BADGE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                <td style={{ whiteSpace: "normal" }}>{r.decision_reason || "-"}</td>
                <td>{r.status === "pending" && <button className="btn secondary" onClick={() => cancel(r)}>Cancel</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">MY FILL-UPS ({fillups.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Date</th><th>Vehicle</th><th>Liters</th><th>Total</th><th>Odometer</th><th>Status</th><th>Manager's note</th><th></th></tr>
          </thead>
          <tbody>
            {fillups.length === 0 && <tr><td colSpan="8" className="muted">No fill-ups yet.</td></tr>}
            {fillups.map((f) => (
              <tr key={f.id}>
                <td>{f.fuel_date}</td>
                <td>{f.vehicle_name}</td>
                <td>{f.liters} L</td>
                <td>{etb(f.total_cost_etb)}</td>
                <td>{Math.round(f.odometer_km).toLocaleString()} km</td>
                <td><span className={`badge ${FILL_BADGE[f.status]}`}>{f.status.replace("_", " ")}</span></td>
                <td style={{ whiteSpace: "normal" }}>{f.review_reason || "-"}</td>
                <td>
                  {f.status === "needs_correction" && (
                    <button className="btn" onClick={() => { setFix({ ...f, station: f.station || "", notes: f.notes || "" }); setFixError(""); }}>
                      Correct
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fix && (
        <div className="modal-back">
          <div className="modal">
            <h3>Correct fill-up</h3>
            {fix.review_reason && <p className="muted">Manager's note: {fix.review_reason}</p>}
            {fixError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{fixError}</div>}
            <div className="form-grid">
              <div><label>Date</label><input type="date" max={today()} value={fix.fuel_date} onChange={(e) => setFix({ ...fix, fuel_date: e.target.value })} /></div>
              <div><label>Odometer (km)</label><input type="number" min="0" value={fix.odometer_km} onChange={(e) => setFix({ ...fix, odometer_km: e.target.value })} /></div>
              <div><label>Liters</label><input type="number" min="0" step="0.1" value={fix.liters} onChange={(e) => setFix({ ...fix, liters: e.target.value })} /></div>
              <div><label>Price per liter (ETB)</label><input type="number" min="0" step="0.01" value={fix.price_per_liter_etb} onChange={(e) => setFix({ ...fix, price_per_liter_etb: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Station</label><input value={fix.station} onChange={(e) => setFix({ ...fix, station: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Notes</label><input value={fix.notes} onChange={(e) => setFix({ ...fix, notes: e.target.value })} /></div>
              <div style={{ gridColumn: "1 / -1", fontWeight: 600 }}>Total cost: {etb(fixTotal)}</div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setFix(null)}>Cancel</button>
              <button className="btn" disabled={busy} onClick={saveFix}>Send correction</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverFuel;