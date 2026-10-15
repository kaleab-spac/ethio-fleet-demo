import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import axios from "axios";
import { getUser, logout } from "../auth.js";
import Bell from "./Bell.jsx";

function Layout() {
  const [openAlerts, setOpenAlerts] = useState(0);
  const user = getUser();

  useEffect(() => {
    const load = () =>
      axios
        .get("http://localhost:8000/api/alerts/", {
          params: { acknowledged: false, limit: 500 },
        })
        .then((res) => setOpenAlerts(res.data.length))
        .catch(() => {});

    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Ethio Fleet
          <small>Fleet Management</small>
        </div>

        <NavLink to="/" end className="nav-link">Dashboard</NavLink>
        <NavLink to="/map" className="nav-link">Live Map</NavLink>
        <NavLink to="/vehicles" className="nav-link">Vehicles</NavLink>
        <NavLink to="/drivers" className="nav-link">Drivers</NavLink>
        <NavLink to="/alerts" className="nav-link">
          Alerts
          {openAlerts > 0 && <span className="nav-badge">{openAlerts}</span>}
        </NavLink>
        <NavLink to="/defects" className="nav-link">Defects</NavLink>
        <NavLink to="/maintenance" className="nav-link">Maintenance</NavLink>
        <NavLink to="/fuel" className="nav-link">Fuel</NavLink>
        <NavLink to="/reports" className="nav-link">Reports</NavLink>
        {user?.role === "admin" && (
          <>
            <NavLink to="/users" className="nav-link">Users</NavLink>
            <NavLink to="/audit" className="nav-link">Audit log</NavLink>
          </>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <strong>Fleet Operations</strong>
          <span className="user">
            <Bell to="/notifications" />
            {user ? user.full_name : ""}
            {user && <span className="role-tag">{user.role}</span>}
            <button className="logout-btn" onClick={logout}>Logout</button>
          </span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;