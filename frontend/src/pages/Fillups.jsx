import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/fill-ups";

const BADGE = {
  submitted: "maintenance", verified: "active", needs_correction: "medium", rejected: "offline",
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

const TITLES = {
  verified: "Verify fill-up",
  needs_correction: "Send back for correction",
  rejected: "Reject fill-up",
};

function Fillups() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("submitted");
  const [error, setError] = useState(false);
  const [dlg, setDlg] = useState(null); // { row, decision, reason }
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

  const open = (row, decision) => {
    setDlg({ row, decision, reason: "" });
    setDlgError("");
  };

  const submit = () => {
    if (busy) return;
    setBusy(true);
    axios
      .put(`${API}/${dlg.row.id}/review`, { decision: dlg.decision, reason: dlg.reason })
      .then(() => {
        setDlg(null);
        setMessage("Done. The driver was notified.");
        load();
      })
      .catch((err) => setDlgError(errorText(err)))
      .finally(() => setBusy(false));
  };

  if (error) return <div className="error-box">Cannot load fill-ups.</div>;
  if (!rows) return <p>Loading...</p>;

  return (
    <div>
      <h2>Driver fill-ups ({rows.length})</h2>
      <div className="chart-note" style={{ marginBottom: "0.75rem" }}>
        A fill-up counts as an expense (Fuel page, Reports, Dashboard) only after it is verified.
      </div>

      <div className="filter-bar">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {["submitted", "verified", "needs_correction", "rejected"].map((s) => (
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
              <th>Submitted</th><th>Driver</th><th>Vehicle</th><th>Fuel date</th>
              <th>Approved</th><th>Actual</th><th>Difference</th><th>Price / L</th>
              <th>Total</th><th>Odometer</th><th>Station</th><th>Review</th>
              <th>Status</th><th>Reason</th>{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="15" className="muted">No fill-ups.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.driver_name}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.fuel_date}</td>
                <td>{r.approved_liters != null ? `${r.approved_liters} L` : "no request"}</td>
                <td>{r.liters} L</td>
                <td style={{ color: r.difference_liters > 0 ? "#b91c1c" : "inherit", fontWeight: r.difference_liters > 0 ? 600 : 400 }}>
                  {r.difference_liters != null ? `${r.difference_liters > 0 ? "+" : ""}${r.difference_liters} L` : "-"}
                </td>
                <td>{r.price_per_liter_etb.toFixed(2)} ETB</td>
                <td>{Math.round(r.total_cost_etb).toLocaleString()} ETB</td>
                <td>{Math.round(r.odometer_km).toLocaleString()} km</td>
                <td>{r.station || "-"}</td>
                <td>
                  {r.flags && r.flags.length > 0
                    ? <span className="badge offline" title={r.flags.join("; ")}>Check</span>
                    : <span className="muted">OK</span>}
                </td>
                <td><span className={`badge ${BADGE[r.status]}`}>{r.status.replace("_", " ")}</span></td>
                <td style={{ whiteSpace: "normal" }}>
                  {r.reviewer_name ? `${r.reviewer_name}: ${r.review_reason || "no note"}` : "-"}
                </td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    {r.status === "submitted" && (
                      <>
                        <button className="btn" onClick={() => open(r, "verified")}>Verify</button>
                        <button className="btn secondary" onClick={() => open(r, "needs_correction")}>Send back</button>
                        <button className="btn danger" onClick={() => open(r, "rejected")}>Reject</button>
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
            <h3>{TITLES[dlg.decision]}</h3>
            <p>
              {dlg.row.driver_name}, {dlg.row.vehicle_name}: {dlg.row.liters} L at{" "}
              {dlg.row.price_per_liter_etb} ETB = {Math.round(dlg.row.total_cost_etb).toLocaleString()} ETB
            </p>
            {dlg.row.flags?.length > 0 && (
              <div className="error-box" style={{ marginBottom: "0.75rem" }}>
                Flagged: {dlg.row.flags.join("; ")}
              </div>
            )}
            {dlgError && <div className="error-box" style={{ marginBottom: "0.75rem" }}>{dlgError}</div>}
            <div className="form-grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>{dlg.decision === "verified" ? "Note (optional)" : "Reason * (shown to the driver)"}</label>
                <input value={dlg.reason} onChange={(e) => setDlg({ ...dlg, reason: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDlg(null)}>Cancel</button>
              <button className={`btn ${dlg.decision === "rejected" ? "danger" : ""}`} disabled={busy} onClick={submit}>
                {busy ? "Saving..." : TITLES[dlg.decision]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Fillups;