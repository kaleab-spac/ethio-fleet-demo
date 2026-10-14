import { useEffect, useState } from "react";
import axios from "axios";

function Card({ label, value, color = "" }) {
  return (
    <div className={`card ${color}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [fuel, setFuel] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/dashboard/summary")
      .then((res) => setData(res.data))
      .catch(() => setError(true));
    axios
      .get("http://localhost:8000/api/fuel/summary")
      .then((res) => setFuel(res.data))
      .catch(() => {});
    axios
      .get("http://localhost:8000/api/maintenance/reminders")
      .then((res) => setReminders(res.data))
      .catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="error-box">
        Cannot load data. Check that the backend is running on port 8000.
      </div>
    );
  }

  if (!data) return <p>Loading...</p>;

  const v = data.vehicles;
  const d = data.drivers;
  const overdue = reminders.filter((r) => r.status === "overdue").length;

  return (
    <div>
      <h2>Dashboard</h2>

      <div className="section-title">VEHICLES</div>
      <div className="cards">
        <Card label="Total vehicles" value={v.total} />
        <Card label="Active" value={v.active} color="green" />
        <Card label="Idle" value={v.idle} color="grey" />
        <Card label="In maintenance" value={v.maintenance} color="orange" />
        <Card label="Offline" value={v.offline} color="red" />
        <Card label="Unassigned" value={v.unassigned} color="orange" />
      </div>

      <div className="section-title">DRIVERS</div>
      <div className="cards">
        <Card label="Total drivers" value={d.total} />
        <Card label="Licenses expired" value={d.licenses_expired} color="red" />
        <Card
          label="Expiring in 60 days"
          value={d.licenses_expiring_60_days}
          color="orange"
        />
        <Card label="Low safety score" value={d.low_safety_score} color="red" />
      </div>

      <div className="section-title">COSTS AND SERVICE</div>
      <div className="cards">
        <Card
          label="Fuel cost this month"
          value={
            fuel ? `${Math.round(fuel.month_cost_etb).toLocaleString()} ETB` : "-"
          }
          color="orange"
        />
        <Card label="Service overdue" value={overdue} color="red" />
        <Card label="Service due soon" value={reminders.length - overdue} color="orange" />
      </div>
    </div>
  );
}

export default Dashboard;