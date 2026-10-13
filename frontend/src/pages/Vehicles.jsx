import { useEffect, useState } from "react";
import axios from "axios";

function Vehicles() {
  const [vehicles, setVehicles] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get("http://localhost:8000/api/vehicles/"),
      axios.get("http://localhost:8000/api/drivers/"),
    ])
      .then(([v, d]) => {
        setVehicles(v.data);
        setDrivers(d.data);
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
  if (!vehicles) return <p>Loading...</p>;

  const driverName = (id) => {
    const d = drivers.find((x) => x.id === id);
    return d ? d.full_name : "Unassigned";
  };

  return (
    <div>
      <h2>Vehicles ({vehicles.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Plate</th>
              <th>Make / Model</th>
              <th>Year</th>
              <th>Type</th>
              <th>Status</th>
              <th>Odometer (km)</th>
              <th>Driver</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.plate_number}</td>
                <td>
                  {v.make} {v.model}
                </td>
                <td>{v.year}</td>
                <td>{v.vehicle_type}</td>
                <td>
                  <span className={`badge ${v.status}`}>{v.status}</span>
                </td>
                <td>{v.odometer_km.toLocaleString()}</td>
                <td>{driverName(v.driver_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Vehicles;