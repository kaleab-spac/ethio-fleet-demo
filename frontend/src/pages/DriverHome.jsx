import { useEffect, useState } from "react";
import axios from "axios";

function licenseInfo(expiry) {
  if (!expiry) return { text: "Not recorded", color: "grey" };
  const days = Math.ceil((new Date(expiry) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: `Expired on ${expiry}`, color: "red" };
  if (days <= 60) return { text: `Expires in ${days} days (${expiry})`, color: "orange" };
  return { text: `Valid until ${expiry}`, color: "green" };
}

function DriverHome() {
  const [profile, setProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      axios.get("http://localhost:8000/api/driver/profile"),
      axios.get("http://localhost:8000/api/driver/vehicles"),
    ])
      .then(([p, v]) => {
        setProfile(p.data);
        setVehicles(v.data);
      })
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="error-box">Cannot load your data. Check that the backend is running.</div>;
  if (!profile) return <p>Loading...</p>;

  const lic = licenseInfo(profile.license_expiry);

  return (
    <div>
      <h2>Welcome, {profile.full_name}</h2>
      <div className="cards">
        <div className="card green">
          <div className="label">Assigned vehicle</div>
          <div className="value" style={{ fontSize: "1.4rem" }}>
            {vehicles.length ? vehicles[0].name : "None"}
          </div>
        </div>
        <div className={`card ${lic.color}`}>
          <div className="label">Driving license</div>
          <div style={{ marginTop: "0.4rem", fontWeight: 600 }}>{lic.text}</div>
        </div>
        <div className={`card ${profile.safety_score < 70 ? "red" : "green"}`}>
          <div className="label">Safety score</div>
          <div className="value">{profile.safety_score}</div>
        </div>
      </div>

      <div className="section-title">MY DETAILS</div>
      <div className="table-wrap">
        <table>
          <tbody>
            <tr><th>Phone</th><td>{profile.phone || "-"}</td></tr>
            <tr><th>License number</th><td>{profile.license_number}</td></tr>
            <tr><th>License class</th><td>{profile.license_class || "-"}</td></tr>
            <tr><th>Status</th><td>{profile.status}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DriverHome;