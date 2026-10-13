import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [status, setStatus] = useState("Checking...");

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/health")
      .then((res) => setStatus(`Backend says: ${res.data.status}`))
      .catch(() => setStatus("Cannot reach backend"));
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Fleet Management System</h1>
      <p>{status}</p>
    </div>
  );
}

export default App;