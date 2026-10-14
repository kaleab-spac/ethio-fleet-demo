import { useEffect, useState } from "react";
import axios from "axios";
import { getUser } from "../auth.js";

const API = "http://localhost:8000/api/alerts/";

const TYPE_LABELS = {
  speeding: "Speeding",
  geofence_enter: "Zone entry",
  geofence_exit: "Zone exit",
  license: "License",
  safety: "Safety score",
};

// The server stores UTC time. We show it in Ethiopia time.
function formatTime(iso) {
  return new Date(iso + "Z").toLocaleString("en-GB", {
    timeZone: "Africa/Addis_Ababa",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Alerts() {
  const [alerts, setAlerts] = useState(null);
  const [filter, setFilter] = useState("open");
  const [error, setError] = useState(false);
  const isAdmin = getUser()?.role === "admin";

  const load = () => {
    const params = filter === "open" ? { acknowledged: false, limit: 200 } : { limit: 200 };
    axios
      .get(API, { params })
      .then((res) => {
        setAlerts(res.data);
        setError(false);
      })
      .catch(() => setError(true));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [filter]);

  const acknowledge = (id) => {
    axios
      .put(`${API}${id}/acknowledge`)
      .then(load)
      .catch(() => window.alert("You do not have permission to do this."));
  };

  if (error) {
    return (
      <div className="error-box">
        Cannot load alerts. Check that the backend is running on port 8000.
      </div>
    );
  }
  if (!alerts) return <p>Loading...</p>;

  return (
    <div>
      <h2>Alerts ({alerts.length})</h2>

      {!isAdmin && (
        <div className="chart-note" style={{ marginBottom: "0.75rem" }}>
          You are signed in as a viewer. Only admins can acknowledge alerts.
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${filter === "open" ? "active" : ""}`}
          onClick={() => setFilter("open")}
        >
          Open
        </button>
        <button
          className={`tab ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (EAT)</th>
              <th>Severity</th>
              <th>Type</th>
              <th>Vehicle</th>
              <th>Message</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr>
                <td colSpan="6" className="muted">No alerts.</td>
              </tr>
            )}
            {alerts.map((a) => (
              <tr key={a.id}>
                <td>{formatTime(a.created_at)}</td>
                <td>
                  <span className={`badge ${a.severity}`}>{a.severity}</span>
                </td>
                <td>{TYPE_LABELS[a.alert_type] || a.alert_type}</td>
                <td>{a.vehicle_name || "-"}</td>
                <td>{a.message}</td>
                <td>
                  {a.acknowledged ? (
                    <span className="muted">Acknowledged</span>
                  ) : isAdmin ? (
                    <button className="btn" onClick={() => acknowledge(a.id)}>
                      Acknowledge
                    </button>
                  ) : (
                    <span className="muted">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Alerts;