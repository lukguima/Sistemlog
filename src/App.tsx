import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Public & Auth
import LandingPage from './pages/public/LandingPage';
import Login from './pages/auth/Login';
import Register from './pages/public/Register';

// Admin (Logistics)
import AdminDashboard from './pages/admin/AdminDashboard';
import Settings from './pages/admin/Settings';
import Settlement from './pages/admin/Settlement';
import Financial from './pages/admin/Financial';
import CashFlow from './pages/admin/CashFlow';
import DRE from './pages/admin/DRE';
import Reports from './pages/admin/Reports';
import Maintenance from './pages/admin/Maintenance';
import TyreCheck from './pages/admin/TyreCheck';
import Fleet from './pages/admin/Fleet';
import Trips from './pages/admin/Trips';
import Fuel from './pages/admin/Fuel';
import Suppliers from './pages/admin/Suppliers';
import AdminLayout from './components/layout/AdminLayout';

// Master SaaS
import MasterDashboard from './pages/master/MasterDashboard';
import Customers from './pages/master/Customers';
import Subscriptions from './pages/master/Subscriptions';
import MasterUsers from './pages/master/MasterUsers';
import GlobalSettings from './pages/master/GlobalSettings';
import MasterLayout from './components/layout/MasterLayout';

// Driver
import DriverHome from './pages/driver/DriverApp';
import NewRefuel from './pages/driver/NewRefuel';

// Support
import Welcome from './pages/support/Welcome';
import HelpCenter from './pages/support/HelpCenter';

function App() {
  return (
    <Router>
      <Routes>
        {/* ── Público ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/help-center" element={<HelpCenter />} />

        {/* ── Admin Logística (role: admin ou master) ── */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settlement" element={<Settlement />} />
            <Route path="tyre-check" element={<TyreCheck />} />
            <Route path="fleet" element={<Fleet />} />
            <Route path="trips" element={<Trips />} />
            <Route path="reports" element={<Reports />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="fuel" element={<Fuel />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="financial" element={<Financial />} />
            <Route path="cash-flow" element={<CashFlow />} />
            <Route path="dre" element={<DRE />} />
          </Route>
        </Route>

        {/* ── Master SaaS (role: master apenas) ── */}
        <Route element={<ProtectedRoute requiredRole="master" />}>
          <Route path="/saas-master" element={<MasterLayout />}>
            <Route index element={<MasterDashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="users" element={<MasterUsers />} />
            <Route path="settings" element={<GlobalSettings />} />
          </Route>
        </Route>

        {/* ── Driver (role: driver) ── */}
        <Route element={<ProtectedRoute requiredRole="driver" />}>
          <Route path="/driver/home" element={<DriverHome />} />
          <Route path="/driver/refuel" element={<NewRefuel />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
