import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

const COLORS = {
  active: "#22c55e",
  idle: "#94a3b8",
  maintenance: "#f59e0b",
  offline: "#ef4444",
};

function makeIcon(status) {
  return L.divIcon({
    className: "",
    html: `<div class="vehicle-dot" style="background:${COLORS[status] || "#3b82f6"}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function LiveMap() {
  const [vehicles, setVehicles] = useState([]);
  const [zones, setZones] = useState([]);
  const [error, setError] = useState(false);

  // Geofences rarely change, so we load them once
  useEffect(() => {
    axios
      .get("http://localhost:8000/api/geofences/")
      .then((res) => setZones(res.data.filter((z) => z.active)))
      .catch(() => {});
  }, []);

  // Vehicle positions refresh every 3 seconds
  useEffect(() => {
    const load = () =>
      axios
        .get("http://localhost:8000/api/positions/live")
        .then((res) => {
          setVehicles(res.data);
          setError(false);
        })
        .catch(() => setError(true));

    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  const located = vehicles.filter((v) => v.latitude !== null);

  return (
    <div>
      <h2>Live Map ({located.length} vehicles)</h2>

      {error && (
        <div className="error-box" style={{ marginBottom: "0.75rem" }}>
          Cannot load positions. Check that the backend is running.
        </div>
      )}

      <div className="map-legend">
        <span><span className="dot" style={{ background: COLORS.active }}></span>Active</span>
        <span><span className="dot" style={{ background: COLORS.idle }}></span>Idle</span>
        <span><span className="dot" style={{ background: COLORS.maintenance }}></span>Maintenance</span>
        <span><span className="dot" style={{ background: COLORS.offline }}></span>Offline</span>
        <span><span className="dot" style={{ background: "#3b82f6", opacity: 0.4 }}></span>Geofence zone</span>
      </div>

      <div className="map-wrap">
        <MapContainer center={[8.9, 39.0]} zoom={8} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {zones.map((z) => (
            <Circle
              key={z.id}
              center={[z.latitude, z.longitude]}
              radius={z.radius_m}
              pathOptions={{ color: "#3b82f6", weight: 2, fillOpacity: 0.12 }}
            >
              <Popup>
                <div className="popup-title">{z.name}</div>
                <div>Radius: {z.radius_m} m</div>
              </Popup>
            </Circle>
          ))}

          {located.map((v) => (
            <Marker
              key={v.vehicle_id}
              position={[v.latitude, v.longitude]}
              icon={makeIcon(v.status)}
            >
              <Popup>
                <div className="popup-title">{v.name}</div>
                <div>Plate: {v.plate_number}</div>
                <div>Driver: {v.driver_name || "Unassigned"}</div>
                <div>Status: {v.status}</div>
                <div>Speed: {Math.round(v.speed_kmh)} km/h</div>
              </Popup>
                      </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

export default LiveMap;