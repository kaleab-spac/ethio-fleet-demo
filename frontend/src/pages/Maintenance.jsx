import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/maintenance/";

const etb = (n) => `${Math.round(n).toLocaleString()} ETB`;

function Maintenance() {
  const [reminders, setReminders] = useState(null);
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([axios.get(API + "reminders"), axios.get(API)])
      .then(([r, h]) => {
        setReminders(r.data);
        setRecords(h.data);
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="error-box">
        Cannot load data. Check that the backend is running on port 8000.
      </div>
    );
  }
  if (!reminders || !records) return <p>Loading...</p>;

  const overdue = reminders.filter((r) => r.status === "overdue").length;
  const dueSoon = reminders.filter((r) => r.status === "due_soon").length;
  const totalCost = records.reduce((sum, r) => sum + r.cost_etb, 0);

  return (
    <div>
      <h2>Maintenance</h2>

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
          <div className="label">Total service cost</div>
          <div className="value" style={{ fontSize: "1.4rem" }}>{etb(totalCost)}</div>
        </div>
      </div>

      <div className="section-title">REMINDERS</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Vehicle</th>
              <th>Service</th>
              <th>Detail</th>
              <th>Due date</th>
            </tr>
          </thead>
          <tbody>
            {reminders.length === 0 && (
              <tr>
                <td colSpan="5" className="muted">Nothing needs attention.</td>
              </tr>
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
              <th>Date</th>
              <th>Vehicle</th>
              <th>Service</th>
              <th>Description</th>
              <th>Odometer (km)</th>
              <th>Cost</th>
              <th>Next due</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.service_date}</td>
                <td>{r.vehicle_name}</td>
                <td>{r.service_type}</td>
                <td>{r.description}</td>
                <td>{Math.round(r.odometer_km).toLocaleString()}</td>
                <td>{etb(r.cost_etb)}</td>
                <td>{r.next_due_date || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Maintenance;