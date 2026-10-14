import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { saveLogin } from "../auth.js";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    axios
      .post("http://localhost:8000/api/auth/login", { username, password })
      .then((res) => {
        saveLogin(res.data);
        navigate("/");
      })
      .catch((err) => {
        if (err.response && err.response.status === 401) {
          setError("Wrong username or password.");
        } else {
          setError("Cannot reach the server. Is the backend running?");
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Ethio Fleet</h1>
        <div className="sub">Sign in to the fleet management system</div>

        {error && (
          <div className="error-box" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;