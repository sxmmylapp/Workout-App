import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TemplateExercise, type TemplateSet } from '../db';
import { format } from 'date-fns';
import { ArrowLeft, Plus, Minus, Trash2, Check, GripVertical } from 'lucide-react';
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

// Sortable Exercise Card Component
interface SortableCustomizeCardProps {
    exercise: TemplateExercise;
    exIdx: number;
    exerciseName: string;
    onUpdateSet: (exIdx: number, setIdx: number, field: 'targetWeight' | 'targetReps', value: number) => void;
    onAddSet: (exIdx: number) => void;
    onRemoveSet: (exIdx: number, setIdx: number) => void;
    onRemoveExercise: (exIdx: number) => void;
}

const SortableCustomizeCard: React.FC<SortableCustomizeCardProps> = ({
    exercise,
    exIdx,
    exerciseName,
    onUpdateSet,
    onAddSet,
    onRemoveSet,
    onRemoveExercise,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: exercise.instanceId || exercise.exerciseId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 0,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            {/* Exercise Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="text-zinc-600 hover:text-zinc-400 touch-none cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical size={20} />
                    </button>
                    <h3 className="font-bold text-blue-400">{exerciseName}</h3>
                </div>
                <button
                    onClick={() => onRemoveExercise(exIdx)}
                    className="text-red-500/50 hover:text-red-500 p-1"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Sets */}
            <div className="p-4 space-y-3">
                {/* Column Headers */}
                <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 text-xs text-zinc-500 uppercase font-bold px-1">
                    <div className="w-8">Set</div>
                    <div className="text-center">Weight</div>
                    <div className="text-center">Reps</div>
                    <div className="w-6"></div>
                </div>

                {/* Set Rows */}
                {exercise.sets.map((set, setIdx) => (
                    <div key={setIdx} className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 items-center">
                        <div className="text-lg font-bold text-zinc-400 w-8">{setIdx + 1}</div>

                        {/* Weight */}
                        <div className="flex items-center justify-center gap-2 bg-zinc-800/50 rounded-lg p-1">
                            <button
                                onClick={() => onUpdateSet(exIdx, setIdx, 'targetWeight', Math.max(0, set.targetWeight - 5))}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-sm font-bold min-w-[30px] text-center">{set.targetWeight}</span>
                            <button
                                onClick={() => onUpdateSet(exIdx, setIdx, 'targetWeight', set.targetWeight + 5)}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Reps */}
                        <div className="flex items-center justify-center gap-2 bg-zinc-800/50 rounded-lg p-1">
                            <button
                                onClick={() => onUpdateSet(exIdx, setIdx, 'targetReps', Math.max(1, set.targetReps - 1))}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-sm font-bold min-w-[24px] text-center">{set.targetReps}</span>
                            <button
                                onClick={() => onUpdateSet(exIdx, setIdx, 'targetReps', set.targetReps + 1)}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Delete Set */}
                        <div className="w-6 flex justify-end">
                            <button
                                onClick={() => onRemoveSet(exIdx, setIdx)}
                                className={`text-zinc-600 hover:text-red-500 p-1 ${exercise.sets.length <= 1 ? 'opacity-30 pointer-events-none' : ''}`}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Set Button */}
                <button
                    onClick={() => onAddSet(exIdx)}
                    className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 hover:text-white hover:border-zinc-500 flex items-center justify-center gap-2 text-sm mt-2"
                >
                    <Plus size={16} /> Add Set
                </button>
            </div>
        </div>
    );
};

export const ScheduleCustomize: React.FC = () => {
    const { templateId } = useParams<{ templateId: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const dateStr = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');

    const [exercises, setExercises] = useState<TemplateExercise[] | null>(null);

    // Get the template
    const template = useLiveQuery(
        () => db.templates.get(Number(templateId)),
        [templateId]
    );

    // Get all exercises for name lookup
    const allExercises = useLiveQuery(() => db.exercises.toArray());

    // Memoized exercise name lookup map - O(1) instead of O(n)
    const exerciseNameMap = useMemo(() =>
        new Map(allExercises?.map(e => [String(e.id), e.name]) || [])
        , [allExercises]);

    const getExerciseName = (exerciseId: string) => exerciseNameMap.get(exerciseId) || 'Unknown';

    // Initialize exercises when template loads
    useEffect(() => {
        if (template && exercises === null) {
            const templateExercises = JSON.parse(JSON.stringify(template.exercises));
            // Ensure instanceIds exist
            const exercisesWithIds = templateExercises.map((e: TemplateExercise) => ({
                ...e,
                instanceId: e.instanceId || crypto.randomUUID()
            }));
            setExercises(exercisesWithIds);
        }
    }, [template, exercises]);

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

        if (over && active.id !== over.id && exercises) {
            setExercises((items) => {
                if (!items) return items;
                const oldIndex = items.findIndex(e => (e.instanceId || e.exerciseId) === active.id);
                const newIndex = items.findIndex(e => (e.instanceId || e.exerciseId) === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Update weight or reps for a set
    const updateSet = (exIdx: number, setIdx: number, field: 'targetWeight' | 'targetReps', value: number) => {
        if (!exercises) return;
        const newExercises = [...exercises];
        newExercises[exIdx] = {
            ...newExercises[exIdx],
            sets: newExercises[exIdx].sets.map((s, i) =>
                i === setIdx ? { ...s, [field]: value } : s
            )
        };
        setExercises(newExercises);
    };

    // Add a set to an exercise
    const addSet = (exIdx: number) => {
        if (!exercises) return;
        const newExercises = [...exercises];
        const lastSet = newExercises[exIdx].sets[newExercises[exIdx].sets.length - 1];
        const newSet: TemplateSet = {
            targetWeight: lastSet?.targetWeight || 0,
            targetReps: lastSet?.targetReps || 10
        };
        newExercises[exIdx] = {
            ...newExercises[exIdx],
            sets: [...newExercises[exIdx].sets, newSet]
        };
        setExercises(newExercises);
    };

    // Remove a set from an exercise
    const removeSet = (exIdx: number, setIdx: number) => {
        if (!exercises) return;
        const newExercises = [...exercises];
        if (newExercises[exIdx].sets.length > 1) {
            newExercises[exIdx] = {
                ...newExercises[exIdx],
                sets: newExercises[exIdx].sets.filter((_, i) => i !== setIdx)
            };
            setExercises(newExercises);
        }
    };

    // Remove an entire exercise
    const removeExercise = (exIdx: number) => {
        if (!exercises) return;
        if (confirm(`Remove ${getExerciseName(exercises[exIdx].exerciseId)} from this workout?`)) {
            setExercises(exercises.filter((_, i) => i !== exIdx));
        }
    };

    // Schedule the workout
    const handleSchedule = async () => {
        if (!template || !exercises) return;

        await db.scheduledWorkouts.add({
            templateId: Number(templateId),
            templateName: template.name,
            date: dateStr,
            exercises: exercises,
            completed: false
        });

        navigate('/schedule');
    };

    // Add a new exercise
    const addExercise = (exerciseId: string) => {
        if (!exercises) return;
        const exerciseDef = allExercises?.find(e => String(e.id) === exerciseId);
        if (!exerciseDef) return;

        const newExercise: TemplateExercise = {
            exerciseId: exerciseId,
            instanceId: crypto.randomUUID(),
            sets: [{ targetWeight: 0, targetReps: 10 }]
        };

        setExercises([...exercises, newExercise]);
        setIsAddModalOpen(false);
    };

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    if (!template || !exercises) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate('/schedule')} className="text-zinc-400 flex items-center gap-2">
                    <ArrowLeft size={20} /> Back to Schedule
                </button>
                <p className="text-zinc-500 text-center py-8">Loading...</p>
            </div>
        );
    }

    const scheduledDate = new Date(dateStr + 'T12:00:00');

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={() => navigate('/schedule')} className="text-zinc-400 flex items-center gap-2">
                    <ArrowLeft size={20} /> Cancel
                </button>
            </div>

            {/* Title */}
            <div>
                <h1 className="text-2xl font-bold">{template.name}</h1>
                <p className="text-zinc-500">Customize for {format(scheduledDate, 'EEEE, MMM d')}</p>
            </div>

            {/* Exercises */}
            <div className="space-y-4">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={exercises.map(e => e.instanceId || e.exerciseId)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-4">
                            {exercises.map((exercise, exIdx) => (
                                <SortableCustomizeCard
                                    key={exercise.instanceId || exercise.exerciseId}
                                    exercise={exercise}
                                    exIdx={exIdx}
                                    exerciseName={getExerciseName(exercise.exerciseId)}
                                    onUpdateSet={updateSet}
                                    onAddSet={addSet}
                                    onRemoveSet={removeSet}
                                    onRemoveExercise={removeExercise}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                {/* Add Exercise Button */}
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2 border border-dashed border-zinc-700"
                >
                    <Plus size={20} /> Add Exercise
                </button>
            </div>

            {/* Empty state */}
            {exercises.length === 0 && (
                <div className="text-center py-8">
                    <p className="text-zinc-500">No exercises in this workout</p>
                </div>
            )}

            {/* Schedule Button */}
            {exercises.length > 0 && (
                <button
                    onClick={handleSchedule}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 sticky bottom-4 shadow-lg shadow-black/50"
                >
                    <Check size={20} /> Schedule Workout
                </button>
            )}

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
                            {allExercises?.map(exercise => (
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
