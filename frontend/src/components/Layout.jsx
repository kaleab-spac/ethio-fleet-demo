import { NavLink, Outlet } from "react-router-dom";

function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          Ethio Fleet
          <small>Fleet Management</small>
        </div>

        <NavLink to="/" end className="nav-link">
          Dashboard
        </NavLink>
        <NavLink to="/map" className="nav-link">
          Live Map
        </NavLink>
        <NavLink to="/vehicles" className="nav-link">
          Vehicles
        </NavLink>
        <NavLink to="/drivers" className="nav-link">
          Drivers
        </NavLink>

        <span className="nav-soon">Alerts (soon)</span>
        <span className="nav-soon">Reports (soon)</span>
      </aside>

      <div className="main">
        <header className="topbar">
          <strong>Fleet Operations</strong>
          <span className="user">Kaleab Getnet</span>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;