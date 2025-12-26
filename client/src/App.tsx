import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import { AuthProvider } from './contexts/AuthContext';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRedirect from './components/RoleBasedRedirect';

import RobotPage from './pages/RobotPage';
import MonitorPage from './pages/MonitorPage';
import ManualPage from './pages/ManualPage';
import AutoPage from './pages/AutoPage';
import EventsPage from './pages/EventsPage';
import DrinksPage from './pages/DrinksPage';
import InventoryPage from './pages/InventoryPage';
import ActivityLogPage from './pages/ActivityLogPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LoginPage from './pages/LoginPage';
import ClientTabletDashboard from './pages/ClientTabletDashboard';
import StaffTabletDashboard from './pages/StaffTabletDashboard';

function App() {

  // Optional: Global Auth Listener
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event, session?.user?.email);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthProvider>
      <Routes>
        {/* Login Route - Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Client Tablet Route - Client Role Only */}
        <Route
          path="/client"
          element={
            <ProtectedRoute allowedRoles={['client']}>
              <ClientTabletDashboard />
            </ProtectedRoute>
          }
        />

        {/* Staff Tablet Route - Staff Role Only */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={['staff']}>
              <StaffTabletDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin Dashboard Routes - Admin Role Only */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RobotPage />} />
          <Route path="manual" element={<ManualPage />} />
          <Route path="autonomous" element={<AutoPage />} />
          <Route path="monitoring" element={<MonitorPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="drinks" element={<DrinksPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="activity" element={<ActivityLogPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Root - Redirect based on role */}
        <Route path="/" element={<RoleBasedRedirect />} />

        {/* Catch all - redirect to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
