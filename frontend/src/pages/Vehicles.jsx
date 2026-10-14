import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/vehicles/";

const EMPTY = {
  name: "", plate_number: "", make: "", model: "", year: "",
  vehicle_type: "truck", fuel_type: "diesel", status: "idle",
  odometer_km: 0, driver_id: "",
};

function errorText(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join("; ");
  return "Could not save. Check the fields.";
}

function Vehicles() {
  const [vehicles, setVehicles] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const isAdmin = getUser()?.role === "admin";

  const load = () =>
    Promise.all([axios.get(API), axios.get("http://localhost:8000/api/drivers/")])
      .then(([v, d]) => {
        setVehicles(v.data);
        setDrivers(d.data);
      })
      .catch(() => setError(true));

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm({ ...EMPTY });
    setEditId(null);
    setFormError("");
  };

  const openEdit = (v) => {
    setForm({ ...v, year: v.year ?? "", driver_id: v.driver_id ?? "" });
    setEditId(v.id);
    setFormError("");
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = () => {
    const body = {
      name: form.name || null,
      plate_number: form.plate_number,
      make: form.make || null,
      model: form.model || null,
      year: form.year === "" ? null : Number(form.year),
      vehicle_type: form.vehicle_type,
      fuel_type: form.fuel_type,
      status: form.status,
      odometer_km: Number(form.odometer_km) || 0,
      driver_id: form.driver_id === "" ? null : Number(form.driver_id),
    };
    const request = editId ? axios.put(API + editId, body) : axios.post(API, body);
    request
      .then(() => {
        setForm(null);
        setMessage(editId ? "Vehicle updated." : "Vehicle added.");
        load();
      })
      .catch((err) => setFormError(errorText(err)));
  };

  const archive = (v) => {
    if (
      !window.confirm(
        `Archive ${v.name || v.plate_number}? It will be hidden from lists. History is kept.`
      )
    )
      return;
    axios
      .put(API + v.id, { archived: true, status: "offline" })
      .then(() => {
        setMessage("Vehicle archived. Its history is kept.");
        load();
      })
      .catch(() => setMessage("Could not archive the vehicle."));
  };

  if (error) {
    return <div className="error-box">Cannot load data. Check that the backend is running on port 8000.</div>;
  }
  if (!vehicles) return <p>Loading...</p>;

  const driverName = (id) => drivers.find((x) => x.id === id)?.full_name || "Unassigned";
  const q = search.toLowerCase();
  const shown = vehicles.filter((v) =>
    `${v.name} ${v.plate_number} ${v.make} ${v.model}`.toLowerCase().includes(q)
  );

  return (
    <div>
      <div className="page-head">
        <h2>Vehicles ({shown.length})</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.4rem 0.7rem", border: "1px solid #cbd5e1", borderRadius: 6 }}
          />
          {isAdmin && <button className="btn" onClick={openAdd}>+ Add vehicle</button>}
        </div>
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Plate</th><th>Make / Model</th><th>Year</th>
              <th>Type</th><th>Status</th><th>Odometer (km)</th><th>Driver</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.plate_number}</td>
                <td>{v.make} {v.model}</td>
                <td>{v.year}</td>
                <td>{v.vehicle_type}</td>
                <td><span className={`badge ${v.status}`}>{v.status}</span></td>
                <td>{v.odometer_km.toLocaleString()}</td>
                <td>{driverName(v.driver_id)}</td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    <button className="btn" onClick={() => openEdit(v)}>Edit</button>
                    <button className="btn danger" onClick={() => archive(v)}>Archive</button>
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
            <h3>{editId ? "Edit vehicle" : "Add vehicle"}</h3>
            {formError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{formError}</div>}
            <div className="form-grid">
              <div><label>Name</label><input value={form.name || ""} onChange={set("name")} /></div>
              <div><label>Plate number *</label><input value={form.plate_number} onChange={set("plate_number")} /></div>
              <div><label>Make</label><input value={form.make || ""} onChange={set("make")} /></div>
              <div><label>Model</label><input value={form.model || ""} onChange={set("model")} /></div>
              <div><label>Year</label><input type="number" value={form.year} onChange={set("year")} /></div>
              <div><label>Odometer (km)</label><input type="number" value={form.odometer_km} onChange={set("odometer_km")} /></div>
              <div>
                <label>Type</label>
                <select value={form.vehicle_type} onChange={set("vehicle_type")}>
                  {["truck", "pickup", "suv", "bus", "minibus"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={set("status")}>
                  {["active", "idle", "maintenance", "offline"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Driver</label>
                <select value={form.driver_id} onChange={set("driver_id")}>
                  <option value="">Unassigned</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
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

export default Vehicles;