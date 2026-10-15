import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import DriverLayout from "./components/DriverLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Vehicles from "./pages/Vehicles.jsx";
import Drivers from "./pages/Drivers.jsx";
import LiveMap from "./pages/LiveMap.jsx";
import Alerts from "./pages/Alerts.jsx";
import Defects from "./pages/Defects.jsx";
import Maintenance from "./pages/Maintenance.jsx";
import Fuel from "./pages/Fuel.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";
import AuditLog from "./pages/AuditLog.jsx";
import Notifications from "./pages/Notifications.jsx";
import Login from "./pages/Login.jsx";
import DriverHome from "./pages/DriverHome.jsx";
import DriverVehicle from "./pages/DriverVehicle.jsx";
import DriverDefects from "./pages/DriverDefects.jsx";
import { getUser } from "./auth.js";

// Managers and viewers only. Drivers are sent to their own portal.
function RequireStaff({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "driver") return <Navigate to="/driver" replace />;
  return children;
}

// Drivers only. Everyone else goes to the main dashboard.
function RequireDriver({ children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "driver") return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <RequireStaff>
            <Layout />
          </RequireStaff>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/map" element={<LiveMap />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/defects" element={<Defects />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/fuel" element={<Fuel />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<Users />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/notifications" element={<Notifications />} />
      </Route>

      <Route
        element={
          <RequireDriver>
            <DriverLayout />
          </RequireDriver>
        }
      >
        <Route path="/driver" element={<DriverHome />} />
        <Route path="/driver/vehicle" element={<DriverVehicle />} />
        <Route path="/driver/defects" element={<DriverDefects />} />
        <Route path="/driver/notifications" element={<Notifications />} />
      </Route>
    </Routes>
  );
}

export default App;