import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/maintenance/";

const etb = (n) => `${Math.round(n).toLocaleString()} ETB`;
const today = () => new Date().toISOString().slice(0, 10);

const SERVICE_TYPES = [
  "Oil change", "Tire rotation", "Brake service", "Air filter",
  "Annual inspection (Bolo)", "Battery replacement", "Gearbox repair",
];

function errorText(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join("; ");
  return "Could not save. Check the fields.";
}

function Maintenance() {
  const [reminders, setReminders] = useState(null);
  const [records, setRecords] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState({ vehicle_id: "", date_from: "", date_to: "" });
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const isAdmin = getUser()?.role === "admin";

  const load = () => {
    const listParams = {};
    if (filters.vehicle_id) listParams.vehicle_id = filters.vehicle_id;
    if (filters.date_from) listParams.date_from = filters.date_from;
    if (filters.date_to) listParams.date_to = filters.date_to;
    const remParams = filters.vehicle_id ? { vehicle_id: filters.vehicle_id } : {};
    return Promise.all([
      axios.get(API + "reminders", { params: remParams }),
      axios.get(API, { params: listParams }),
      axios.get("http://localhost:8000/api/vehicles/"),
    ])
      .then(([r, h, v]) => {
        setReminders(r.data);
        setRecords(h.data);
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

  const blank = (vehicleId, serviceType) => ({
    vehicle_id: vehicleId ? String(vehicleId) : vehicles[0] ? String(vehicles[0].id) : "",
    service_type: serviceType || "",
    description: "", service_date: today(), odometer_km: "", cost_etb: "",
    next_due_date: "", next_due_odometer_km: "",
  });

  const openAdd = () => {
    setForm(blank());
    setEditId(null);
    setFormError("");
  };

  // From a reminder: start a new record for that vehicle and service
  const openRecord = (r) => {
    const vehicle = vehicles.find((v) => v.id === r.vehicle_id);
    setForm({ ...blank(r.vehicle_id, r.service_type), odometer_km: vehicle ? vehicle.odometer_km : "" });
    setEditId(null);
    setFormError("");
  };

  const openEdit = (r) => {
    setForm({
      vehicle_id: String(r.vehicle_id),
      service_type: r.service_type,
      description: r.description || "",
      service_date: r.service_date,
      odometer_km: r.odometer_km,
      cost_etb: r.cost_etb,
      next_due_date: r.next_due_date || "",
      next_due_odometer_km: r.next_due_odometer_km ?? "",
    });
    setEditId(r.id);
    setFormError("");
  };

  const save = () => {
    if (!form.service_type.trim()) {
      setFormError("Please enter the service type.");
      return;
    }
    const body = {
      service_type: form.service_type.trim(),
      description: form.description || null,
      service_date: form.service_date,
      odometer_km: Number(form.odometer_km) || 0,
      cost_etb: Number(form.cost_etb) || 0,
      next_due_date: form.next_due_date || null,
      next_due_odometer_km: form.next_due_odometer_km === "" ? null : Number(form.next_due_odometer_km),
    };
    // The vehicle can be chosen only when adding a new record
    const request = editId
      ? axios.put(API + editId, body)
      : axios.post(API, { ...body, vehicle_id: Number(form.vehicle_id) });
    request
      .then(() => {
        setForm(null);
        setMessage(editId ? "Service record updated." : "Service record added.");
        load();
      })
      .catch((err) => setFormError(errorText(err)));
  };

  const remove = (r) => {
    if (!window.confirm(`Delete the ${r.service_type} record for ${r.vehicle_name}?`)) return;
    axios
      .delete(API + r.id)
      .then(() => {
        setMessage("Service record deleted.");
        load();
      })
      .catch(() => setMessage("Could not delete."));
  };

  if (error) {
    return <div className="error-box">Cannot load data. Check that the backend is running on port 8000.</div>;
  }
  if (!reminders || !records) return <p>Loading...</p>;

  const overdue = reminders.filter((r) => r.status === "overdue").length;
  const dueSoon = reminders.filter((r) => r.status === "due_soon").length;
  const totalCost = records.reduce((sum, r) => sum + r.cost_etb, 0);
  const filtered = filters.vehicle_id || filters.date_from || filters.date_to;

  return (
    <div>
      <div className="page-head">
        <h2>Maintenance</h2>
        {isAdmin && <button className="btn" onClick={openAdd}>+ Add service</button>}
      </div>

      <div className="filter-bar">
        <div>
          <label>Vehicle</label>
          <select value={filters.vehicle_id} onChange={setFilter("vehicle_id")}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label>Service from</label>
          <input type="date" value={filters.date_from} onChange={setFilter("date_from")} />
        </div>
        <div>
          <label>Service to</label>
          <input type="date" value={filters.date_to} onChange={setFilter("date_to")} />
        </div>
        {filtered && (
          <button className="btn secondary" onClick={() => setFilters({ vehicle_id: "", date_from: "", date_to: "" })}>
            Clear filters
          </button>
        )}
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="cards">
        <div className="card red">
          <div className="label">Overdue</div>
          <div className="value">{overdue}</div>
        </div>
        <div className="card orange">
          <div className="label">Due soon</div>
          <div className="value">{dueSoon}</div>
        </div>
        <div className="card">
          <div className="label">Service cost (selection)</div>
          <div className="value" style={{ fontSize: "1.4rem" }}>{etb(totalCost)}</div>
        </div>
      </div>

      <div className="section-title">REMINDERS</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th><th>Vehicle</th><th>Service</th><th>Detail</th><th>Due date</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {reminders.length === 0 && (
              <tr><td colSpan="6" className="muted">Nothing needs attention.</td></tr>
            )}
            {reminders.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`badge ${r.status}`}>
                    {r.status === "overdue" ? "overdue" : "due soon"}
                  </span>
                </td>
                <td>{r.vehicle_name}</td>
                <td>{r.service_type}</td>
                <td>{r.reason}</td>
                <td>{r.next_due_date || "-"}</td>
                {isAdmin && (
                  <td>
                    <button className="btn" onClick={() => openRecord(r)}>Record service</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">SERVICE HISTORY ({records.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Vehicle</th><th>Service</th><th>Description</th>
              <th>Odometer (km)</th><th>Cost</th><th>Next due</th>{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr><td colSpan="8" className="muted">No service records.</td></tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.service_date}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.service_type}</td>
                <td>{r.description}</td>
                <td>{Math.round(r.odometer_km).toLocaleString()}</td>
                <td>{etb(r.cost_etb)}</td>
                <td>
                  {r.next_due_date || "-"}
                  {r.next_due_odometer_km ? ` / ${Math.round(r.next_due_odometer_km).toLocaleString()} km` : ""}
                </td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    <button className="btn" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn danger" onClick={() => remove(r)}>Delete</button>
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
            <h3>{editId ? "Edit service record" : "Add service record"}</h3>
            {formError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{formError}</div>}
            <div className="form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Vehicle *</label>
                <select value={form.vehicle_id} onChange={set("vehicle_id")} disabled={!!editId}>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>)}
                </select>
              </div>
              <div>
                <label>Service type *</label>
                <input list="service-types" value={form.service_type} onChange={set("service_type")} />
                <datalist id="service-types">
                  {SERVICE_TYPES.map((t) => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div><label>Service date *</label><input type="date" max={today()} value={form.service_date} onChange={set("service_date")} /></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <input value={form.description} onChange={set("description")} />
              </div>
              <div><label>Odometer (km)</label><input type="number" min="0" value={form.odometer_km} onChange={set("odometer_km")} /></div>
              <div><label>Cost (ETB)</label><input type="number" min="0" step="0.01" value={form.cost_etb} onChange={set("cost_etb")} /></div>
              <div><label>Next due date</label><input type="date" min={form.service_date} value={form.next_due_date} onChange={set("next_due_date")} /></div>
              <div><label>Next due odometer (km)</label><input type="number" min="0" value={form.next_due_odometer_km} onChange={set("next_due_odometer_km")} /></div>
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

export default Maintenance;