import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, CalendarDays, FileText, LayoutTemplate } from 'lucide-react';
import { db, type ScheduledWorkout } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfDay } from 'date-fns';

export const Home: React.FC = () => {
    const navigate = useNavigate();

    // Check for any active (in-progress) workout
    const activeWorkout = useLiveQuery(() =>
        db.workouts.where('status').equals('active').first()
    );

    // Get today's scheduled workouts
    const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd');
    const todayScheduled = useLiveQuery(() =>
        db.scheduledWorkouts.where('date').equals(todayStr).toArray(),
        [todayStr]
    );

    // Get exercises for name lookup
    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Memoized exercise name lookup map - O(1) instead of O(n)
    const exerciseNameMap = useMemo(() =>
        new Map(exercises?.map(e => [String(e.id), e.name]) || [])
        , [exercises]);

    const getExerciseName = (exerciseId: string, exerciseName?: string) =>
        exerciseNameMap.get(exerciseId) || exerciseName || 'Unknown';

    const startNewWorkout = async () => {
        const id = await db.workouts.add({
            name: 'New Workout',
            startTime: new Date(),
            status: 'active'
        });
        navigate(`/workout/${id}`);
    };

    const resumeWorkout = () => {
        if (activeWorkout?.id) {
            navigate(`/workout/${activeWorkout.id}`);
        }
    };

    const startScheduledWorkout = async (scheduled: ScheduledWorkout) => {
        // Skip if no exercises (old scheduled workout without data)
        if (!scheduled.exercises || scheduled.exercises.length === 0) {
            alert('This scheduled workout has no exercises. Please delete and re-schedule it.');
            return;
        }

        const workoutId = await db.workouts.add({
            name: scheduled.templateName || 'Workout',
            startTime: new Date(),
            status: 'active'
        });

        // Add sets from scheduled workout's exercises
        for (const exercise of scheduled.exercises) {
            // Use exercise's instanceId or generate a new one
            const instanceId = exercise.instanceId || `${exercise.exerciseId}-${crypto.randomUUID()}`;
            for (let i = 0; i < exercise.sets.length; i++) {
                const set = exercise.sets[i];
                await db.sets.add({
                    workoutId: String(workoutId),
                    exerciseId: exercise.exerciseId,
                    instanceId,
                    setNumber: i + 1,
                    weight: set.targetWeight,
                    reps: set.targetReps,
                    completed: false,
                    timestamp: new Date()
                });
            }
        }

        // Mark scheduled as completed
        await db.scheduledWorkouts.update(scheduled.id!, { completed: true });

        // Update template lastUsed
        await db.templates.update(scheduled.templateId, { lastUsed: new Date() });

        navigate(`/workout/${workoutId}`);
    };

    // Filter to uncompleted scheduled workouts for today (only those with exercises)
    const pendingTodayScheduled = todayScheduled?.filter(s => !s.completed && s.exercises && s.exercises.length > 0) || [];

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold text-white">Let's Lift</h1>
                <p className="text-zinc-400">Ready to crush it?</p>
            </header>

            <div className="grid gap-4">
                {/* Resume Active Workout - Show if there's one in progress */}
                {activeWorkout && (
                    <button
                        onClick={resumeWorkout}
                        className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white p-6 rounded-2xl flex items-center justify-between group transition-all animate-pulse"
                    >
                        <div className="flex flex-col items-start">
                            <span className="text-xl font-bold">Resume Workout</span>
                            <span className="text-green-200 text-sm">{activeWorkout.name}</span>
                        </div>
                        <div className="bg-green-500 p-3 rounded-full group-hover:scale-110 transition-transform">
                            <Play size={24} />
                        </div>
                    </button>
                )}

                {/* Today's Scheduled Workouts */}
                {!activeWorkout && pendingTodayScheduled.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <CalendarDays size={18} className="text-blue-400" />
                            <h2 className="text-lg font-bold">Today's Workout</h2>
                        </div>

                        {pendingTodayScheduled.map(scheduled => (
                            <button
                                key={scheduled.id}
                                onClick={() => startScheduledWorkout(scheduled)}
                                className="w-full bg-gradient-to-r from-green-900/50 to-blue-900/50 border border-green-800/50 p-5 rounded-2xl flex items-center justify-between group transition-all hover:from-green-900/70 hover:to-blue-900/70"
                            >
                                <div className="text-left">
                                    <h3 className="text-xl font-bold">{scheduled.templateName}</h3>
                                    {scheduled.notes && (
                                        <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
                                            <FileText size={12} />
                                            {scheduled.notes}
                                        </p>
                                    )}
                                    <p className="text-sm text-zinc-500 mt-1">
                                        {scheduled.exercises?.map(e => getExerciseName(e.exerciseId, e.exerciseName)).slice(0, 3).join(', ') || 'No exercises'}
                                    </p>
                                </div>
                                <div className="bg-green-600 p-3 rounded-full group-hover:scale-110 transition-transform">
                                    <Play size={24} />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Start New Workout - Only show if no active workout */}
                {!activeWorkout && (
                    <button
                        onClick={startNewWorkout}
                        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white p-6 rounded-2xl flex items-center justify-between group transition-all"
                    >
                        <div className="flex flex-col items-start">
                            <span className="text-xl font-bold">Start Empty Workout</span>
                            <span className="text-blue-200 text-sm">Build as you go</span>
                        </div>
                        <div className="bg-blue-500 p-3 rounded-full group-hover:scale-110 transition-transform">
                            <Plus size={24} />
                        </div>
                    </button>
                )}

                {/* Link to Schedule */}
                {!activeWorkout && (
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => navigate('/schedule')}
                            className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                            <div className="flex flex-col items-start gap-3">
                                <CalendarDays size={24} className="text-blue-400" />
                                <div className="text-left">
                                    <h3 className="font-bold text-lg">Schedule</h3>
                                    <p className="text-sm text-zinc-500">Plan workouts</p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => navigate('/templates')}
                            className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                            <div className="flex flex-col items-start gap-3">
                                <LayoutTemplate size={24} className="text-purple-400" />
                                <div className="text-left">
                                    <h3 className="font-bold text-lg">Templates</h3>
                                    <p className="text-sm text-zinc-500">Manage routines</p>
                                </div>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
