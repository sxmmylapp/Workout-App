import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { useSeedData } from './hooks/useSeedData';
import { cleanupMuscleGroups } from './db';
import { Home } from './pages/Home';
import { Exercises } from './pages/Exercises';
import { ExerciseDetail } from './pages/ExerciseDetail';
import { History } from './pages/History';
import { WorkoutDetail } from './pages/WorkoutDetail';
import { ActiveWorkout } from './pages/ActiveWorkout';
import { Templates } from './pages/Templates';
import { TemplateDetail } from './pages/TemplateDetail';
import { Schedule } from './pages/Schedule';
import { ScheduledWorkoutDetail } from './pages/ScheduledWorkoutDetail';
import { ScheduleCustomize } from './pages/ScheduleCustomize';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppContent() {
  useSeedData();
  const { user, loading } = useAuth();

  // Run data cleanup on app startup
  useEffect(() => {
    cleanupMuscleGroups();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/workout/:id" element={<ActiveWorkout />} />
              <Route path="/exercises" element={<Exercises />} />
              <Route path="/exercises/:id" element={<ExerciseDetail />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:id" element={<WorkoutDetail />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/schedule/:id" element={<ScheduledWorkoutDetail />} />
              <Route path="/schedule/customize/:templateId" element={<ScheduleCustomize />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/templates/:id" element={<TemplateDetail />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
