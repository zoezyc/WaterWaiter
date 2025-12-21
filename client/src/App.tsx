import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './services/supabase';
import Layout from './components/Layout';

import RobotPage from './pages/RobotPage';
import MonitorPage from './pages/MonitorPage';
import ManualPage from './pages/ManualPage';
import AutoPage from './pages/AutoPage';
import EventsPage from './pages/EventsPage';
import DrinksPage from './pages/DrinksPage';
import LoginPage from './pages/LoginPage';

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
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<RobotPage />} />
        <Route path="manual" element={<ManualPage />} />
        <Route path="autonomous" element={<AutoPage />} />
        <Route path="monitoring" element={<MonitorPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="drinks" element={<DrinksPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
