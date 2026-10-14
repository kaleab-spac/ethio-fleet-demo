import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";

const API = "http://localhost:8000/api/reports/";

const STATUS_COLORS = {
  active: "#22c55e",
  idle: "#94a3b8",
  maintenance: "#f59e0b",
  offline: "#ef4444",
};

const etb = (n) => `${Math.round(n).toLocaleString()} ETB`;

// Turn a list of objects into a CSV file and download it
function downloadCsv(filename, rows, columns) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((r) => columns.map((c) => escape(r[c.key])).join(","));
  // The leading \uFEFF helps Excel read the file correctly
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const FUEL_COLUMNS = [
  { key: "fuel_date", label: "Date" },
  { key: "vehicle_name", label: "Vehicle" },
  { key: "liters", label: "Liters" },
  { key: "price_per_liter_etb", label: "Price per liter (ETB)" },
  { key: "total_cost_etb", label: "Total cost (ETB)" },
  { key: "odometer_km", label: "Odometer (km)" },
];

const MAINT_COLUMNS = [
  { key: "service_date", label: "Date" },
  { key: "vehicle_name", label: "Vehicle" },
  { key: "service_type", label: "Service" },
  { key: "description", label: "Description" },
  { key: "odometer_km", label: "Odometer (km)" },
  { key: "cost_etb", label: "Cost (ETB)" },
  { key: "next_due_date", label: "Next due date" },
];

function Reports() {
  const [fuel, setFuel] = useState(null);
  const [status, setStatus] = useState(null);
  const [safety, setSafety] = useState(null);
  const [costs, setCosts] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get(API + "fuel-by-month"),
      axios.get(API + "fleet-status"),
      axios.get(API + "driver-safety"),
      axios.get(API + "cost-by-vehicle"),
    ])
      .then(([f, s, d, c]) => {
        setFuel(f.data);
        setStatus(s.data);
        setSafety(d.data);
        setCosts(c.data);
      })
      .catch(() => setError(true));
  }, []);

  const exportFuel = () =>
    axios.get("http://localhost:8000/api/fuel/").then((res) =>
      downloadCsv("fuel-records.csv", res.data, FUEL_COLUMNS)
    );

  const exportMaintenance = () =>
    axios.get("http://localhost:8000/api/maintenance/").then((res) =>
      downloadCsv("maintenance-records.csv", res.data, MAINT_COLUMNS)
    );

  if (error) {
    return (
      <div className="error-box">
        Cannot load reports. Check that the backend is running on port 8000.
      </div>
    );
  }
  if (!fuel || !status || !safety || !costs) return <p>Loading...</p>;

  const safetyData = safety.map((d) => ({
    name: d.name,
    score: d.safety_score,
    fill: d.safety_score < 70 ? "#ef4444" : d.safety_score < 85 ? "#f59e0b" : "#22c55e",
  }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Reports</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn" onClick={exportFuel}>Download fuel CSV</button>
          <button className="btn" onClick={exportMaintenance}>Download maintenance CSV</button>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Fuel cost by month (ETB)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fuel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v) => etb(v)} />
              <Bar dataKey="cost_etb" name="Fuel cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-note">
            The first month has only a few fill-ups, and the current month is not finished yet.
          </div>
        </div>

        <div className="chart-card">
          <h3>Fleet status</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={status}
                dataKey="count"
                nameKey="status"
                innerRadius={55}
                outerRadius={95}
                label={(e) => `${e.status} (${e.count})`}
              >
                {status.map((s) => (
                  <Cell key={s.status} fill={STATUS_COLORS[s.status] || "#3b82f6"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Driver safety scores (lowest first)</h3>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={safetyData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={120} />
              <Tooltip />
              <Bar dataKey="score" name="Safety score" radius={[0, 4, 4, 0]}>
                {safetyData.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Total cost by vehicle (ETB)</h3>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={costs}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="vehicle" interval={0} angle={-35} textAnchor="end" height={70} />
              <YAxis />
              <Tooltip formatter={(v) => etb(v)} />
              <Legend verticalAlign="top" />
              <Bar dataKey="fuel_etb" name="Fuel" stackId="a" fill="#3b82f6" />
              <Bar dataKey="maintenance_etb" name="Maintenance" stackId="a" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Reports;