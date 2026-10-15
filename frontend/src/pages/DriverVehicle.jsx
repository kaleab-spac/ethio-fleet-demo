import { useEffect, useState } from "react";
import axios from "axios";

function DriverVehicle() {
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/driver/vehicles")
      .then((res) => setVehicles(res.data))
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="error-box">Cannot load your vehicle.</div>;
  if (!vehicles) return <p>Loading...</p>;
  if (vehicles.length === 0) {
    return (
      <div>
        <h2>My Vehicle</h2>
        <p className="muted">No vehicle is assigned to you yet. Please contact your manager.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>My Vehicle</h2>
      {vehicles.map((v) => (
        <div className="table-wrap" key={v.id} style={{ marginBottom: "1rem" }}>
          <table>
            <tbody>
              <tr><th>Name</th><td>{v.name}</td></tr>
              <tr><th>Plate number</th><td>{v.plate_number}</td></tr>
              <tr><th>Make / Model</th><td>{v.make} {v.model} ({v.year})</td></tr>
              <tr><th>Type</th><td>{v.vehicle_type}</td></tr>
              <tr><th>Fuel</th><td>{v.fuel_type}</td></tr>
              <tr><th>Status</th><td><span className={`badge ${v.status}`}>{v.status}</span></td></tr>
              <tr><th>Odometer</th><td>{v.odometer_km.toLocaleString()} km</td></tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default DriverVehicle;