import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/fuel/";

const etb = (n) => `${Math.round(n).toLocaleString()} ETB`;
const today = () => new Date().toISOString().slice(0, 10);

function errorText(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join("; ");
  return "Could not save. Check the fields.";
}

function Fuel() {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState({ vehicle_id: "", date_from: "", date_to: "" });
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const isAdmin = getUser()?.role === "admin";

  const load = () => {
    const params = {};
    if (filters.vehicle_id) params.vehicle_id = filters.vehicle_id;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    return Promise.all([
      axios.get(API + "summary", { params }),
      axios.get(API, { params }),
      axios.get("http://localhost:8000/api/vehicles/"),
    ])
      .then(([s, l, v]) => {
        setSummary(s.data);
        setLogs(l.data);
        setVehicles(v.data);
        setError(false);
      })
      .catch(() => setError(true));
  };

  useEffect(() => {
    load();
  }, [filters]);

  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const openAdd = () => {
    setForm({
      vehicle_id: vehicles[0] ? String(vehicles[0].id) : "",
      fuel_date: today(), liters: "", price_per_liter_etb: "", odometer_km: "",
    });
    setEditId(null);
    setFormError("");
  };

  const openEdit = (l) => {
    setForm({
      vehicle_id: String(l.vehicle_id), fuel_date: l.fuel_date, liters: l.liters,
      price_per_liter_etb: l.price_per_liter_etb, odometer_km: l.odometer_km,
    });
    setEditId(l.id);
    setFormError("");
  };

  const save = () => {
    const body = {
      vehicle_id: Number(form.vehicle_id),
      fuel_date: form.fuel_date,
      liters: Number(form.liters),
      price_per_liter_etb: Number(form.price_per_liter_etb),
      odometer_km: Number(form.odometer_km) || 0,
    };
    const request = editId ? axios.put(API + editId, body) : axios.post(API, body);
    request
      .then(() => {
        setForm(null);
        setMessage(editId ? "Fill-up updated." : "Fill-up added.");
        load();
      })
      .catch((err) => setFormError(errorText(err)));
  };

  const remove = (l) => {
    if (!window.confirm(`Delete the ${l.fuel_date} fill-up for ${l.vehicle_name}?`)) return;
    axios
      .delete(API + l.id)
      .then(() => {
        setMessage("Fill-up deleted.");
        load();
      })
      .catch(() => setMessage("Could not delete."));
  };

  if (error) {
    return <div className="error-box">Cannot load data. Check that the backend is running on port 8000.</div>;
  }
  if (!summary || !logs) return <p>Loading...</p>;

  const ranked = [...summary.vehicles].sort(
    (a, b) => (b.cost_per_km_etb ?? -1) - (a.cost_per_km_etb ?? -1)
  );
  const flagged = logs.filter((l) => l.flags && l.flags.length).length;
  const liveTotal = (Number(form?.liters) || 0) * (Number(form?.price_per_liter_etb) || 0);

  return (
    <div>
      <div className="page-head">
        <h2>Fuel</h2>
        {isAdmin && <button className="btn" onClick={openAdd}>+ Add fill-up</button>}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "0.75rem 0", alignItems: "end" }}>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, auto)" }}>
          <div>
            <label>Vehicle</label>
            <select value={filters.vehicle_id} onChange={setFilter("vehicle_id")}>
              <option value="">All vehicles</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div><label>From</label><input type="date" value={filters.date_from} onChange={setFilter("date_from")} /></div>
          <div><label>To</label><input type="date" value={filters.date_to} onChange={setFilter("date_to")} /></div>
        </div>
        {(filters.vehicle_id || filters.date_from || filters.date_to) && (
          <button className="btn secondary" onClick={() => setFilters({ vehicle_id: "", date_from: "", date_to: "" })}>
            Clear filters
          </button>
        )}
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="cards">
        <div className="card orange">
          <div className="label">Fuel cost (selection)</div>
          <div className="value" style={{ fontSize: "1.4rem" }}>{etb(summary.total_cost_etb)}</div>
        </div>
        <div className="card">
          <div className="label">Liters (selection)</div>
          <div className="value">{Math.round(summary.total_liters)}</div>
        </div>
        <div className="card grey">
          <div className="label">Fill-ups</div>
          <div className="value">{logs.length}</div>
        </div>
        <div className={`card ${flagged ? "red" : "green"}`}>
          <div className="label">Need review</div>
          <div className="value">{flagged}</div>
        </div>
      </div>

      <div className="section-title">COST PER KM (HIGHEST FIRST)</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vehicle</th><th>Fill-ups</th><th>Liters</th><th>Distance (km)</th>
              <th>Total cost</th><th>Cost per km</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 && <tr><td colSpan="6" className="muted">No fuel records.</td></tr>}
            {ranked.map((v) => (
              <tr key={v.vehicle_id}>
                <td>{v.vehicle_name}</td>
                <td>{v.fill_ups}</td>
                <td>{Math.round(v.total_liters)}</td>
                <td>{v.cost_per_km_etb === null ? "n/a" : Math.round(v.distance_km).toLocaleString()}</td>
                <td>{etb(v.total_cost_etb)}</td>
                <td style={{ fontWeight: 600 }}>
                  {v.cost_per_km_etb === null ? <span className="muted">n/a</span> : `${v.cost_per_km_etb.toFixed(2)} ETB`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chart-note">
        Cost per km = cost of all measured fill-ups except the earliest, divided by the distance
        between the lowest and highest odometer reading. Entries flagged for review are left out.
      </div>

      <div className="section-title">FUEL HISTORY ({logs.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Vehicle</th><th>Liters</th><th>Price / liter</th>
              <th>Total</th><th>Odometer (km)</th><th>Review</th>{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan="8" className="muted">No fuel records.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.fuel_date}</td>
                <td>{l.vehicle_name}</td>
                <td>{l.liters}</td>
                <td>{l.price_per_liter_etb.toFixed(2)} ETB</td>
                <td>{etb(l.total_cost_etb)}</td>
                <td>{Math.round(l.odometer_km).toLocaleString()}</td>
                <td>
                  {l.flags && l.flags.length > 0 ? (
                    <span className="badge offline" title={l.flags.join("; ")}>Check</span>
                  ) : (
                    <span className="muted">OK</span>
                  )}
                </td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    <button className="btn" onClick={() => openEdit(l)}>Edit</button>
                    <button className="btn danger" onClick={() => remove(l)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-back">
          <div className="modal">
            <h3>{editId ? "Edit fill-up" : "Add fill-up"}</h3>
            {formError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{formError}</div>}
            <div className="form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Vehicle *</label>
                <select value={form.vehicle_id} onChange={set("vehicle_id")}>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}
                </select>
              </div>
              <div><label>Date *</label><input type="date" max={today()} value={form.fuel_date} onChange={set("fuel_date")} /></div>
              <div><label>Odometer (km)</label><input type="number" min="0" value={form.odometer_km} onChange={set("odometer_km")} /></div>
              <div><label>Liters *</label><input type="number" min="0" step="0.1" value={form.liters} onChange={set("liters")} /></div>
              <div><label>Price per liter (ETB) *</label><input type="number" min="0" step="0.01" value={form.price_per_liter_etb} onChange={set("price_per_liter_etb")} /></div>
              <div style={{ gridColumn: "1 / -1", fontWeight: 600 }}>
                Total cost: {etb(liveTotal)}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Fuel;