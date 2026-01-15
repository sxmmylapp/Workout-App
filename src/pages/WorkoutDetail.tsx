import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fetchWorkoutDetailFromCloud, type SupabaseWorkout } from '../utils/sync';
import { ArrowLeft, Calendar, Clock, Dumbbell, Cloud } from 'lucide-react';
import { format } from 'date-fns';

interface ExerciseDetail {
    name: string;
    sets: { setNumber: number; weight: number; reps: number; completed?: boolean }[];
}

export const WorkoutDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Detect if this is a cloud workout (id starts with "cloud-")
    const isCloudWorkout = id?.startsWith('cloud-');
    const localId = isCloudWorkout ? id?.replace('cloud-', '') : id;

    // State for cloud workout data
    const [cloudWorkout, setCloudWorkout] = useState<SupabaseWorkout | null>(null);
    const [cloudLoading, setCloudLoading] = useState(false);
    const [cloudError, setCloudError] = useState<string | null>(null);

    // Load local workout (only if not a cloud workout)
    const localWorkout = useLiveQuery(
        () => isCloudWorkout ? undefined : db.workouts.get(Number(id)),
        [id, isCloudWorkout]
    );

    // Load local sets
    const localSets = useLiveQuery(
        async () => isCloudWorkout ? [] : db.sets.where('workoutId').equals(id!).toArray(),
        [id, isCloudWorkout]
    );

    // Load exercises for local name lookup
    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Fetch cloud workout if needed
    useEffect(() => {
        if (isCloudWorkout && localId) {
            setCloudLoading(true);
            setCloudError(null);
            fetchWorkoutDetailFromCloud(localId)
                .then(data => {
                    if (data) {
                        setCloudWorkout(data);
                    } else {
                        setCloudError('Could not load workout from cloud');
                    }
                })
                .catch(() => setCloudError('Failed to connect to cloud'))
                .finally(() => setCloudLoading(false));
        }
    }, [isCloudWorkout, localId]);

    // Build data from either source
    let workoutName = '';
    let workoutDate = new Date();
    let duration: number | null = null;
    let exerciseDetails: ExerciseDetail[] = [];
    let totalVolume = 0;
    let totalSets = 0;

    if (isCloudWorkout && cloudWorkout) {
        // Cloud data
        workoutName = cloudWorkout.name;
        workoutDate = new Date(cloudWorkout.date);
        duration = cloudWorkout.duration ? Math.round(cloudWorkout.duration / 60) : null;
        exerciseDetails = cloudWorkout.exercises;
        totalSets = cloudWorkout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
        totalVolume = cloudWorkout.exercises.reduce((sum, ex) =>
            sum + ex.sets.reduce((setSum, s) => setSum + (s.weight * s.reps), 0)
            , 0);
    } else if (!isCloudWorkout && localWorkout) {
        // Local data
        workoutName = localWorkout.name;
        workoutDate = localWorkout.endTime || localWorkout.startTime;
        duration = localWorkout.endTime && localWorkout.startTime
            ? Math.round((localWorkout.endTime.getTime() - localWorkout.startTime.getTime()) / 60000)
            : null;

        // Build exercise details from sets
        if (localSets && exercises) {
            const grouped: Record<string, ExerciseDetail> = {};
            for (const set of localSets) {
                const name = exercises.find(e => String(e.id) === set.exerciseId)?.name || 'Unknown';
                if (!grouped[set.exerciseId]) {
                    grouped[set.exerciseId] = { name, sets: [] };
                }
                grouped[set.exerciseId].sets.push({
                    setNumber: set.setNumber,
                    weight: set.weight,
                    reps: set.reps,
                    completed: set.completed,
                });
            }
            exerciseDetails = Object.values(grouped);
            totalSets = localSets.length;
            totalVolume = localSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);
        }
    }

    // Loading state for cloud
    if (isCloudWorkout && cloudLoading) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate('/history')} className="text-zinc-400 flex items-center gap-2">
                    <ArrowLeft size={20} /> Back
                </button>
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
            </div>
        );
    }

    // Error state
    if ((isCloudWorkout && cloudError) || (!isCloudWorkout && !localWorkout)) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate('/history')} className="text-zinc-400 flex items-center gap-2">
                    <ArrowLeft size={20} /> Back
                </button>
                <p className="text-zinc-500">{cloudError || 'Workout not found'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div>
                <button onClick={() => navigate('/history')} className="text-zinc-400 flex items-center gap-1 text-sm mb-2">
                    <ArrowLeft size={16} /> History
                </button>
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{workoutName}</h1>
                    {isCloudWorkout && <Cloud size={18} className="text-blue-400" />}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                    <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{format(workoutDate, 'MMM d, yyyy')}</span>
                    </div>
                    {duration && (
                        <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>{duration} min</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Exercises</p>
                    <p className="text-2xl font-bold">{exerciseDetails.length}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Sets</p>
                    <p className="text-2xl font-bold">{totalSets}</p>
                </div>
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                    <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Volume</p>
                    <p className="text-xl font-bold">{totalVolume.toLocaleString()}</p>
                    <p className="text-xs text-zinc-600">lbs</p>
                </div>
            </div>

            {/* Exercises */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Dumbbell size={18} />
                    Exercises
                </h2>

                {exerciseDetails.length === 0 ? (
                    <p className="text-zinc-500 text-center py-4">No exercises recorded</p>
                ) : (
                    exerciseDetails.map((exercise, exIdx) => (
                        <div key={exIdx} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                            <div className="p-4 border-b border-zinc-800">
                                <h3 className="font-bold text-blue-400">{exercise.name}</h3>
                            </div>
                            <div className="p-4">
                                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 mb-2 uppercase font-bold tracking-wider">
                                    <div>Set</div>
                                    <div>Weight</div>
                                    <div>Reps</div>
                                </div>
                                {exercise.sets
                                    .sort((a, b) => a.setNumber - b.setNumber)
                                    .map((set, setIdx) => (
                                        <div
                                            key={setIdx}
                                            className={`grid grid-cols-3 gap-2 text-sm py-2 border-b border-zinc-800/50 last:border-0 ${set.completed === false ? 'opacity-40' : ''}`}
                                        >
                                            <div className="text-zinc-400 flex items-center gap-1">
                                                {set.setNumber}
                                                {set.completed === false && <span className="text-red-400 text-xs">✕</span>}
                                            </div>
                                            <div className="font-bold">{set.weight} lbs</div>
                                            <div className="font-bold">{set.reps}</div>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
