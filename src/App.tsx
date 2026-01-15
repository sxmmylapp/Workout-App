import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useSeedData } from './hooks/useSeedData';
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

function App() {
  useSeedData();

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
