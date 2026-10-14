import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Vehicles from "./pages/Vehicles.jsx";
import Drivers from "./pages/Drivers.jsx";
import LiveMap from "./pages/LiveMap.jsx";
import Alerts from "./pages/Alerts.jsx";
import Maintenance from "./pages/Maintenance.jsx";
import Fuel from "./pages/Fuel.jsx";
import Reports from "./pages/Reports.jsx";
import Users from "./pages/Users.jsx";
import Login from "./pages/Login.jsx";
import { getUser } from "./auth.js";

// Only logged-in users can see the app pages
function RequireLogin({ children }) {
  return getUser() ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireLogin>
            <Layout />
          </RequireLogin>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/map" element={<LiveMap />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/fuel" element={<Fuel />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<Users />} />
        
      </Route>
    </Routes>
  );
}

export default App;