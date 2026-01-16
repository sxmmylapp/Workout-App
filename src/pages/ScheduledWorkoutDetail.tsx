import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TemplateExercise, type TemplateSet } from '../db';
import { format, isSameDay, startOfDay } from 'date-fns';
import { ArrowLeft, Play, Trash2, Plus, Minus, FileText, Calendar, GripVertical, Check, X } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableExerciseCardProps {
    exercise: TemplateExercise;
    exIdx: number;
    exerciseName: string;
    isEditing: boolean;
    updateSet: (exIdx: number, setIdx: number, field: 'targetWeight' | 'targetReps', value: number) => void;
    addSet: (exIdx: number) => void;
    removeSet: (exIdx: number, setIdx: number) => void;
    removeExercise: (exIdx: number) => void;
}

const SortableExerciseCard: React.FC<SortableExerciseCardProps> = ({
    exercise,
    exIdx,
    exerciseName,
    isEditing,
    updateSet,
    addSet,
    removeSet,
    removeExercise,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: exercise.instanceId || exercise.exerciseId, disabled: !isEditing });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 1 : 0,
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {isEditing && (
                        <button
                            {...attributes}
                            {...listeners}
                            className="text-zinc-600 hover:text-zinc-400 touch-none cursor-grab active:cursor-grabbing"
                        >
                            <GripVertical size={20} />
                        </button>
                    )}
                    <h3 className="font-bold text-blue-400">{exerciseName}</h3>
                </div>
                {isEditing && (
                    <button
                        onClick={() => removeExercise(exIdx)}
                        className="text-red-500/50 hover:text-red-500 p-1"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>

            <div className="p-4">
                {/* Column headers */}
                <div className={`grid ${isEditing ? 'grid-cols-[auto_1fr_1fr_auto]' : 'grid-cols-[auto_1fr_1fr]'} gap-4 text-xs text-zinc-500 mb-2 uppercase font-bold px-1`}>
                    <div className="w-8">Set</div>
                    <div className="text-center">Weight</div>
                    <div className="text-center">Reps</div>
                    {isEditing && <div className="w-6"></div>}
                </div>

                {/* Set rows */}
                <div className="space-y-3">
                    {exercise.sets.map((set: TemplateSet, setIdx: number) => (
                        <div key={setIdx} className={`grid ${isEditing ? 'grid-cols-[auto_1fr_1fr_auto]' : 'grid-cols-[auto_1fr_1fr]'} gap-4 items-center ${!isEditing ? 'py-3 border-b border-zinc-800/50 last:border-0' : ''}`}>
                            <div className="text-lg font-bold text-zinc-400 w-8">{setIdx + 1}</div>

                            {/* Weight */}
                            <div className={`flex items-center justify-center gap-2 ${isEditing ? 'bg-zinc-800/50 rounded-lg p-1' : ''}`}>
                                {isEditing && (
                                    <button
                                        onClick={() => updateSet(exIdx, setIdx, 'targetWeight', Math.max(0, set.targetWeight - 5))}
                                        className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                                    >
                                        <Minus size={14} />
                                    </button>
                                )}
                                <span className="text-lg font-bold min-w-[40px] text-center">{set.targetWeight}</span>
                                {isEditing && (
                                    <button
                                        onClick={() => updateSet(exIdx, setIdx, 'targetWeight', set.targetWeight + 5)}
                                        className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                                    >
                                        <Plus size={14} />
                                    </button>
                                )}
                                {!isEditing && <span className="text-xs text-zinc-500">lbs</span>}
                            </div>

                            {/* Reps */}
                            <div className={`flex items-center justify-center gap-2 ${isEditing ? 'bg-zinc-800/50 rounded-lg p-1' : ''}`}>
                                {isEditing && (
                                    <button
                                        onClick={() => updateSet(exIdx, setIdx, 'targetReps', Math.max(1, set.targetReps - 1))}
                                        className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                                    >
                                        <Minus size={14} />
                                    </button>
                                )}
                                <span className="text-lg font-bold min-w-[30px] text-center">{set.targetReps}</span>
                                {isEditing && (
                                    <button
                                        onClick={() => updateSet(exIdx, setIdx, 'targetReps', set.targetReps + 1)}
                                        className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                                    >
                                        <Plus size={14} />
                                    </button>
                                )}
                                {!isEditing && <span className="text-xs text-zinc-500">reps</span>}
                            </div>

                            {/* Delete Set */}
                            {isEditing && (
                                <div className="w-6 flex justify-end">
                                    <button
                                        onClick={() => removeSet(exIdx, setIdx)}
                                        className={`text-zinc-600 hover:text-red-500 p-1 ${exercise.sets.length <= 1 ? 'opacity-30 pointer-events-none' : ''}`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Add Set Button */}
                    {isEditing && (
                        <button
                            onClick={() => addSet(exIdx)}
                            className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 hover:text-white hover:border-zinc-500 flex items-center justify-center gap-2 text-sm mt-2"
                        >
                            <Plus size={16} /> Add Set
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ScheduledWorkoutDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [notes, setNotes] = useState<string | null>(null);

    // Get the scheduled workout
    const scheduled = useLiveQuery(
        () => db.scheduledWorkouts.get(Number(id)),
        [id]
    );

    // Get exercises for name lookup
    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Memoized exercise name lookup map - O(1) instead of O(n)
    const exerciseNameMap = useMemo(() =>
        new Map(exercises?.map(e => [String(e.id), e.name]) || [])
        , [exercises]);

    const getExerciseName = (exerciseId: string) => exerciseNameMap.get(exerciseId) || 'Unknown';

    const [isEditing, setIsEditing] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [originalData, setOriginalData] = useState<{ exercises: TemplateExercise[]; notes: string } | null>(null);

    // Initialize notes state when scheduled loads
    useEffect(() => {
        if (scheduled && notes === null) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setNotes(scheduled.notes || '');
        }
    }, [scheduled, notes]);

    const today = startOfDay(new Date());
    const isToday = scheduled ? isSameDay(new Date(scheduled.date + 'T12:00:00'), today) : false;

    // Ensure all exercises have instanceIds
    useEffect(() => {
        if (scheduled?.exercises) {
            const needsUpdate = scheduled.exercises.some(e => !e.instanceId);
            if (needsUpdate) {
                const updatedExercises = scheduled.exercises.map(e => ({
                    ...e,
                    instanceId: e.instanceId || crypto.randomUUID()
                }));
                db.scheduledWorkouts.update(Number(id), { exercises: updatedExercises });
            }
        }
    }, [scheduled, id]);

    // Update a set value
    const updateSet = async (
        exerciseIndex: number,
        setIndex: number,
        field: 'targetWeight' | 'targetReps',
        value: number
    ) => {
        if (!scheduled || !scheduled.exercises) return;

        const newExercises = [...scheduled.exercises];
        newExercises[exerciseIndex] = {
            ...newExercises[exerciseIndex],
            sets: newExercises[exerciseIndex].sets.map((set, i) =>
                i === setIndex ? { ...set, [field]: value } : set
            )
        };

        await db.scheduledWorkouts.update(Number(id), { exercises: newExercises });
    };

    // Update notes
    const updateNotes = async () => {
        if (!scheduled) return;
        await db.scheduledWorkouts.update(Number(id), { notes: notes?.trim() || undefined });
    };

    // Add a set to an exercise
    const addSet = async (exIdx: number) => {
        if (!scheduled || !scheduled.exercises) return;

        const newExercises = [...scheduled.exercises];
        const lastSet = newExercises[exIdx].sets[newExercises[exIdx].sets.length - 1];
        const newSet = {
            targetWeight: lastSet?.targetWeight || 0,
            targetReps: lastSet?.targetReps || 10
        };

        newExercises[exIdx] = {
            ...newExercises[exIdx],
            sets: [...newExercises[exIdx].sets, newSet]
        };

        await db.scheduledWorkouts.update(Number(id), { exercises: newExercises });
    };

    // Remove a set from an exercise
    const removeSet = async (exIdx: number, setIdx: number) => {
        if (!scheduled || !scheduled.exercises) return;

        const newExercises = [...scheduled.exercises];
        if (newExercises[exIdx].sets.length > 1) {
            newExercises[exIdx] = {
                ...newExercises[exIdx],
                sets: newExercises[exIdx].sets.filter((_, i) => i !== setIdx)
            };
            await db.scheduledWorkouts.update(Number(id), { exercises: newExercises });
        }
    };

    // Remove an exercise
    const removeExercise = async (exIdx: number) => {
        if (!scheduled || !scheduled.exercises) return;

        const exerciseName = getExerciseName(scheduled.exercises[exIdx].exerciseId);
        if (confirm(`Remove ${exerciseName} from this workout?`)) {
            const newExercises = scheduled.exercises.filter((_, i) => i !== exIdx);
            await db.scheduledWorkouts.update(Number(id), { exercises: newExercises });
        }
    };

    // Add a new exercise
    const addExercise = async (exerciseId: string) => {
        if (!scheduled) return;

        const newExercise = {
            exerciseId,
            instanceId: crypto.randomUUID(),
            sets: [{ targetWeight: 0, targetReps: 10 }]
        };

        const newExercises = [...(scheduled.exercises || []), newExercise];
        await db.scheduledWorkouts.update(Number(id), { exercises: newExercises });
        setIsAddModalOpen(false);
    };

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && scheduled && scheduled.exercises) {
            const oldIndex = scheduled.exercises.findIndex(e => (e.instanceId || e.exerciseId) === active.id);
            const newIndex = scheduled.exercises.findIndex(e => (e.instanceId || e.exerciseId) === over.id);

            const newExercises = arrayMove(scheduled.exercises, oldIndex, newIndex);
            await db.scheduledWorkouts.update(Number(id), { exercises: newExercises });
        }
    };

    // Delete scheduled workout
    const handleDelete = async () => {
        if (confirm(`Delete this scheduled workout?`)) {
            if (scheduled) {
                // Track deletion for sync
                await db.deletedItems.add({
                    type: 'scheduled_workout',
                    localId: scheduled.id!,
                    name: scheduled.templateName,
                    date: scheduled.date,
                    deletedAt: new Date()
                });
            }
            await db.scheduledWorkouts.delete(Number(id));
            navigate('/schedule');
        }
    };

    // Start workout
    const handleStart = async () => {
        if (!scheduled || !scheduled.exercises) return;

        const workoutId = await db.workouts.add({
            name: scheduled.templateName || 'Workout',
            startTime: new Date(),
            status: 'active'
        });

        for (const exercise of scheduled.exercises) {
            // Use exercise's instanceId or generate a new one
            const instanceId = exercise.instanceId || `${exercise.exerciseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

        await db.scheduledWorkouts.update(Number(id), { completed: true });
        if (scheduled.templateId) {
            await db.templates.update(scheduled.templateId, { lastUsed: new Date() });
        }

        navigate(`/workout/${workoutId}`);
    };

    if (!scheduled) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate('/schedule')} className="text-zinc-400 flex items-center gap-2">
                    <ArrowLeft size={20} /> Back to Schedule
                </button>
                <p className="text-zinc-500 text-center py-8">Scheduled workout not found</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                {isEditing ? (
                    <button
                        onClick={() => {
                            if (!originalData) {
                                setIsEditing(false);
                                return;
                            }
                            // Check if changes were made
                            const currentExercises = JSON.stringify(scheduled.exercises || []);
                            const originalExercises = JSON.stringify(originalData.exercises);
                            const hasChanges = currentExercises !== originalExercises || notes !== originalData.notes;

                            if (hasChanges) {
                                if (confirm('Discard all changes?')) {
                                    db.scheduledWorkouts.update(Number(id), {
                                        exercises: originalData.exercises,
                                        notes: originalData.notes || undefined
                                    });
                                    setNotes(originalData.notes);
                                    setIsEditing(false);
                                    setOriginalData(null);
                                }
                            } else {
                                setIsEditing(false);
                                setOriginalData(null);
                            }
                        }}
                        className="text-red-400 flex items-center gap-2"
                    >
                        <X size={20} /> Cancel
                    </button>
                ) : (
                    <button onClick={() => navigate('/schedule')} className="text-zinc-400 flex items-center gap-2">
                        <ArrowLeft size={20} /> Back
                    </button>
                )}
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setOriginalData(null);
                            }}
                            className="text-blue-400 font-bold px-2"
                        >
                            Done
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => {
                                    // Save original state before editing
                                    setOriginalData({
                                        exercises: JSON.parse(JSON.stringify(scheduled.exercises || [])),
                                        notes: notes || ''
                                    });
                                    setIsEditing(true);
                                }}
                                className="text-blue-400 px-2"
                            >
                                Edit
                            </button>
                            <button
                                onClick={handleDelete}
                                className="text-red-500 p-2"
                            >
                                <Trash2 size={20} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Title and Date */}
            <div>
                <h1 className="text-2xl font-bold">{scheduled.templateName}</h1>
                <div className="flex items-center gap-2 text-zinc-500 mt-1">
                    <Calendar size={16} />
                    <span>{format(new Date(scheduled.date + 'T12:00:00'), 'EEEE, MMMM d')}</span>
                    {isToday && <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">Today</span>}
                </div>
            </div>

            {/* Start Button (only for today) */}
            {isToday && !scheduled.completed && !isEditing && (
                <button
                    onClick={handleStart}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                >
                    <Play size={20} /> Start Workout
                </button>
            )}

            {scheduled.completed && (
                <div className="text-center py-3 bg-green-900/30 rounded-xl text-green-400">
                    ✓ Completed
                </div>
            )}

            {/* Notes */}
            <div>
                <label className="block text-sm text-zinc-400 mb-2 flex items-center gap-2">
                    <FileText size={14} /> Notes
                </label>
                {isEditing ? (
                    <textarea
                        value={notes || ''}
                        onChange={(e) => setNotes(e.target.value)}
                        onBlur={updateNotes}
                        placeholder="Add notes for this workout..."
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none resize-none"
                        rows={2}
                    />
                ) : (
                    <div className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3 text-sm text-zinc-300 min-h-[60px]">
                        {notes || <span className="text-zinc-600 italic">No notes</span>}
                    </div>
                )}
            </div>

            {/* Exercises */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold">Exercises</h2>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={scheduled.exercises?.map(e => e.instanceId || e.exerciseId) || []}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-4">
                            {scheduled.exercises?.map((exercise, exIdx) => (
                                <SortableExerciseCard
                                    key={exercise.instanceId || exercise.exerciseId}
                                    exercise={exercise}
                                    exIdx={exIdx}
                                    exerciseName={getExerciseName(exercise.exerciseId)}
                                    isEditing={isEditing}
                                    updateSet={updateSet}
                                    addSet={addSet}
                                    removeSet={removeSet}
                                    removeExercise={removeExercise}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                {/* Add Exercise Button */}
                {isEditing && (
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2 border border-dashed border-zinc-700"
                    >
                        <Plus size={20} /> Add Exercise
                    </button>
                )}
            </div>

            {/* Add Exercise Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/95 z-50 p-4 overflow-y-auto">
                    <div className="max-w-lg mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Add Exercise</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-white">
                                <Check size={24} />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {exercises?.map(exercise => (
                                <button
                                    key={exercise.id}
                                    onClick={() => addExercise(String(exercise.id))}
                                    className="w-full p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 text-left font-bold"
                                >
                                    {exercise.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
