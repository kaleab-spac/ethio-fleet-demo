import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/defects/";

function formatTime(iso) {
  return new Date(iso + "Z").toLocaleString("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Defects() {
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(false);
  const isAdmin = getUser()?.role === "admin";

  const load = () =>
    axios.get(API).then((res) => setReports(res.data)).catch(() => setError(true));

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  const setStatus = (id, status) =>
    axios.put(`${API}${id}/status`, { status }).then(load);

  if (error) return <div className="error-box">Cannot load defect reports.</div>;
  if (!reports) return <p>Loading...</p>;

  return (
    <div>
      <h2>Defect reports ({reports.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (EAT)</th><th>Vehicle</th><th>Driver</th><th>Severity</th>
              <th>Description</th><th>Status</th>{isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 && (
              <tr><td colSpan="7" className="muted">No defect reports.</td></tr>
            )}
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.created_at)}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.driver_name}</td>
                <td><span className={`badge ${r.severity}`}>{r.severity}</span></td>
                <td style={{ whiteSpace: "normal" }}>{r.description}</td>
                <td>{r.status.replace("_", " ")}</td>
                {isAdmin && (
                  <td style={{ display: "flex", gap: "0.4rem" }}>
                    {r.status === "open" && (
                      <button className="btn" onClick={() => setStatus(r.id, "in_progress")}>Start</button>
                    )}
                    {r.status !== "resolved" && (
                      <button className="btn" onClick={() => setStatus(r.id, "resolved")}>Resolve</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Defects;