// App — the list of pages and their URLs.
import { Link, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/Common';
import Layout from './components/Layout';
import CalendarPage from './pages/CalendarPage';
import EventDetailsPage from './pages/EventDetailsPage';
import EventFormPage from './pages/EventFormPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import MyEventsPage from './pages/MyEventsPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Everything else needs a logged-in user and shows the bottom nav */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/events/new" element={<EventFormPage />} />
        <Route path="/events/:eventId" element={<EventDetailsPage />} />
        <Route path="/events/:eventId/edit" element={<EventFormPage />} />
        <Route path="/my-events" element={<MyEventsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="*"
          element={
            <div className="card center">
              <h1>Page not found</h1>
              <Link to="/">Go home</Link>
            </div>
          }
        />
      </Route>
    </Routes>
  );
}
