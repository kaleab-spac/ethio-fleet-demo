import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/fuel-requests";

const BADGE = {
  pending: "maintenance", approved: "active", rejected: "offline", cancelled: "idle",
  fulfilled: "active", partially_fulfilled: "medium",
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
  return "Could not save.";
}

function FuelRequests() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState(false);
  const [dlg, setDlg] = useState(null); // { req, mode, liters, reason }
  const [dlgError, setDlgError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isAdmin = getUser()?.role === "admin";

  const load = () =>
    axios
      .get(API, { params: status ? { status } : {} })
      .then((res) => { setRows(res.data); setError(false); })
      .catch(() => setError(true));

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [status]);

  const open = (req, mode) => {
    setDlg({ req, mode, liters: req.requested_liters, reason: "" });
    setDlgError("");
  };

  const submit = () => {
    if (busy) return;
    const approving = dlg.mode === "approve";
    const liters = Number(dlg.liters);
    if (approving) {
      if (!(liters > 0)) {
        setDlgError("Enter the approved liters.");
        return;
      }
      // Safeguard: a very small approval is probably a typing slip
      if (liters < dlg.req.requested_liters / 2) {
        const ok = window.confirm(
          `You are approving only ${liters} L, but the driver asked for ${dlg.req.requested_liters} L. Continue?`
        );
        if (!ok) return;
      }
    }
    setBusy(true);
    const body = { decision: approving ? "approved" : "rejected", reason: dlg.reason };
    if (approving) body.approved_liters = liters;
    axios
      .put(`${API}/${dlg.req.id}/decision`, body)
      .then(() => {
        setDlg(null);
        setMessage(`Request ${approving ? "approved" : "rejected"}. The driver was notified.`);
        load();
      })
      .catch((err) => setDlgError(errorText(err)))
      .finally(() => setBusy(false));
  };

  if (error) return <div className="error-box">Cannot load fuel requests.</div>;
  if (!rows) return <p>Loading...</p>;

  return (
    <div>
      <h2>Fuel requests ({rows.length})</h2>
      <div className="chart-note" style={{ marginBottom: "0.75rem" }}>
        Approving a request does not record a purchase. The driver records the actual fill-up afterwards,
        and you verify it on the Fill-ups page.
      </div>

      <div className="filter-bar">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {["pending", "approved", "rejected", "cancelled", "partially_fulfilled", "fulfilled"].map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
      </div>

      {message && <div className="success-box">{message}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (EAT)</th><th>Driver</th><th>Vehicle</th><th>Requested</th>
              <th>Approved</th><th>Odometer</th><th>Purpose</th><th>Status</th>
              <th>Decision</th>{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="10" className="muted">No requests.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.driver_name}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.requested_liters} L</td>
                <td>{r.approved_liters ? `${r.approved_liters} L` : "-"}</td>
                <td>{Math.round(r.odometer_km).toLocaleString()} km</td>
                <td style={{ whiteSpace: "normal" }}>{r.purpose || "-"}</td>
                <td><span className={`badge ${BADGE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                <td style={{ whiteSpace: "normal" }}>
                  {r.reviewer_name ? `${r.reviewer_name}: ${r.decision_reason || "no note"}` : "-"}
                </td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    {r.status === "pending" && (
                      <>
                        <button className="btn" onClick={() => open(r, "approve")}>Approve</button>
                        <button className="btn danger" onClick={() => open(r, "reject")}>Reject</button>
                      </>
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
            <h3>{dlg.mode === "approve" ? "Approve" : "Reject"} fuel request</h3>
            <p>{dlg.req.driver_name}, {dlg.req.vehicle_name}: requested <strong>{dlg.req.requested_liters} L</strong></p>
            {dlgError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{dlgError}</div>}
            <div className="form-grid">
              {dlg.mode === "approve" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Approved liters (requested: {dlg.req.requested_liters} L, you can approve less)</label>
                  <input type="number" min="0" step="0.1" value={dlg.liters}
                    onChange={(e) => setDlg({ ...dlg, liters: e.target.value })} />
                </div>
              )}
              <div style={{ gridColumn: "1 / -1" }}>
                <label>{dlg.mode === "reject" ? "Reason * (shown to the driver)" : "Note (optional)"}</label>
                <input value={dlg.reason} onChange={(e) => setDlg({ ...dlg, reason: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDlg(null)}>Cancel</button>
              <button className={`btn ${dlg.mode === "reject" ? "danger" : ""}`} disabled={busy} onClick={submit}>
                {busy ? "Saving..." : dlg.mode === "approve" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FuelRequests;