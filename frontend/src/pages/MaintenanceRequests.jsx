import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/maintenance-requests";

const BADGE = {
  pending: "maintenance", approved: "active", rejected: "offline", scheduled: "medium",
  in_progress: "medium", completed: "active", cancelled: "idle",
};
const URGENCY_BADGE = { low: "low", medium: "medium", high: "high", urgent: "critical" };

// Must match the backend rules (maintenance_requests.py)
const ACTIONS_FOR = {
  pending: ["approve", "schedule", "reject", "cancel"],
  approved: ["schedule", "cancel"],
  scheduled: ["start", "cancel"],
  in_progress: ["complete"],
  completed: [],
  rejected: [],
  cancelled: [],
};
const ACTION_LABEL = {
  approve: "Approve", schedule: "Schedule", reject: "Reject",
  cancel: "Cancel request", start: "Start work", complete: "Complete",
};

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
  return "Could not save.";
}

function MaintenanceRequests() {
  const [rows, setRows] = useState(null);
  const [filters, setFilters] = useState({ status: "pending", urgency: "" });
  const [error, setError] = useState(false);
  const [dlg, setDlg] = useState(null); // { req, action, ...fields }
  const [dlgError, setDlgError] = useState("");
  const [link, setLink] = useState(null); // { req, defects, defect_id }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isAdmin = getUser()?.role === "admin";

  const load = () => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.urgency) params.urgency = filters.urgency;
    return axios
      .get(API, { params })
      .then((res) => { setRows(res.data); setError(false); })
      .catch(() => setError(true));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [filters]);

  const openAction = (req, action) => {
    setDlg({
      req, action, reason: "", scheduled_date: "", provider: "",
      cost_etb: "", odometer_km: req.odometer_km, next_due_date: "", next_due_odometer_km: "",
    });
    setDlgError("");
  };

  const submit = () => {
    if (busy) return;
    const { action } = dlg;
    const need = (cond, msg) => { if (cond) { setDlgError(msg); return true; } return false; };
    if (["reject", "cancel"].includes(action) && need(dlg.reason.trim().length < 3, "Please give a reason.")) return;
    if (action === "schedule") {
      if (need(!dlg.scheduled_date, "Please choose the service date.")) return;
      if (need(dlg.provider.trim().length < 2, "Please enter the technician or service provider.")) return;
    }
    if (action === "complete") {
      if (need(dlg.reason.trim().length < 3, "Please describe the work done.")) return;
      if (need(dlg.cost_etb === "", "Please enter the cost (0 if free).")) return;
    }
    const body = { action };
    if (dlg.reason.trim()) body.reason = dlg.reason.trim();
    if (action === "schedule") {
      body.scheduled_date = dlg.scheduled_date;
      body.provider = dlg.provider.trim();
    }
    if (action === "complete") {
      body.cost_etb = Number(dlg.cost_etb);
      body.odometer_km = Number(dlg.odometer_km) || 0;
      if (dlg.next_due_date) body.next_due_date = dlg.next_due_date;
      if (dlg.next_due_odometer_km !== "") body.next_due_odometer_km = Number(dlg.next_due_odometer_km);
    }
    setBusy(true);
    axios
      .put(`${API}/${dlg.req.id}/action`, body)
      .then(() => {
        setDlg(null);
        setMessage(
          action === "complete"
            ? "Completed and added to the service history. The vehicle status was not changed: set it to active on the Vehicles page when it is ready."
            : "Done. The driver was notified."
        );
        load();
      })
      .catch((err) => setDlgError(errorText(err)))
      .finally(() => setBusy(false));
  };

  const openLink = (req) =>
    axios
      .get("http://localhost:8000/api/defects/")
      .then((res) =>
        setLink({
          req,
          defects: res.data.filter(
            (d) => d.vehicle_id === req.vehicle_id && !["closed", "rejected"].includes(d.status)
          ),
          defect_id: req.defect_id ?? "",
          error: "",
        })
      )
      .catch(() => setMessage("Cannot load defects."));

  const saveLink = () => {
    axios
      .put(`${API}/${link.req.id}/link-defect`, {
        defect_id: link.defect_id === "" ? null : Number(link.defect_id),
      })
      .then(() => {
        setLink(null);
        setMessage("Defect link saved.");
        load();
      })
      .catch((err) => setLink({ ...link, error: errorText(err) }));
  };

  if (error) return <div className="error-box">Cannot load maintenance requests.</div>;
  if (!rows) return <p>Loading...</p>;

  return (
    <div>
      <h2>Maintenance requests ({rows.length})</h2>
      <div className="chart-note" style={{ marginBottom: "0.75rem" }}>
        Completing a request adds a record to the Maintenance history. It does not make the vehicle active:
        you confirm that on the Vehicles page.
      </div>

      <div className="filter-bar">
        <div>
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>
            {Object.keys(ACTIONS_FOR).map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div>
          <label>Urgency</label>
          <select value={filters.urgency} onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}>
            <option value="">All</option>
            {["urgent", "high", "medium", "low"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (EAT)</th><th>Driver</th><th>Vehicle</th><th>Category</th><th>Urgency</th>
              <th>Problem</th><th>Status</th><th>Schedule</th><th>Defect</th>{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="10" className="muted">No requests.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.driver_name}</td>
                <td>{r.vehicle_name}</td>
                <td>{label(r.category)}</td>
                <td><span className={`badge ${URGENCY_BADGE[r.urgency]}`}>{r.urgency}</span></td>
                <td style={{ whiteSpace: "normal" }}>
                  {r.description}
                  {r.preferred_date && <div className="muted">Preferred: {r.preferred_date}</div>}
                </td>
                <td>
                  <span className={`badge ${BADGE[r.status]}`}>{label(r.status)}</span>
                  {r.decision_reason && <div className="muted" style={{ whiteSpace: "normal" }}>{r.decision_reason}</div>}
                </td>
                <td style={{ whiteSpace: "normal" }}>
                  {r.scheduled_date ? `${r.scheduled_date}, ${r.provider}` : "-"}
                </td>
                <td>{r.defect_id ? `#${r.defect_id}` : "-"}</td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {ACTIONS_FOR[r.status].map((a) => (
                      <button
                        key={a}
                        className={`btn ${["reject", "cancel"].includes(a) ? "danger" : ""}`}
                        onClick={() => openAction(r, a)}
                      >
                        {ACTION_LABEL[a]}
                      </button>
                    ))}
                    {["pending", "approved", "scheduled", "in_progress"].includes(r.status) && (
                      <button className="btn secondary" onClick={() => openLink(r)}>Link defect</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dlg && (
        <div className="modal-back">
          <div className="modal">
            <h3>{ACTION_LABEL[dlg.action]}</h3>
            <p>{dlg.req.driver_name}, {dlg.req.vehicle_name}: {dlg.req.description}</p>
            {dlgError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{dlgError}</div>}
            <div className="form-grid">
              {dlg.action === "schedule" && (
                <>
                  <div><label>Service date *</label><input type="date" min={today()} value={dlg.scheduled_date} onChange={(e) => setDlg({ ...dlg, scheduled_date: e.target.value })} /></div>
                  <div><label>Technician / provider *</label><input value={dlg.provider} onChange={(e) => setDlg({ ...dlg, provider: e.target.value })} /></div>
                </>
              )}
              {dlg.action === "complete" && (
                <>
                  <div><label>Cost (ETB) *</label><input type="number" min="0" step="0.01" value={dlg.cost_etb} onChange={(e) => setDlg({ ...dlg, cost_etb: e.target.value })} /></div>
                  <div><label>Odometer (km)</label><input type="number" min="0" value={dlg.odometer_km} onChange={(e) => setDlg({ ...dlg, odometer_km: e.target.value })} /></div>
                  <div><label>Next due date</label><input type="date" min={today()} value={dlg.next_due_date} onChange={(e) => setDlg({ ...dlg, next_due_date: e.target.value })} /></div>
                  <div><label>Next due odometer (km)</label><input type="number" min="0" value={dlg.next_due_odometer_km} onChange={(e) => setDlg({ ...dlg, next_due_odometer_km: e.target.value })} /></div>
                </>
              )}
              <div style={{ gridColumn: "1 / -1" }}>
                <label>
                  {["reject", "cancel"].includes(dlg.action) ? "Reason * (shown to the driver)"
                    : dlg.action === "complete" ? "Work done *"
                    : dlg.action === "schedule" ? "Instructions for the driver (optional)"
                    : "Note (optional)"}
                </label>
                <input value={dlg.reason} onChange={(e) => setDlg({ ...dlg, reason: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDlg(null)}>Close</button>
              <button className={`btn ${["reject", "cancel"].includes(dlg.action) ? "danger" : ""}`} disabled={busy} onClick={submit}>
                {busy ? "Saving..." : ACTION_LABEL[dlg.action]}
              </button>
            </div>
          </div>
        </div>
      )}

      {link && (
        <div className="modal-back">
          <div className="modal">
            <h3>Link a defect report</h3>
            <p>{link.req.vehicle_name}: {link.req.description}</p>
            {link.error && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{link.error}</div>}
            <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <label>Open defect on this vehicle</label>
                <select value={link.defect_id} onChange={(e) => setLink({ ...link, defect_id: e.target.value })}>
                  <option value="">No defect</option>
                  {link.defects.map((d) => (
                    <option key={d.id} value={d.id}>#{d.id} ({d.severity}, {label(d.status)}): {d.description.slice(0, 50)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setLink(null)}>Close</button>
              <button className="btn" onClick={saveLink}>Save link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaintenanceRequests;