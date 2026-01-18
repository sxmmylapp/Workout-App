import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WorkoutSet, type Exercise } from '../db';
import { formatMuscleGroups } from '../utils/exerciseLists';
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
import { DebouncedNumberInput } from '../components/DebouncedNumberInput';
import { useRestTimer } from '../hooks/useRestTimer';
import { useElapsedTime } from '../hooks/useElapsedTime';

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
        ex.muscleGroups.some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase()))
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
                        <span className="text-xs text-zinc-500">{formatMuscleGroups(ex.muscleGroups)}</span>
                    </button>
                ))}

                {filteredExercises.length === 0 && (
                    <p className="text-zinc-500 text-center py-4">No exercises found</p>
                )}
            </div>
        </div>
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
    // Sort sets by set number
    const sortedSets = [...exSets].sort((a, b) => a.setNumber - b.setNumber);

    // Get the exerciseId from the first set for name lookup
    const exerciseId = exSets[0]?.exerciseId || exId;
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
                    <h3 className="font-bold text-blue-400">{getExerciseName(exerciseId)}</h3>
                </div>
                <button
                    onClick={() => {
                        if (confirm(`Remove ${getExerciseName(exerciseId)} from this workout ? `)) {
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

    const workout = useLiveQuery(() => db.workouts.get(Number(id)), [id]);
    const sets = useLiveQuery(() => db.sets.where('workoutId').equals(String(id)).toArray(), [id]);
    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Custom Hooks
    const {
        restTime,
        setRestTime,
        restTimerEnabled,
        restTimeRemaining,
        isTimerRunning,
        startRestTimer,
        stopRestTimer,
        formatTime: formatRestTime
    } = useRestTimer();

    const elapsedTime = useElapsedTime(workout?.startTime);

    // Initialize workout name and order
    useEffect(() => {
        if (workout) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setWorkoutName(workout.name || 'Workout');
        }
    }, [workout]);

    // Update exercise order when sets change (if new exercises added)
    useEffect(() => {
        if (sets) {
            const uniqueExercises = Array.from(new Set(sets.map(s => s.instanceId || s.exerciseId)));
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setExerciseOrder(prev => {
                // If order is empty, just use the set order
                if (prev.length === 0) return uniqueExercises;

                // Add any new exercises to the end
                const newExercises = uniqueExercises.filter(id => !prev.includes(id));
                // Remove any exercises that no longer have sets
                const existingExercises = prev.filter(id => uniqueExercises.includes(id));

                if (newExercises.length === 0 && existingExercises.length === prev.length) return prev;

                const newOrder = [...existingExercises, ...newExercises];
                // Only update DB if order actually changed
                if (JSON.stringify(newOrder) !== JSON.stringify(prev)) {
                    // Debounce DB update? Or just do it.
                    // Ideally we should update DB here but let's avoid infinite loops
                    // We'll update DB only on explicit reorder
                }
                return newOrder;
            });
        }
    }, [sets]);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setExerciseOrder((items) => {
                const oldIndex = items.indexOf(String(active.id));
                const newIndex = items.indexOf(String(over.id));
                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Persist order to DB

                return newOrder;
            });
        }
    };

    const updateSet = async (setId: number, updates: Partial<WorkoutSet>) => {
        await db.sets.update(setId, updates);

        // If completing a set, start rest timer
        if (updates.completed === true && restTimerEnabled) {
            startRestTimer();
        }
    };

    const handleAddSet = async (exerciseId: string, currentSets: WorkoutSet[]) => {
        const lastSet = currentSets[currentSets.length - 1];
        await db.sets.add({
            workoutId: String(id),
            exerciseId: currentSets[0]?.exerciseId || exerciseId, // Use existing exerciseId from set or the passed one
            instanceId: exerciseId, // This is the grouping ID
            setNumber: currentSets.length + 1,
            weight: lastSet ? lastSet.weight : 0,
            reps: lastSet ? lastSet.reps : 10,
            completed: false,
            timestamp: new Date()
        });
    };

    const handleDeleteSet = async (setId: number) => {
        await db.sets.delete(setId);
    };

    const handleDeleteExercise = async (instanceId: string) => {
        // Delete all sets for this exercise instance
        const setsToDelete = sets?.filter(s => (s.instanceId || s.exerciseId) === instanceId);
        if (setsToDelete) {
            await db.sets.bulkDelete(setsToDelete.map(s => Number(s.id)));
        }
        // Remove from order
        const newOrder = exerciseOrder.filter(id => id !== instanceId);
        setExerciseOrder(newOrder);
    };

    const handleAddExercise = async (exerciseId: string) => {
        // Create a new unique instance ID for this exercise in this workout
        const instanceId = `${exerciseId} -${crypto.randomUUID()} `;

        await db.sets.add({
            workoutId: String(id),
            exerciseId,
            instanceId,
            setNumber: 1,
            weight: 0,
            reps: 10,
            completed: false,
            timestamp: new Date()
        });

        setIsAddExerciseOpen(false);
        // Order update will happen in useEffect
    };

    const handleFinishWorkout = async () => {
        if (!workout) return;

        const endTime = new Date();

        await db.workouts.update(Number(id), {
            endTime,
            status: 'completed'
        });

        // Trigger sync
        syncToSupabase(Number(id));

        navigate('/history');
    };

    const getExerciseName = (exId: string) => {
        return exercises?.find(e => String(e.id) === exId)?.name || 'Unknown Exercise';
    };

    if (!workout) return <div>Loading...</div>;

    // Group sets by instanceId (or exerciseId for backward compatibility)
    const setsByExercise: { [key: string]: WorkoutSet[] } = {};
    sets?.forEach(set => {
        const key = set.instanceId || set.exerciseId;
        if (!setsByExercise[key]) {
            setsByExercise[key] = [];
        }
        setsByExercise[key].push(set);
    });

    // Use exerciseOrder to determine display order
    // Filter out any IDs that don't have sets anymore
    const orderedExerciseIds = exerciseOrder.filter(id => setsByExercise[id]);

    // Add any exercises that have sets but aren't in the order array (legacy/fallback)
    Object.keys(setsByExercise).forEach(key => {
        if (!orderedExerciseIds.includes(key)) {
            orderedExerciseIds.push(key);
        }
    });

    return (
        <div className="min-h-screen pb-24 relative">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-zinc-800 p-4 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold">{workoutName}</h1>
                    <div className="flex items-center gap-2 text-zinc-400 text-sm">
                        <Clock size={14} />
                        <span className="font-mono">{elapsedTime}</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsFinishModalOpen(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm"
                >
                    Finish
                </button>
            </div>

            {/* Exercise List */}
            <div className="p-4 space-y-4">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={orderedExerciseIds}
                        strategy={verticalListSortingStrategy}
                    >
                        {orderedExerciseIds.map(exId => (
                            <SortableExerciseCard
                                key={exId}
                                exId={exId}
                                exSets={setsByExercise[exId]}
                                getExerciseName={getExerciseName}
                                handleDeleteExercise={handleDeleteExercise}
                                handleAddSet={handleAddSet}
                                handleDeleteSet={handleDeleteSet}
                                updateSet={updateSet}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                <button
                    onClick={() => setIsAddExerciseOpen(true)}
                    className="w-full py-4 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl text-zinc-400 hover:text-white hover:border-zinc-500 flex flex-col items-center gap-2 transition-colors"
                >
                    <Plus size={24} />
                    <span className="font-bold">Add Exercise</span>
                </button>
            </div>

            {/* Rest Timer Overlay */}
            {isTimerRunning && restTimeRemaining !== null && (
                <div className="fixed bottom-24 right-4 bg-zinc-900 border border-zinc-700 rounded-full shadow-lg shadow-black/50 p-1 pr-4 flex items-center gap-3 z-40 animate-in slide-in-from-bottom-4">
                    <div className="bg-zinc-800 rounded-full p-2 relative">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-zinc-700"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="text-blue-500 transition-all duration-1000 ease-linear"
                                strokeDasharray={`${(restTimeRemaining / restTime) * 100}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Timer size={16} className="text-blue-400" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs text-zinc-500 font-bold uppercase">Resting</span>
                        <span className="font-mono font-bold text-lg leading-none">{formatRestTime(restTimeRemaining)}</span>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setRestTime(t => Math.max(10, t - 10))}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400"
                        >
                            <Minus size={16} />
                        </button>
                        <button
                            onClick={() => setRestTime(t => t + 10)}
                            className="p-1 hover:bg-zinc-800 rounded text-zinc-400"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={stopRestTimer}
                            className="p-1 hover:bg-red-900/30 rounded text-red-400 ml-1"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Add Exercise Modal */}
            {isAddExerciseOpen && exercises && (
                <AddExerciseModal
                    exercises={exercises}
                    onAdd={handleAddExercise}
                    onClose={() => setIsAddExerciseOpen(false)}
                />
            )}

            {/* Finish Workout Modal */}
            {isFinishModalOpen && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-800">
                        <h2 className="text-2xl font-bold mb-2">Finish Workout?</h2>
                        <p className="text-zinc-400 mb-6">
                            Great job! Are you ready to complete this workout and save it to your history?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsFinishModalOpen(false)}
                                className="flex-1 py-3 bg-zinc-800 font-bold rounded-xl hover:bg-zinc-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleFinishWorkout}
                                className="flex-1 py-3 bg-green-600 font-bold rounded-xl hover:bg-green-700 text-white"
                            >
                                Finish
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
