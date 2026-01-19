import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Plus, Search, X, Trash2, CheckSquare, Square, ChevronRight } from 'lucide-react';
import { getMuscleGroups, getEquipment, normalizeMuscleGroups, formatMuscleGroups } from '../utils/exerciseLists';

export const Exercises: React.FC = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newExercise, setNewExercise] = useState({ name: '', muscleGroups: [] as string[], equipment: 'Barbell' });
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Get dynamic lists on each render
    const MUSCLE_GROUPS = getMuscleGroups();
    const EQUIPMENT = getEquipment();

    // Filter exercises based on search (using normalizeMuscleGroups for safe iteration)
    const filteredExercises = exercises?.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        normalizeMuscleGroups(ex.muscleGroups).some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ex.equipment.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const toggleMuscleGroup = (mg: string) => {
        const current = newExercise.muscleGroups;
        if (current.includes(mg)) {
            setNewExercise({ ...newExercise, muscleGroups: current.filter(m => m !== mg) });
        } else {
            setNewExercise({ ...newExercise, muscleGroups: [...current, mg] });
        }
    };

    const handleAddExercise = async () => {
        if (!newExercise.name.trim()) return;

        // Check for duplicate exercise name (case-insensitive)
        const trimmedName = newExercise.name.trim().toLowerCase();
        const existingExercise = exercises?.find(
            ex => ex.name.toLowerCase() === trimmedName
        );

        if (existingExercise) {
            alert(`Exercise "${existingExercise.name}" already exists.`);
            return;
        }

        await db.exercises.add({
            name: newExercise.name.trim(),
            muscleGroups: newExercise.muscleGroups.length > 0 ? newExercise.muscleGroups : ['Chest'],
            equipment: newExercise.equipment,
        });

        setNewExercise({ name: '', muscleGroups: [], equipment: 'Barbell' });
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
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Exercises</h1>
                <div className="flex items-center gap-2">
                    {isSelectMode ? (
                        <>
                            <button
                                onClick={selectAll}
                                className="text-zinc-400 hover:text-white text-sm px-2"
                            >
                                All
                            </button>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.size === 0}
                                className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 disabled:opacity-50"
                            >
                                <Trash2 size={20} />
                            </button>
                            <button
                                onClick={exitSelectMode}
                                className="text-zinc-400 hover:text-white p-2"
                            >
                                <X size={20} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setIsSelectMode(true)}
                                className="text-zinc-400 hover:text-white p-2"
                            >
                                <CheckSquare size={20} />
                            </button>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"
                            >
                                <Plus size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search exercises..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-10 text-sm focus:border-blue-500 outline-none"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Exercise Count / Selection Info */}
            <p className="text-xs text-zinc-500">
                {isSelectMode && selectedIds.size > 0
                    ? `${selectedIds.size} selected`
                    : `${filteredExercises.length} exercises`
                }
            </p>

            {/* Exercise List */}
            <div className="grid gap-2">
                {filteredExercises.map((ex) => (
                    <div
                        key={ex.id}
                        onClick={() => {
                            if (isSelectMode) {
                                toggleSelect(ex.id!);
                            } else {
                                navigate(`/exercises/${ex.id}`);
                            }
                        }}
                        className={`p-4 bg-zinc-900 rounded-xl border flex justify-between items-center transition-colors cursor-pointer hover:bg-zinc-800 ${selectedIds.has(ex.id!)
                            ? 'border-blue-500 bg-blue-900/20'
                            : 'border-zinc-800'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            {isSelectMode && (
                                <div className="text-blue-400">
                                    {selectedIds.has(ex.id!) ? (
                                        <CheckSquare size={20} />
                                    ) : (
                                        <Square size={20} />
                                    )}
                                </div>
                            )}
                            <div>
                                <h3 className="font-medium">{ex.name}</h3>
                                <p className="text-xs text-zinc-500">
                                    {formatMuscleGroups(ex.muscleGroups)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">{ex.equipment}</span>
                            {!isSelectMode && <ChevronRight size={16} className="text-zinc-600" />}
                        </div>
                    </div>
                ))}

                {filteredExercises.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-zinc-500">No exercises found</p>
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setNewExercise({ ...newExercise, name: searchQuery });
                                    setIsAddModalOpen(true);
                                }}
                                className="text-blue-400 text-sm mt-2"
                            >
                                + Add "{searchQuery}" as new exercise
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Add Exercise Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/90 z-50 p-4 flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
                        <h2 className="text-xl font-bold mb-4">Add Exercise</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Exercise Name</label>
                                <input
                                    type="text"
                                    value={newExercise.name}
                                    onChange={(e) => setNewExercise({ ...newExercise, name: e.target.value })}
                                    placeholder="e.g., Incline Dumbbell Press"
                                    className="w-full bg-zinc-800 p-3 rounded-lg border border-zinc-700 focus:border-blue-500 outline-none"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">Muscle Groups</label>
                                <div className="flex flex-wrap gap-2">
                                    {MUSCLE_GROUPS.map(mg => (
                                        <button
                                            key={mg}
                                            type="button"
                                            onClick={() => toggleMuscleGroup(mg)}
                                            className={`px-3 py-1 rounded-full text-sm transition-colors ${newExercise.muscleGroups.includes(mg)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                                }`}
                                        >
                                            {mg}
                                        </button>
                                    ))}
                                </div>
                                {newExercise.muscleGroups.length === 0 && (
                                    <p className="text-xs text-zinc-500 mt-1">Select at least one muscle group</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">Equipment</label>
                                <select
                                    value={newExercise.equipment}
                                    onChange={(e) => setNewExercise({ ...newExercise, equipment: e.target.value })}
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
                                onClick={() => {
                                    setNewExercise({ name: '', muscleGroups: [], equipment: 'Barbell' });
                                    setIsAddModalOpen(false);
                                }}
                                className="flex-1 py-3 rounded-lg bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddExercise}
                                disabled={!newExercise.name.trim()}
                                className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
