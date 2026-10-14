import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/users/";

function errorText(err) {
  const d = err.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => `${x.loc?.slice(-1)[0]}: ${x.msg}`).join("; ");
  return "Could not save. Check the fields.";
}

function Users() {
  const [users, setUsers] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState(false);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");

  const load = () =>
    Promise.all([axios.get(API), axios.get("http://localhost:8000/api/drivers/")])
      .then(([u, d]) => {
        setUsers(u.data);
        setDrivers(d.data);
      })
      .catch(() => setError(true));

  useEffect(() => {
    load();
  }, []);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const create = () => {
    axios
      .post(API + "driver-account", {
        username: form.username,
        password: form.password,
        driver_id: Number(form.driver_id),
      })
      .then(() => {
        setForm(null);
        setMessage("Driver account created.");
        load();
      })
      .catch((err) => setFormError(errorText(err)));
  };

  const changeStatus = (u, action) => {
    axios
      .put(`${API}${u.id}/${action}`)
      .then(() => {
        setMessage(`${u.username} is now ${action === "suspend" ? "suspended" : "active"}.`);
        load();
      })
      .catch((err) => setMessage(errorText(err)));
  };

  if (error) {
    return <div className="error-box">Cannot load accounts. Check that the backend is running.</div>;
  }
  if (!users) return <p>Loading...</p>;

  const driverName = (id) => drivers.find((d) => d.id === id)?.full_name || "-";
  const usedDriverIds = users.map((u) => u.driver_id).filter(Boolean);
  const freeDrivers = drivers.filter((d) => !usedDriverIds.includes(d.id));

  return (
    <div>
      <div className="page-head">
        <h2>User accounts ({users.length})</h2>
        <button
          className="btn"
          onClick={() => {
            setForm({ username: "", password: "", driver_id: "" });
            setFormError("");
          }}
        >
          + Create driver account
        </button>
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th><th>Name</th><th>Role</th><th>Status</th>
              <th>Linked driver</th><th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.full_name}</td>
                <td><span className="role-tag">{u.role}</span></td>
                <td>
                  <span className={`badge ${u.status === "active" ? "active" : u.status === "pending" ? "maintenance" : "offline"}`}>
                    {u.status}
                  </span>
                </td>
                <td>{driverName(u.driver_id)}</td>
                <td>
                  {u.status === "active" ? (
                    <button className="btn danger" onClick={() => changeStatus(u, "suspend")}>Suspend</button>
                  ) : (
                    <button className="btn" onClick={() => changeStatus(u, "approve")}>
                      {u.status === "pending" ? "Approve" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="modal-back">
          <div className="modal">
            <h3>Create driver account</h3>
            {formError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{formError}</div>}
            <div className="form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Driver record *</label>
                <select value={form.driver_id} onChange={set("driver_id")}>
                  <option value="">Choose a driver...</option>
                  {freeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name} ({d.license_number})</option>
                  ))}
                </select>
              </div>
              <div><label>Username *</label><input value={form.username} onChange={set("username")} /></div>
              <div><label>Password * (min 6)</label><input type="password" value={form.password} onChange={set("password")} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn" onClick={create}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;