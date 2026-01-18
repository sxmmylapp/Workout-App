import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fetchHistoryFromSupabase, type SupabaseWorkout } from '../utils/sync';
import { isSupabaseConfigured } from '../lib/supabase';
import { format } from 'date-fns';
import { RefreshCw, ChevronRight } from 'lucide-react';

interface CombinedWorkout {
    id: string;
    name: string;
    date: Date;
    exerciseNames?: string[];
    isLocal: boolean;
}

export const History: React.FC = () => {
    const navigate = useNavigate();
    const [cloudWorkouts, setCloudWorkouts] = useState<SupabaseWorkout[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    // Local workouts
    const localWorkouts = useLiveQuery(() =>
        db.workouts.where('status').equals('completed').reverse().sortBy('endTime')
    );

    // Local sets for exercise names
    const localSets = useLiveQuery(async () => {
        if (!localWorkouts) return [];
        const workoutIds = localWorkouts.map(w => String(w.id));
        const allSets = await db.sets.toArray();
        return allSets.filter(s => workoutIds.includes(s.workoutId));
    }, [localWorkouts]);

    // Exercises for name lookup
    const exercises = useLiveQuery(() => db.exercises.toArray());

    const loadFromCloud = async () => {
        if (loading) return;
        setLoading(true);
        setError(null);
        try {
            const workouts = await fetchHistoryFromSupabase();
            setCloudWorkouts(workouts);
        } catch (e) {
            console.error('Failed to load history from cloud:', e);
            setError('Failed to load from cloud');
        } finally {
            setLoading(false);
            setHasFetched(true);
        }
    };

    // Fetch from cloud on mount
    useEffect(() => {
        if (isSupabaseConfigured() && !hasFetched) {
            loadFromCloud();
        }
    }, [hasFetched]);

    // Get exercise names for a local workout
    const getLocalExerciseNames = (workoutId: string): string[] => {
        if (!localSets || !exercises) return [];

        const workoutSets = localSets.filter(s => s.workoutId === workoutId);
        const exerciseIds = [...new Set(workoutSets.map(s => s.exerciseId))];

        return exerciseIds.map(id =>
            exercises.find(e => String(e.id) === id)?.name || 'Unknown'
        );
    };

    // Combine and deduplicate workouts
    const combinedWorkouts = useMemo(() => {
        const workoutsMap = new Map<string, CombinedWorkout>();

        // Add local workouts first
        if (localWorkouts && localSets && exercises) {
            for (const w of localWorkouts) {
                if (w.id && w.endTime) {
                    workoutsMap.set(String(w.id), {
                        id: String(w.id),
                        name: w.name,
                        date: w.endTime,
                        exerciseNames: getLocalExerciseNames(String(w.id)),
                        isLocal: true,
                    });
                }
            }
        }

        // Add cloud workouts (non-duplicates only)
        for (const w of cloudWorkouts) {
            const cloudDate = new Date(w.date);
            let found = false;

            for (const existing of workoutsMap.values()) {
                const sameDay = format(existing.date, 'yyyy-MM-dd') === format(cloudDate, 'yyyy-MM-dd');
                const sameName = existing.name === w.name;
                if (sameDay && sameName) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                // Use cloud-{local_id} format for cloud-only workouts
                const id = `cloud-${w.id}`;
                workoutsMap.set(id, {
                    id,
                    name: w.name,
                    date: cloudDate,
                    exerciseNames: w.exercises?.map(ex => ex.name),
                    isLocal: false,
                });
            }
        }

        return Array.from(workoutsMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [localWorkouts, localSets, exercises, cloudWorkouts]);



    const handleWorkoutClick = (workout: CombinedWorkout) => {
        // Navigate for all workouts - WorkoutDetail handles cloud fetching
        navigate(`/history/${workout.id}`);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">History</h1>
                <button
                    onClick={loadFromCloud}
                    disabled={loading}
                    className="text-green-400 p-2 hover:bg-zinc-800 rounded-full"
                >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading && (
                <p className="text-zinc-500 text-center py-4">Loading...</p>
            )}

            {error && (
                <p className="text-red-500 text-center py-4">{error}</p>
            )}

            {!loading && combinedWorkouts.length === 0 && (
                <div className="text-center py-8 space-y-2">
                    <p className="text-zinc-500">No workouts yet.</p>
                </div>
            )}

            <div className="space-y-3">
                {combinedWorkouts.map((workout) => (
                    <div
                        key={workout.id}
                        onClick={() => handleWorkoutClick(workout)}
                        className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 transition-colors cursor-pointer hover:bg-zinc-800/50"
                    >
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="font-bold text-lg">{workout.name}</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-400">
                                    {format(workout.date, 'MMM d, yyyy')}
                                </span>
                                {!workout.isLocal && (
                                    <span className="text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded">☁️</span>
                                )}
                                <ChevronRight size={18} className="text-zinc-600" />
                            </div>
                        </div>
                        <div className="text-sm text-zinc-500">
                            {workout.exerciseNames && workout.exerciseNames.length > 0 ? (
                                workout.exerciseNames.join(', ')
                            ) : (
                                format(workout.date, 'h:mm a')
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
