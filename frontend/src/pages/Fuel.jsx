import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000/api/fuel/";

const etb = (n) => `${Math.round(n).toLocaleString()} ETB`;

function Fuel() {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([axios.get(API + "summary"), axios.get(API)])
      .then(([s, l]) => {
        setSummary(s.data);
        setLogs(l.data);
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
  if (!summary || !logs) return <p>Loading...</p>;

  // Highest cost per km first
  const ranked = [...summary.vehicles]
    .filter((v) => v.cost_per_km_etb !== null)
    .sort((a, b) => b.cost_per_km_etb - a.cost_per_km_etb);

  return (
    <div>
      <h2>Fuel</h2>

      <div className="cards">
        <div className="card orange">
          <div className="label">Fuel cost this month</div>
          <div className="value" style={{ fontSize: "1.4rem" }}>
            {etb(summary.month_cost_etb)}
          </div>
        </div>
        <div className="card">
          <div className="label">Liters this month</div>
          <div className="value">{Math.round(summary.month_liters)}</div>
        </div>
        <div className="card grey">
          <div className="label">Fill-ups recorded</div>
          <div className="value">{logs.length}</div>
        </div>
      </div>

      <div className="section-title">COST PER KM (HIGHEST FIRST)</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Fill-ups</th>
              <th>Liters</th>
              <th>Distance (km)</th>
              <th>Total cost</th>
              <th>Cost per km</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((v) => (
              <tr key={v.vehicle_id}>
                <td>{v.vehicle_name}</td>
                <td>{v.fill_ups}</td>
                <td>{Math.round(v.total_liters)}</td>
                <td>{Math.round(v.distance_km).toLocaleString()}</td>
                <td>{etb(v.total_cost_etb)}</td>
                <td style={{ fontWeight: 600 }}>{v.cost_per_km_etb.toFixed(2)} ETB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">FUEL HISTORY ({logs.length})</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Vehicle</th>
              <th>Liters</th>
              <th>Price / liter</th>
              <th>Total</th>
              <th>Odometer (km)</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.fuel_date}</td>
                <td>{l.vehicle_name}</td>
                <td>{l.liters}</td>
                <td>{l.price_per_liter_etb.toFixed(2)} ETB</td>
                <td>{etb(l.total_cost_etb)}</td>
                <td>{Math.round(l.odometer_km).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Fuel;