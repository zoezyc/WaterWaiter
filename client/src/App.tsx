import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

import RobotPage from './pages/RobotPage';
import MonitorPage from './pages/MonitorPage';
import ManualPage from './pages/ManualPage';
import AutoPage from './pages/AutoPage';
import EventsPage from './pages/EventsPage';
import DrinksPage from './pages/DrinksPage';

// Placeholder Pages
// const SettingsPage = () => <div className="p-4">App Settings</div>;

function App() {
  return (
    <Routes>
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
