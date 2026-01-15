import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutSet, type Exercise } from '../db';
import { syncToSupabase } from '../utils/sync';
import { Plus, Check, Clock, Trash2, X, GripVertical, Search, Timer, Minus } from 'lucide-react';
import clsx from 'clsx';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Add Exercise Modal with Search
interface AddExerciseModalProps {
    exercises: Exercise[];
    onAdd: (exerciseId: string) => void;
    onClose: () => void;
}

const AddExerciseModal: React.FC<AddExerciseModalProps> = ({ exercises, onAdd, onClose }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredExercises = exercises.filter(ex =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.muscleGroup.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/90 z-50 p-4 animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Add Exercise</h2>
                <button
                    onClick={onClose}
                    className="text-zinc-400 hover:text-white"
                >
                    Close
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search exercises..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-10 text-sm focus:border-blue-500 outline-none"
                    autoFocus
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

            <div className="space-y-2 overflow-y-auto max-h-[70vh]">
                {filteredExercises.map(ex => (
                    <button
                        key={ex.id}
                        onClick={() => onAdd(String(ex.id))}
                        className="w-full p-4 bg-zinc-900 rounded-xl text-left hover:bg-zinc-800 transition-colors flex justify-between items-center"
                    >
                        <span className="font-bold">{ex.name}</span>
                        <span className="text-xs text-zinc-500">{ex.muscleGroup}</span>
                    </button>
                ))}

                {filteredExercises.length === 0 && (
                    <p className="text-zinc-500 text-center py-4">No exercises found</p>
                )}
            </div>
        </div>
    );
};

// Debounced Number Input - saves on blur to prevent excessive DB writes
interface DebouncedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

const DebouncedNumberInput: React.FC<DebouncedNumberInputProps> = ({ value, onChange, className }) => {
    const [localValue, setLocalValue] = useState(String(value));

    // Sync local value when external value changes (e.g., from DB)
    useEffect(() => {
        setLocalValue(String(value));
    }, [value]);

    const handleBlur = () => {
        const numValue = Number(localValue) || 0;
        if (numValue !== value) {
            onChange(numValue);
        }
    };

    return (
        <input
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            className={className}
        />
    );
};

interface SortableExerciseCardProps {
    exId: string;
    exSets: WorkoutSet[];
    getExerciseName: (exId: string) => string;
    handleDeleteExercise: (exId: string) => void;
    handleAddSet: (exId: string, currentSets: WorkoutSet[]) => void;
    handleDeleteSet: (setId: number) => void;
    updateSet: (setId: number, updates: Partial<WorkoutSet>) => void;
}

const SortableExerciseCard: React.FC<SortableExerciseCardProps> = ({
    exId,
    exSets,
    getExerciseName,
    handleDeleteExercise,
    handleAddSet,
    handleDeleteSet,
    updateSet,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: exId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Memoize sorted sets to avoid re-sorting on every render
    const sortedSets = useMemo(() =>
        [...exSets].sort((a, b) => a.setNumber - b.setNumber)
        , [exSets]);
    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800"
        >
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <button
                        {...attributes}
                        {...listeners}
                        className="text-zinc-500 hover:text-zinc-300 cursor-grab active:cursor-grabbing touch-none"
                    >
                        <GripVertical size={18} />
                    </button>
                    <h3 className="font-bold text-blue-400">{getExerciseName(exId)}</h3>
                </div>
                <button
                    onClick={() => {
                        if (confirm(`Remove ${getExerciseName(exId)} from this workout?`)) {
                            handleDeleteExercise(exId);
                        }
                    }}
                    className="text-red-500 hover:text-red-400 p-1"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="p-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-zinc-500 mb-2 px-2 uppercase font-bold tracking-wider text-center">
                    <div className="col-span-1">Set</div>
                    <div className="col-span-3">lbs</div>
                    <div className="col-span-3">Reps</div>
                    <div className="col-span-3">Done</div>
                    <div className="col-span-2"></div>
                </div>

                {sortedSets.map((set, idx) => (
                    <div
                        key={set.id}
                        className={clsx(
                            "grid grid-cols-12 gap-2 items-center mb-2 p-2 rounded",
                            set.completed ? "bg-green-900/20" : "bg-transparent"
                        )}
                    >
                        <div className="col-span-1 text-center font-mono text-zinc-400">{idx + 1}</div>
                        <div className="col-span-3">
                            <DebouncedNumberInput
                                value={set.weight}
                                onChange={(value) => updateSet(Number(set.id), { weight: value })}
                                className="w-full bg-zinc-800 rounded p-2 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="col-span-3">
                            <DebouncedNumberInput
                                value={set.reps}
                                onChange={(value) => updateSet(Number(set.id), { reps: value })}
                                className="w-full bg-zinc-800 rounded p-2 text-center font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="col-span-3 flex justify-center">
                            <button
                                onClick={() => updateSet(Number(set.id), { completed: !set.completed })}
                                className={clsx(
                                    "w-full h-9 rounded flex items-center justify-center transition-all",
                                    set.completed ? "bg-green-500 text-black" : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                                )}
                            >
                                <Check size={18} />
                            </button>
                        </div>
                        <div className="col-span-2 flex justify-center">
                            <button
                                onClick={() => handleDeleteSet(Number(set.id))}
                                className="text-zinc-600 hover:text-red-500 p-1 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                <button
                    onClick={() => handleAddSet(exId, exSets)}
                    className="w-full py-3 mt-2 text-blue-400 text-sm font-bold uppercase tracking-wide hover:bg-blue-900/20 rounded transition-colors flex items-center justify-center gap-2"
                >
                    <Plus size={16} /> Add Set
                </button>
            </div>
        </div>
    );
};

export const ActiveWorkout: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isAddExerciseOpen, setIsAddExerciseOpen] = useState(false);
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    const [workoutName, setWorkoutName] = useState('');
    const [exerciseOrder, setExerciseOrder] = useState<string[]>([]);

    // Rest Timer State
    const [restTime, setRestTime] = useState(90);
    const [restTimerEnabled, setRestTimerEnabled] = useState(true);
    const [restTimeRemaining, setRestTimeRemaining] = useState<number | null>(null);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // Load rest timer settings from localStorage on mount
    useEffect(() => {
        const savedTime = localStorage.getItem('restTimerDefault');
        const savedEnabled = localStorage.getItem('restTimerEnabled');
        if (savedTime !== null) setRestTime(Number(savedTime));
        if (savedEnabled !== null) setRestTimerEnabled(savedEnabled !== 'false');
    }, []);

    const workout = useLiveQuery(() => db.workouts.get(Number(id)), [id]);
    const sets = useLiveQuery(() => db.sets.where('workoutId').equals(String(id)).toArray(), [id]);
    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Elapsed time state
    const [elapsedTime, setElapsedTime] = useState('0:00');

    // Update elapsed time every second
    useEffect(() => {
        if (!workout) return;

        const updateElapsed = () => {
            const now = new Date();
            const diff = Math.floor((now.getTime() - workout.startTime.getTime()) / 1000);
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            if (hours > 0) {
                setElapsedTime(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setElapsedTime(`${minutes}:${String(seconds).padStart(2, '0')}`);
            }
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [workout]);

    // Group sets by exercise
    const workoutExercises = useMemo(() => {
        return sets?.reduce((acc, set) => {
            if (!acc[set.exerciseId]) {
                acc[set.exerciseId] = [];
            }
            acc[set.exerciseId].push(set);
            return acc;
        }, {} as Record<string, WorkoutSet[]>) || {};
    }, [sets]);

    // Get ordered exercise IDs
    const orderedExerciseIds = useMemo(() => {
        const currentExerciseIds = Object.keys(workoutExercises);

        // Start with exercises that are in both order and current
        const orderedAndPresent = exerciseOrder.filter(id => currentExerciseIds.includes(id));

        // Add any new exercises that aren't in the order yet
        const newExercises = currentExerciseIds.filter(id => !exerciseOrder.includes(id));

        return [...orderedAndPresent, ...newExercises];
    }, [workoutExercises, exerciseOrder]);

    // Memoized exercise name lookup map - O(1) instead of O(n)
    const exerciseNameMap = useMemo(() =>
        new Map(exercises?.map(e => [String(e.id), e.name]) || [])
        , [exercises]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Rest Timer Functions - Must be before early return (Rules of Hooks)
    const startRestTimer = useCallback(() => {
        // Use cached state values instead of reading localStorage
        if (!restTimerEnabled) return;

        setRestTimeRemaining(restTime);
        setIsTimerRunning(true);
    }, [restTime, restTimerEnabled]);

    const stopRestTimer = useCallback(() => {
        setIsTimerRunning(false);
        setRestTimeRemaining(null);
    }, []);

    // Timer countdown effect - Must be before early return
    useEffect(() => {
        if (!isTimerRunning || restTimeRemaining === null) return;

        if (restTimeRemaining <= 0) {
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
            stopRestTimer();
            return;
        }

        const interval = setInterval(() => {
            setRestTimeRemaining(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearInterval(interval);
    }, [isTimerRunning, restTimeRemaining, stopRestTimer]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = orderedExerciseIds.indexOf(active.id as string);
            const newIndex = orderedExerciseIds.indexOf(over.id as string);
            const newOrder = arrayMove(orderedExerciseIds, oldIndex, newIndex);
            setExerciseOrder(newOrder);
        }
    };

    if (!workout) {
        return (
            <div className="flex items-center justify-center h-48">
                <div className="text-zinc-500">Loading workout...</div>
            </div>
        );
    }

    const handleAddExercise = async (exerciseId: string) => {
        try {
            await db.sets.add({
                workoutId: String(id),
                exerciseId,
                setNumber: 1,
                weight: 0,
                reps: 0,
                completed: false,
                timestamp: new Date()
            });
            setIsAddExerciseOpen(false);
        } catch (error) {
            console.error('Failed to add exercise:', error);
        }
    };

    const handleAddSet = async (exerciseId: string, currentSets: WorkoutSet[]) => {
        try {
            const lastSet = currentSets[currentSets.length - 1];
            await db.sets.add({
                workoutId: String(id),
                exerciseId,
                setNumber: currentSets.length + 1,
                weight: lastSet ? lastSet.weight : 0,
                reps: lastSet ? lastSet.reps : 0,
                completed: false,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Failed to add set:', error);
        }
    };

    const handleDeleteSet = async (setId: number) => {
        try {
            await db.sets.delete(setId);
        } catch (error) {
            console.error('Failed to delete set:', error);
        }
    };

    const handleDeleteExercise = async (exerciseId: string) => {
        try {
            const setsToDelete = sets?.filter(s => s.exerciseId === exerciseId) || [];
            const idsToDelete = setsToDelete.map(s => s.id).filter((id): id is number => id !== undefined);
            if (idsToDelete.length > 0) {
                await db.sets.bulkDelete(idsToDelete);
            }
            // Remove from order
            setExerciseOrder(prev => prev.filter(id => id !== exerciseId));
        } catch (error) {
            console.error('Failed to delete exercise:', error);
        }
    };

    const handleDeleteWorkout = async () => {
        if (confirm('Delete this workout? All data will be lost.')) {
            try {
                if (sets) {
                    const idsToDelete = sets.map(s => s.id).filter((id): id is number => id !== undefined);
                    if (idsToDelete.length > 0) {
                        await db.sets.bulkDelete(idsToDelete);
                    }
                }
                await db.workouts.delete(Number(id));
                navigate('/');
            } catch (error) {
                console.error('Failed to delete workout:', error);
            }
        }
    };

    const adjustRestTime = (delta: number) => {
        const newTime = Math.max(15, Math.min(300, restTime + delta));
        setRestTime(newTime);
        if (restTimeRemaining !== null) {
            setRestTimeRemaining(Math.max(0, restTimeRemaining + delta));
        }
    };

    const updateSet = (setId: number, updates: Partial<WorkoutSet>) => {
        db.sets.update(setId, updates);
        // Start rest timer when set is marked as completed
        if (updates.completed === true) {
            startRestTimer();
        }
    };

    const openFinishModal = () => {
        const exerciseNames = orderedExerciseIds.map(exId =>
            exercises?.find(e => String(e.id) === exId)?.name
        ).filter(Boolean);

        const defaultName = exerciseNames.length > 0
            ? exerciseNames.slice(0, 2).join(' & ') + (exerciseNames.length > 2 ? ' +' : '')
            : 'Workout';

        setWorkoutName(defaultName);
        setIsFinishModalOpen(true);
    };

    const finishWorkout = async () => {
        const finalName = workoutName.trim() || 'Workout';

        try {
            await db.workouts.update(Number(id), {
                name: finalName,
                status: 'completed',
                endTime: new Date()
            });

            // Try to sync, but don't block navigation on failure
            syncToSupabase(Number(id)).catch(error => {
                console.error('Failed to sync workout to Supabase:', error);
            });

            navigate('/history');
        } catch (error) {
            console.error('Failed to finish workout:', error);
        }
    };

    const getExerciseName = (exId: string) => exerciseNameMap.get(exId) || 'Unknown Exercise';

    return (
        <div className="pb-24 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center sticky top-0 bg-black/80 backdrop-blur-md py-4 z-10">
                <div>
                    <h1 className="text-xl font-bold">{workout.name}</h1>
                    <div className="flex items-center text-xs text-zinc-400 gap-2">
                        <Clock size={12} />
                        <span className="font-mono text-sm text-white">{elapsedTime}</span>
                        <span>•</span>
                        <span>{sets?.length || 0} sets</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDeleteWorkout}
                        className="text-red-500 hover:text-red-400 p-2"
                    >
                        <Trash2 size={20} />
                    </button>
                    <button
                        onClick={openFinishModal}
                        className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-blue-700"
                    >
                        Finish
                    </button>
                </div>
            </div>

            {/* Workout Exercises - Sortable */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext items={orderedExerciseIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-4">
                        {orderedExerciseIds.map((exId) => (
                            <SortableExerciseCard
                                key={exId}
                                exId={exId}
                                exSets={workoutExercises[exId] || []}
                                getExerciseName={getExerciseName}
                                handleDeleteExercise={handleDeleteExercise}
                                handleAddSet={handleAddSet}
                                handleDeleteSet={handleDeleteSet}
                                updateSet={updateSet}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Add Exercise Button */}
            <button
                onClick={() => setIsAddExerciseOpen(true)}
                className="w-full py-4 border-2 border-dashed border-zinc-800 text-zinc-500 rounded-xl font-bold hover:border-zinc-700 hover:text-zinc-400 transition-all"
            >
                Add Exercise
            </button>

            {/* Add Exercise Modal */}
            {isAddExerciseOpen && (
                <AddExerciseModal
                    exercises={exercises || []}
                    onAdd={handleAddExercise}
                    onClose={() => setIsAddExerciseOpen(false)}
                />
            )}

            {/* Finish Workout Modal */}
            {isFinishModalOpen && (
                <div className="fixed inset-0 bg-black/90 z-50 p-4 flex items-center justify-center animate-in fade-in duration-200">
                    <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800">
                        <h2 className="text-xl font-bold mb-4">Name Your Workout</h2>
                        <input
                            type="text"
                            value={workoutName}
                            onChange={(e) => setWorkoutName(e.target.value)}
                            placeholder="e.g., Push Day, Leg Day"
                            className="w-full bg-zinc-800 p-3 rounded-lg text-lg border border-zinc-700 focus:border-blue-500 outline-none mb-4"
                            autoFocus
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsFinishModalOpen(false)}
                                className="flex-1 py-3 rounded-lg bg-zinc-800 text-zinc-400 font-bold hover:bg-zinc-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={finishWorkout}
                                className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rest Timer Overlay */}
            {isTimerRunning && restTimeRemaining !== null && (
                <div className="fixed inset-x-0 bottom-20 z-40 px-4 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 shadow-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Timer size={18} />
                                <span className="text-sm font-bold uppercase">Rest Timer</span>
                            </div>
                            <button
                                onClick={stopRestTimer}
                                className="text-zinc-500 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-4 mb-3">
                            <button
                                onClick={() => adjustRestTime(-15)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white w-10 h-10 rounded-full flex items-center justify-center"
                            >
                                <Minus size={18} />
                            </button>

                            <div className="text-center">
                                <div className={clsx(
                                    "text-5xl font-mono font-bold",
                                    restTimeRemaining <= 10 ? "text-red-500" : "text-white"
                                )}>
                                    {Math.floor(restTimeRemaining / 60)}:{String(restTimeRemaining % 60).padStart(2, '0')}
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">Default: {restTime}s</p>
                            </div>

                            <button
                                onClick={() => adjustRestTime(15)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white w-10 h-10 rounded-full flex items-center justify-center"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        <button
                            onClick={stopRestTimer}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                        >
                            Skip Rest
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
