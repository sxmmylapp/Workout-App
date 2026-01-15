import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ArrowLeft, Edit2, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Glutes', 'Forearms'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Bands', 'Other'];

export const ExerciseDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', muscleGroup: '', equipment: '' });

    const exercise = useLiveQuery(() => db.exercises.get(Number(id)), [id]);

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

    const openEditModal = () => {
        setEditForm({
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            equipment: exercise.equipment,
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editForm.name.trim()) return;

        await db.exercises.update(Number(id), {
            name: editForm.name.trim(),
            muscleGroup: editForm.muscleGroup,
            equipment: editForm.equipment,
        });

        setIsEditModalOpen(false);
    };

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <button onClick={() => navigate('/exercises')} className="text-zinc-400 flex items-center gap-1 text-sm mb-2">
                        <ArrowLeft size={16} /> Exercises
                    </button>
                    <h1 className="text-2xl font-bold">{exercise.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-zinc-500">{exercise.muscleGroup}</span>
                        <span className="text-zinc-700">•</span>
                        <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">{exercise.equipment}</span>
                    </div>
                </div>
                <button
                    onClick={openEditModal}
                    className="text-zinc-400 hover:text-white p-2"
                >
                    <Edit2 size={20} />
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="flex items-center gap-2 text-yellow-500 mb-1">
                        <Trophy size={16} />
                        <span className="text-xs uppercase font-bold">Personal Record</span>
                    </div>
                    <p className="text-2xl font-bold">
                        {stats.pr ? `${stats.pr} lbs` : '—'}
                    </p>
                </div>

                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="flex items-center gap-2 text-blue-500 mb-1">
                        <TrendingUp size={16} />
                        <span className="text-xs uppercase font-bold">Total Volume</span>
                    </div>
                    <p className="text-2xl font-bold">
                        {stats.totalVolume > 0 ? `${stats.totalVolume.toLocaleString()} lbs` : '—'}
                    </p>
                </div>

                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="flex items-center gap-2 text-green-500 mb-1">
                        <span className="text-xs uppercase font-bold">Total Sets</span>
                    </div>
                    <p className="text-2xl font-bold">{stats.totalSets}</p>
                </div>

                <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="flex items-center gap-2 text-purple-500 mb-1">
                        <Calendar size={16} />
                        <span className="text-xs uppercase font-bold">Last Used</span>
                    </div>
                    <p className="text-lg font-bold">
                        {stats.lastUsed ? format(new Date(stats.lastUsed), 'MMM d') : '—'}
                    </p>
                </div>
            </div>

            {/* History */}
            <div>
                <h2 className="text-lg font-bold mb-3">Recent History</h2>
                {history.length === 0 ? (
                    <p className="text-zinc-500 text-center py-4">No workout history yet</p>
                ) : (
                    <div className="space-y-3">
                        {history.map((entry, idx) => (
                            <div key={idx} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-medium">{entry.workoutName}</span>
                                    <span className="text-xs text-zinc-500">
                                        {format(new Date(entry.date), 'MMM d, yyyy')}
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 mb-1 uppercase font-bold">
                                    <div>Set</div>
                                    <div>Weight</div>
                                    <div>Reps</div>
                                </div>
                                {entry.sets
                                    .sort((a, b) => a.setNumber - b.setNumber)
                                    .map((set, setIdx) => (
                                        <div key={setIdx} className="grid grid-cols-3 gap-2 text-sm py-1">
                                            <div className="text-zinc-400">{set.setNumber}</div>
                                            <div>{set.weight} lbs</div>
                                            <div>{set.reps}</div>
                                        </div>
                                    ))
                                }
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/90 z-50 p-4 flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
                        <h2 className="text-xl font-bold mb-4">Edit Exercise</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Exercise Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:border-blue-500 outline-none"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Muscle Group</label>
                                <select
                                    value={editForm.muscleGroup}
                                    onChange={(e) => setEditForm({ ...editForm, muscleGroup: e.target.value })}
                                    className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:border-blue-500 outline-none"
                                >
                                    {MUSCLE_GROUPS.map(mg => (
                                        <option key={mg} value={mg}>{mg}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Equipment</label>
                                <select
                                    value={editForm.equipment}
                                    onChange={(e) => setEditForm({ ...editForm, equipment: e.target.value })}
                                    className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:border-blue-500 outline-none"
                                >
                                    {EQUIPMENT.map(eq => (
                                        <option key={eq} value={eq}>{eq}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1 py-3 rounded-lg bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={!editForm.name.trim()}
                                className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
