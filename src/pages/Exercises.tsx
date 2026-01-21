import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Search, X, Trash2, CheckSquare, Dumbbell } from 'lucide-react';
import { normalizeMuscleGroups, fixCorruptedData, deduplicateExercises } from '../utils/exerciseLists';
import { ExerciseModal } from '../components/ExerciseModal';
import { ExerciseCard } from '../components/ExerciseCard';

export const Exercises: React.FC = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Run one-time data fix and deduplication on mount
    useEffect(() => {
        const runMigrations = async () => {
            await fixCorruptedData(db);
            await deduplicateExercises(db);
        };
        runMigrations().catch(console.error);
    }, []);

    // Filter exercises based on search
    const filteredExercises = exercises?.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        normalizeMuscleGroups(ex.muscleGroups).some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ex.equipment.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const handleAddExercise = async (data: { name: string; muscleGroups: string[]; equipment: string }) => {
        // Check for duplicate exercise name (case-insensitive)
        const trimmedName = data.name.trim().toLowerCase();
        const existingExercise = exercises?.find(
            ex => ex.name.toLowerCase() === trimmedName
        );

        if (existingExercise) {
            // TODO: Replace with better UI notification
            alert(`Exercise "${existingExercise.name}" already exists.`);
            return;
        }

        await db.exercises.add({
            name: data.name,
            muscleGroups: data.muscleGroups,
            equipment: data.equipment,
        });

        setIsAddModalOpen(false);
    };

    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        // TODO: Replace with custom modal
        if (!confirm(`Delete ${selectedIds.size} exercise${selectedIds.size > 1 ? 's' : ''}?`)) return;

        for (const id of selectedIds) {
            const exercise = exercises?.find(e => e.id === id);
            if (exercise) {
                // Track deletion for sync
                await db.deletedItems.add({
                    type: 'exercise',
                    localId: exercise.id!,
                    name: exercise.name,
                    deletedAt: new Date()
                });
            }
            await db.exercises.delete(id);
        }

        setSelectedIds(new Set());
        setIsSelectMode(false);
    };

    const exitSelectMode = () => {
        setIsSelectMode(false);
        setSelectedIds(new Set());
    };

    const selectAll = () => {
        const allIds = new Set(filteredExercises.map(ex => ex.id!));
        setSelectedIds(allIds);
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex justify-between items-center pt-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    Exercises
                </h1>
                <div className="flex items-center gap-2">
                    {isSelectMode ? (
                        <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-full border border-zinc-800 animate-in slide-in-from-right-4 fade-in duration-200">
                            <button
                                onClick={selectAll}
                                className="text-xs font-medium text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-zinc-800 transition-colors"
                            >
                                All
                            </button>
                            <div className="w-px h-4 bg-zinc-800"></div>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.size === 0}
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 rounded-full transition-colors disabled:opacity-50"
                            >
                                <Trash2 size={18} />
                            </button>
                            <button
                                onClick={exitSelectMode}
                                className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-2 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsSelectMode(true)}
                            className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800/50 transition-colors"
                        >
                            <CheckSquare size={22} />
                        </button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl group-hover:bg-blue-500/10 transition-all duration-500"></div>
                <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search exercises..."
                        className="w-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl py-4 pl-11 pr-10 text-sm focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all shadow-lg shadow-black/20"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Exercise List */}
            <div className="space-y-3">
                {filteredExercises.length > 0 && (
                    <p className="text-xs font-medium text-zinc-500 px-1">
                        {isSelectMode && selectedIds.size > 0
                            ? `${selectedIds.size} selected`
                            : `${filteredExercises.length} exercises`
                        }
                    </p>
                )}

                <div className="grid gap-3">
                    {filteredExercises.map((ex) => (
                        <ExerciseCard
                            key={ex.id}
                            exercise={ex}
                            isSelectMode={isSelectMode}
                            isSelected={selectedIds.has(ex.id!)}
                            onToggleSelect={toggleSelect}
                            onClick={() => navigate(`/exercises/${ex.id}`)}
                        />
                    ))}

                    {filteredExercises.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-zinc-900/50 p-4 rounded-full mb-4">
                                <Dumbbell size={32} className="text-zinc-600" />
                            </div>
                            <p className="text-zinc-400 font-medium mb-1">No exercises found</p>
                            <p className="text-sm text-zinc-600 mb-6">Try searching for something else</p>
                            {searchQuery && (
                                <button
                                    onClick={() => setIsAddModalOpen(true)}
                                    className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors"
                                >
                                    + Create "{searchQuery}"
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Action Button */}
            {!isSelectMode && (
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-900/40 flex items-center justify-center hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all duration-200 z-40"
                >
                    <Plus size={28} />
                </button>
            )}

            <ExerciseModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddExercise}
                title="New Exercise"
                saveLabel="Create Exercise"
                initialData={searchQuery ? { name: searchQuery, muscleGroups: [], equipment: 'Barbell' } : undefined}
            />
        </div>
    );
};
