import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/drivers/";

const EMPTY = {
  full_name: "", phone: "", license_number: "", license_class: "Level 3",
  license_expiry: "", status: "active", safety_score: 100,
};

function licenseState(expiry) {
  if (!expiry) return { text: "-", style: {} };
  const days = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `${expiry} (expired)`, style: { color: "#b91c1c", fontWeight: 600 } };
  if (days <= 60) return { text: `${expiry} (${days} days)`, style: { color: "#b45309", fontWeight: 600 } };
  return { text: expiry, style: {} };
}

function errorText(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join("; ");
  return "Could not save. Check the fields.";
}

function Drivers() {
  const [drivers, setDrivers] = useState(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const isAdmin = getUser()?.role === "admin";

  const load = () =>
    axios.get(API).then((res) => setDrivers(res.data)).catch(() => setError(true));

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm({ ...EMPTY });
    setEditId(null);
    setFormError("");
  };

  const openEdit = (d) => {
    setForm({ ...d, phone: d.phone || "", license_class: d.license_class || "", license_expiry: d.license_expiry || "" });
    setEditId(d.id);
    setFormError("");
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = () => {
    const body = {
      full_name: form.full_name,
      phone: form.phone || null,
      license_number: form.license_number,
      license_class: form.license_class || null,
      license_expiry: form.license_expiry || null,
      status: form.status,
      safety_score: Number(form.safety_score),
    };
    const request = editId ? axios.put(API + editId, body) : axios.post(API, body);
    request
      .then(() => {
        setForm(null);
        setMessage(editId ? "Driver updated." : "Driver added.");
        load();
      })
      .catch((err) => setFormError(errorText(err)));
  };

  const setStatus = (d, status) => {
    const verb = status === "inactive" ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${verb} ${d.full_name}?`)) return;
    axios
      .put(API + d.id, { status })
      .then(() => {
        setMessage(`${d.full_name} is now ${status}. History is kept.`);
        load();
      })
      .catch(() => setMessage("Could not change the status."));
  };

  if (error) {
    return <div className="error-box">Cannot load data. Check that the backend is running on port 8000.</div>;
  }
  if (!drivers) return <p>Loading...</p>;

  const q = search.toLowerCase();
  const shown = drivers.filter((d) =>
    `${d.full_name} ${d.license_number} ${d.phone}`.toLowerCase().includes(q)
  );

  return (
    <div>
      <div className="page-head">
        <h2>Drivers ({shown.length})</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "0.4rem 0.7rem", border: "1px solid #cbd5e1", borderRadius: 6 }}
          />
          {isAdmin && <button className="btn" onClick={openAdd}>+ Add driver</button>}
        </div>
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>License No.</th><th>Class</th>
              <th>License expiry</th><th>Status</th><th>Safety score</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => {
              const lic = licenseState(d.license_expiry);
              return (
                <tr key={d.id}>
                  <td>{d.full_name}</td>
                  <td>{d.phone}</td>
                  <td>{d.license_number}</td>
                  <td>{d.license_class}</td>
                  <td style={lic.style}>{lic.text}</td>
                  <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                  <td style={{ color: d.safety_score < 70 ? "#b91c1c" : "inherit", fontWeight: d.safety_score < 70 ? 600 : 400 }}>
                    {d.safety_score}
                  </td>
                  {isAdmin && (
                    <td style={{ display: "flex", gap: "0.4rem" }}>
                      <button className="btn" onClick={() => openEdit(d)}>Edit</button>
                      {d.status === "inactive" ? (
                        <button className="btn secondary" onClick={() => setStatus(d, "active")}>Reactivate</button>
                      ) : (
                        <button className="btn danger" onClick={() => setStatus(d, "inactive")}>Deactivate</button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-back">
          <div className="modal">
            <h3>{editId ? "Edit driver" : "Add driver"}</h3>
            {formError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{formError}</div>}
            <div className="form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Full name *</label>
                <input value={form.full_name} onChange={set("full_name")} />
              </div>
              <div><label>Phone</label><input value={form.phone} onChange={set("phone")} placeholder="+2519..." /></div>
              <div><label>License number *</label><input value={form.license_number} onChange={set("license_number")} /></div>
              <div>
                <label>License class</label>
                <select value={form.license_class} onChange={set("license_class")}>
                  {["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label>License expiry</label><input type="date" value={form.license_expiry} onChange={set("license_expiry")} /></div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={set("status")}>
                  {["active", "on_leave", "inactive"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Safety score (0-100)</label>
                <input type="number" min="0" max="100" value={form.safety_score} onChange={set("safety_score")} />
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

export default Drivers;