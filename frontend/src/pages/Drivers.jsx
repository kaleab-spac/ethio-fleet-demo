import { useEffect, useState } from "react";
import axios from "axios";

function licenseState(expiry) {
  if (!expiry) return { text: "-", style: {} };
  const today = new Date();
  const days = Math.ceil((new Date(expiry) - today) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `${expiry} (expired)`, style: { color: "#b91c1c", fontWeight: 600 } };
  if (days <= 60) return { text: `${expiry} (${days} days)`, style: { color: "#b45309", fontWeight: 600 } };
  return { text: expiry, style: {} };
}

function Drivers() {
  const [drivers, setDrivers] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/drivers/")
      .then((res) => setDrivers(res.data))
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="error-box">
        Cannot load data. Check that the backend is running on port 8000.
      </div>
    );
  }
  if (!drivers) return <p>Loading...</p>;

  return (
    <div>
      <h2>Drivers ({drivers.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>License No.</th>
              <th>Class</th>
              <th>License expiry</th>
              <th>Status</th>
              <th>Safety score</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const lic = licenseState(d.license_expiry);
              return (
                <tr key={d.id}>
                  <td>{d.full_name}</td>
                  <td>{d.phone}</td>
                  <td>{d.license_number}</td>
                  <td>{d.license_class}</td>
                  <td style={lic.style}>{lic.text}</td>
                  <td>
                    <span className={`badge ${d.status}`}>{d.status}</span>
                  </td>
                  <td
                    style={{
                      color: d.safety_score < 70 ? "#b91c1c" : "inherit",
                      fontWeight: d.safety_score < 70 ? 600 : 400,
                    }}
                  >
                    {d.safety_score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Drivers;