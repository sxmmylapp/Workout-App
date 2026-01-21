import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ArrowLeft, Edit2, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { formatMuscleGroups, normalizeMuscleGroups } from '../utils/exerciseLists';
import { ExerciseModal } from '../components/ExerciseModal';

export const ExerciseDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const exercise = useLiveQuery(() => db.exercises.get(Number(id)), [id]);
    const exercises = useLiveQuery(() => db.exercises.toArray()); // For duplicate check

    // Get all sets for this exercise
    const sets = useLiveQuery(async () => {
        if (!id) return [];
        const allSets = await db.sets.where('exerciseId').equals(id).toArray();
        return allSets;
    }, [id]);

    // Get workout info for the sets
    const workouts = useLiveQuery(() => db.workouts.toArray());

    if (!exercise) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate('/exercises')} className="text-zinc-400 flex items-center gap-2">
                    <ArrowLeft size={20} /> Back
                </button>
                <p className="text-zinc-500">Exercise not found</p>
            </div>
        );
    }

    // Calculate stats
    const calculateStats = () => {
        if (!sets || sets.length === 0) {
            return { pr: null, totalVolume: 0, totalSets: 0, lastUsed: null };
        }

        // PR = heaviest weight lifted for at least 1 rep
        const pr = Math.max(...sets.map(s => s.weight));

        // Total volume = sum of (weight × reps)
        const totalVolume = sets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

        // Total sets
        const totalSets = sets.length;

        // Last used
        const sortedByTime = [...sets].sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const lastUsed = sortedByTime[0]?.timestamp || null;

        return { pr, totalVolume, totalSets, lastUsed };
    };

    const stats = calculateStats();

    // Group sets by workout for history
    const getHistory = () => {
        if (!sets || !workouts) return [];

        const grouped: Record<string, { workoutName: string; date: Date; sets: typeof sets }> = {};

        for (const set of sets) {
            const workout = workouts.find(w => String(w.id) === set.workoutId);
            if (!workout) continue;

            if (!grouped[set.workoutId]) {
                grouped[set.workoutId] = {
                    workoutName: workout.name,
                    date: workout.endTime || workout.startTime,
                    sets: []
                };
            }
            grouped[set.workoutId].sets.push(set);
        }

        return Object.values(grouped)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10); // Last 10 workouts
    };

    const history = getHistory();

    const handleSaveEdit = async (data: { name: string; muscleGroups: string[]; equipment: string }) => {
        // Check for duplicate exercise name (case-insensitive), excluding current exercise
        const trimmedName = data.name.trim().toLowerCase();
        const existingExercise = exercises?.find(
            ex => ex.name.toLowerCase() === trimmedName && ex.id !== Number(id)
        );

        if (existingExercise) {
            alert(`Exercise "${existingExercise.name}" already exists.`);
            return;
        }

        await db.exercises.update(Number(id), {
            name: data.name,
            muscleGroups: data.muscleGroups,
            equipment: data.equipment,
        });

        setIsEditModalOpen(false);
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <button onClick={() => navigate('/exercises')} className="text-zinc-400 hover:text-white flex items-center gap-1 text-sm mb-4 transition-colors">
                        <ArrowLeft size={16} /> Exercises
                    </button>
                    <h1 className="text-3xl font-bold text-white mb-2">{exercise.name}</h1>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-zinc-400 font-medium">{formatMuscleGroups(exercise.muscleGroups)}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                        <span className="text-xs bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-1 rounded-md text-zinc-300 uppercase tracking-wider font-bold">
                            {exercise.equipment}
                        </span>
                    </div>
                </div>
                <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2.5 rounded-xl border border-zinc-800 transition-all"
                >
                    <Edit2 size={20} />
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
                    <div className="flex items-center gap-2 text-yellow-500 mb-2">
                        <Trophy size={18} />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Personal Record</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        {stats.pr ? `${stats.pr} lbs` : '—'}
                    </p>
                </div>

                <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
                    <div className="flex items-center gap-2 text-blue-500 mb-2">
                        <TrendingUp size={18} />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Total Volume</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                        {stats.totalVolume > 0 ? `${(stats.totalVolume / 1000).toFixed(1)}k lbs` : '—'}
                    </p>
                </div>

                <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
                    <div className="flex items-center gap-2 text-green-500 mb-2">
                        <div className="w-4 h-4 rounded border-2 border-green-500 flex items-center justify-center">
                            <div className="w-2 h-2 bg-green-500 rounded-[1px]"></div>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Total Sets</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalSets}</p>
                </div>

                <div className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
                    <div className="flex items-center gap-2 text-purple-500 mb-2">
                        <Calendar size={18} />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Last Used</span>
                    </div>
                    <p className="text-xl font-bold text-white">
                        {stats.lastUsed ? format(new Date(stats.lastUsed), 'MMM d') : '—'}
                    </p>
                </div>
            </div>

            {/* History */}
            <div>
                <h2 className="text-lg font-bold mb-4 text-white">Recent History</h2>
                {history.length === 0 ? (
                    <div className="text-center py-12 bg-zinc-900/30 rounded-2xl border border-zinc-800/30 border-dashed">
                        <p className="text-zinc-500">No workout history yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((entry, idx) => (
                            <div key={idx} className="bg-zinc-900/50 rounded-2xl p-5 border border-zinc-800/50">
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-800/50">
                                    <span className="font-semibold text-white">{entry.workoutName}</span>
                                    <span className="text-xs font-medium text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md">
                                        {format(new Date(entry.date), 'MMM d, yyyy')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-[10px] uppercase tracking-wider font-bold text-zinc-600 mb-2 px-1">
                                    <div>Set</div>
                                    <div>Weight</div>
                                    <div>Reps</div>
                                </div>
                                <div className="space-y-1">
                                    {entry.sets
                                        .sort((a, b) => a.setNumber - b.setNumber)
                                        .map((set, setIdx) => (
                                            <div key={setIdx} className="grid grid-cols-3 gap-4 text-sm py-2 px-1 hover:bg-zinc-800/50 rounded-lg transition-colors">
                                                <div className="text-zinc-400 font-medium flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-xs">
                                                        {set.setNumber}
                                                    </span>
                                                </div>
                                                <div className="font-medium text-zinc-200">{set.weight} <span className="text-zinc-600 text-xs font-normal">lbs</span></div>
                                                <div className="font-medium text-zinc-200">{set.reps}</div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <ExerciseModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveEdit}
                title="Edit Exercise"
                saveLabel="Save Changes"
                initialData={{
                    name: exercise.name,
                    muscleGroups: normalizeMuscleGroups(exercise.muscleGroups),
                    equipment: exercise.equipment
                }}
            />
        </div>
    );
};
