import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/defects/";

// Must match the rules in the backend (defect_flow.py)
const NEXT = {
  open: ["acknowledged", "in_progress", "rejected"],
  acknowledged: ["in_progress", "resolved", "rejected"],
  in_progress: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
  rejected: [],
};

const STATUS_BADGE = {
  open: "high", acknowledged: "medium", in_progress: "medium",
  resolved: "active", closed: "idle", rejected: "idle",
};

function actionLabel(from, to) {
  if (from === "resolved" && to === "in_progress") return "Reopen";
  return {
    acknowledged: "Acknowledge", in_progress: "Start work",
    resolved: "Mark resolved", closed: "Close", rejected: "Reject",
  }[to];
}

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

const label = (s) => s.replace("_", " ");

function Defects() {
  const [rows, setRows] = useState(null);
  const [filters, setFilters] = useState({ status: "", severity: "" });
  const [error, setError] = useState(false);
  const [detail, setDetail] = useState(null);
  const [dlg, setDlg] = useState(null); // { status, note }
  const [dlgError, setDlgError] = useState("");
  const [comment, setComment] = useState({ body: "", visible: true });
  const [commentError, setCommentError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isAdmin = getUser()?.role === "admin";

  const load = () => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
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

  const openDetail = (id) =>
    axios.get(API + id).then((res) => setDetail(res.data)).catch(() => setMessage("Cannot load the report."));

  const refresh = (id) => Promise.all([load(), openDetail(id)]);

  const needsNote = (s) => s === "resolved" || s === "rejected";

  const startAction = (to) => {
    setDlg({ status: to, note: "" });
    setDlgError("");
  };

  const submitStatus = () => {
    if (busy) return;
    if (needsNote(dlg.status) && dlg.note.trim().length < 3) {
      setDlgError(dlg.status === "resolved" ? "Please describe how it was resolved." : "Please give a reason.");
      return;
    }
    setBusy(true);
    axios
      .put(`${API}${detail.id}/status`, { status: dlg.status, note: dlg.note || null })
      .then(() => {
        setDlg(null);
        setMessage("Status updated. The driver was notified.");
        return refresh(detail.id);
      })
      .catch((err) => setDlgError(errorText(err)))
      .finally(() => setBusy(false));
  };

  const addComment = () => {
    if (busy) return;
    if (comment.body.trim().length < 2) {
      setCommentError("Write a comment first.");
      return;
    }
    setBusy(true);
    setCommentError("");
    axios
      .post(`${API}${detail.id}/comments`, { body: comment.body, visible_to_driver: comment.visible })
      .then(() => {
        setComment({ body: "", visible: true });
        return openDetail(detail.id);
      })
      .catch((err) => setCommentError(errorText(err)))
      .finally(() => setBusy(false));
  };

  if (error) return <div className="error-box">Cannot load defect reports.</div>;
  if (!rows) return <p>Loading...</p>;

  const critical = rows.filter((r) => r.severity === "critical" && !["closed", "rejected"].includes(r.status)).length;

  return (
    <div>
      <h2>Defect reports ({rows.length})</h2>

      {critical > 0 && (
        <div className="warn-box">
          {critical} critical report{critical > 1 ? "s" : ""} not closed. Those vehicles were taken out of service
          and stay that way until you set them back to active on the Vehicles page.
        </div>
      )}

      <div className="filter-bar">
        <div>
          <label>Status</label>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All</option>
            {Object.keys(NEXT).map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        </div>
        <div>
          <label>Severity</label>
          <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
            <option value="">All</option>
            {["critical", "high", "medium", "low"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (EAT)</th><th>Vehicle</th><th>Driver</th><th>Severity</th>
              <th>Category</th><th>Description</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="8" className="muted">No defect reports.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.driver_name}</td>
                <td><span className={`badge ${r.severity}`}>{r.severity}</span></td>
                <td>{r.category || "-"}</td>
                <td style={{ whiteSpace: "normal" }}>{r.description}</td>
                <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{label(r.status)}</span></td>
                <td><button className="btn" onClick={() => { setMessage(""); openDetail(r.id); }}>Open</button></td>
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
              <span className={`badge ${detail.severity}`}>{detail.severity}</span>{" "}
              <span className={`badge ${STATUS_BADGE[detail.status]}`}>{label(detail.status)}</span>
            </h3>
            <p>
              <strong>{detail.driver_name}</strong> reported on {formatTime(detail.created_at)}
              {detail.category ? `, category: ${detail.category}` : ""}
              {detail.odometer_km ? `, odometer ${Math.round(detail.odometer_km).toLocaleString()} km` : ""}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>{detail.description}</p>
            {detail.resolution && (
              <div className="success-box"><strong>Resolution / reason:</strong> {detail.resolution}</div>
            )}

            {isAdmin && NEXT[detail.status].length > 0 && !dlg && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", margin: "0.75rem 0" }}>
                {NEXT[detail.status].map((to) => (
                  <button
                    key={to}
                    className={`btn ${to === "rejected" ? "danger" : to === "in_progress" && detail.status === "resolved" ? "secondary" : ""}`}
                    onClick={() => startAction(to)}
                  >
                    {actionLabel(detail.status, to)}
                  </button>
                ))}
              </div>
            )}

            {dlg && (
              <div className="comment-box" style={{ margin: "0.75rem 0" }}>
                <strong>{actionLabel(detail.status, dlg.status)}</strong>
                {dlgError && <div className="error-box" style={{ margin: "0.5rem 0" }}>{dlgError}</div>}
                <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <div>
                    <label>
                      {dlg.status === "resolved" ? "How was it resolved? *"
                        : dlg.status === "rejected" ? "Reason * (shown to the driver)"
                        : "Note (optional, shown to the driver)"}
                    </label>
                    <input value={dlg.note} onChange={(e) => setDlg({ ...dlg, note: e.target.value })} />
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="btn secondary" onClick={() => setDlg(null)}>Cancel</button>
                  <button className="btn" disabled={busy} onClick={submitStatus}>{busy ? "Saving..." : "Confirm"}</button>
                </div>
              </div>
            )}

            <div className="section-title">TIMELINE</div>
            <ul className="timeline">
              {detail.history.map((h) => (
                <li key={h.id}>
                  <strong>{h.from_status ? `${label(h.from_status)} → ${label(h.to_status)}` : "Reported"}</strong>
                  {" "}by {h.actor_name || "-"}
                  {h.note ? `: ${h.note}` : ""}
                  <div className="when">{formatTime(h.created_at)}</div>
                </li>
              ))}
              {detail.history.length === 0 && <li className="muted">No history yet (older report).</li>}
            </ul>

            <div className="section-title">COMMENTS</div>
            {detail.comments.length === 0 && <p className="muted">No comments yet.</p>}
            {detail.comments.map((c) => (
              <div key={c.id} className={`comment-box ${c.visible_to_driver ? "" : "internal"}`}>
                <div className="who">
                  {c.author_name} · {formatTime(c.created_at)} ·{" "}
                  {c.visible_to_driver ? "visible to driver" : "internal note"}
                </div>
                {c.body}
              </div>
            ))}

            {isAdmin && (
              <div style={{ marginTop: "0.75rem" }}>
                {commentError && <div className="error-box" style={{ marginBottom: "0.5rem" }}>{commentError}</div>}
                <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <div>
                    <label>Add a comment</label>
                    <input value={comment.body} onChange={(e) => setComment({ ...comment, body: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      <input
                        type="checkbox" style={{ width: "auto" }} checked={comment.visible}
                        onChange={(e) => setComment({ ...comment, visible: e.target.checked })}
                      />
                      Visible to the driver (untick for an internal note)
                    </label>
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="btn" disabled={busy} onClick={addComment}>Add comment</button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn secondary" onClick={() => { setDetail(null); setDlg(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Defects;