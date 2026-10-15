import { NavLink, Outlet } from "react-router-dom";
import { getUser, logout } from "../auth.js";

function DriverLayout() {
  const user = getUser();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Ethio Fleet
          <small>Driver Portal</small>
        </div>
        <NavLink to="/driver" end className="nav-link">
          My Dashboard
        </NavLink>
        <NavLink to="/driver/vehicle" className="nav-link">
          My Vehicle
        </NavLink>
        <NavLink to="/driver/defects" className="nav-link">
          Report a defect
        </NavLink>
      </aside>

      <div className="main">
        <header className="topbar">
          <strong>Driver Portal</strong>
          <span className="user">
            {user ? user.full_name : ""}
            {user && <span className="role-tag">{user.role}</span>}
            <button className="logout-btn" onClick={logout}>
              Logout
            </button>
          </span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DriverLayout;