import React, { useState, useEffect } from 'react';
import { db, type TemplateExercise, type WorkoutTemplate } from '../db';
import { X, GripVertical, Minus, Plus, Trash2 } from 'lucide-react';
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

// Sortable Exercise Card for Template Editor
interface SortableExerciseCardProps {
    templateEx: TemplateExercise;
    exIndex: number;
    exerciseName: string;
    onAddSet: (exIndex: number) => void;
    onRemoveSet: (exIndex: number, setIndex: number) => void;
    onUpdateSet: (exIndex: number, setIndex: number, field: 'targetWeight' | 'targetReps', value: number) => void;
    onRemoveExercise: (exIndex: number) => void;
}

const SortableExerciseCard: React.FC<SortableExerciseCardProps> = ({
    templateEx,
    exIndex,
    exerciseName,
    onAddSet,
    onRemoveSet,
    onUpdateSet,
    onRemoveExercise,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: templateEx.instanceId || templateEx.exerciseId });

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
                    onClick={() => onRemoveExercise(exIndex)}
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
                {templateEx.sets.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 items-center">
                        <div className="text-lg font-bold text-zinc-400 w-8">{setIndex + 1}</div>

                        {/* Weight */}
                        <div className="flex items-center justify-center gap-2 bg-zinc-800/50 rounded-lg p-1">
                            <button
                                onClick={() => onUpdateSet(exIndex, setIndex, 'targetWeight', Math.max(0, set.targetWeight - 5))}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-sm font-bold min-w-[30px] text-center">{set.targetWeight}</span>
                            <button
                                onClick={() => onUpdateSet(exIndex, setIndex, 'targetWeight', set.targetWeight + 5)}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Reps */}
                        <div className="flex items-center justify-center gap-2 bg-zinc-800/50 rounded-lg p-1">
                            <button
                                onClick={() => onUpdateSet(exIndex, setIndex, 'targetReps', Math.max(1, set.targetReps - 1))}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Minus size={14} />
                            </button>
                            <span className="text-sm font-bold min-w-[24px] text-center">{set.targetReps}</span>
                            <button
                                onClick={() => onUpdateSet(exIndex, setIndex, 'targetReps', set.targetReps + 1)}
                                className="p-2 bg-zinc-700 rounded-md text-zinc-300 hover:bg-zinc-600 active:bg-zinc-500"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {/* Delete Set */}
                        <div className="w-6 flex justify-end">
                            <button
                                onClick={() => onRemoveSet(exIndex, setIndex)}
                                className={`text-zinc-600 hover:text-red-500 p-1 ${templateEx.sets.length <= 1 ? 'opacity-30 pointer-events-none' : ''}`}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Set Button */}
                <button
                    onClick={() => onAddSet(exIndex)}
                    className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 hover:text-white hover:border-zinc-500 flex items-center justify-center gap-2 text-sm mt-2"
                >
                    <Plus size={16} /> Add Set
                </button>
            </div>
        </div>
    );
};

interface TemplateEditorProps {
    exercises: { id?: number; name: string; muscleGroups: string[] }[];
    initialTemplate?: WorkoutTemplate;
    onClose: () => void;
    onSave: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ exercises, initialTemplate, onClose, onSave }) => {
    const [step, setStep] = useState<'name' | 'exercises' | 'sets'>('name');
    const [templateName, setTemplateName] = useState('');
    const [selectedExercises, setSelectedExercises] = useState<TemplateExercise[]>([]);

    useEffect(() => {
        if (initialTemplate) {
            setTemplateName(initialTemplate.name);
            // Ensure instanceIds exist
            const exercisesWithIds = initialTemplate.exercises.map(e => ({
                ...e,
                instanceId: e.instanceId || crypto.randomUUID()
            }));
            setSelectedExercises(exercisesWithIds);
            setStep('sets'); // Start at sets view when editing
        }
    }, [initialTemplate]);

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
            setSelectedExercises((items) => {
                const oldIndex = items.findIndex(e => (e.instanceId || e.exerciseId) === active.id);
                const newIndex = items.findIndex(e => (e.instanceId || e.exerciseId) === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSelectExercise = (exerciseId: string) => {
        const exists = selectedExercises.find(e => e.exerciseId === exerciseId);
        if (exists) {
            setSelectedExercises(prev => prev.filter(e => e.exerciseId !== exerciseId));
        } else {
            setSelectedExercises(prev => [...prev, {
                exerciseId,
                instanceId: crypto.randomUUID(),
                sets: [{ targetWeight: 0, targetReps: 10 }]
            }]);
        }
    };

    const handleAddSet = (exerciseIndex: number) => {
        setSelectedExercises(prev => {
            const updated = [...prev];
            const lastSet = updated[exerciseIndex].sets[updated[exerciseIndex].sets.length - 1];
            updated[exerciseIndex] = {
                ...updated[exerciseIndex],
                sets: [...updated[exerciseIndex].sets, {
                    targetWeight: lastSet?.targetWeight || 0,
                    targetReps: lastSet?.targetReps || 10
                }]
            };
            return updated;
        });
    };

    const handleRemoveSet = (exerciseIndex: number, setIndex: number) => {
        setSelectedExercises(prev => {
            const updated = [...prev];
            updated[exerciseIndex].sets.splice(setIndex, 1);
            return updated;
        });
    };

    const handleUpdateSet = (exerciseIndex: number, setIndex: number, field: 'targetWeight' | 'targetReps', value: number) => {
        setSelectedExercises(prev => {
            const updated = [...prev];
            updated[exerciseIndex].sets[setIndex][field] = value;
            return updated;
        });
    };

    const handleRemoveExercise = (exerciseIndex: number) => {
        const exerciseName = getExerciseName(selectedExercises[exerciseIndex].exerciseId);
        if (confirm(`Remove ${exerciseName} from this template?`)) {
            setSelectedExercises(prev => prev.filter((_, i) => i !== exerciseIndex));
        }
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim() || selectedExercises.length === 0) return;

        if (initialTemplate && initialTemplate.id) {
            await db.templates.update(initialTemplate.id, {
                name: templateName.trim(),
                exercises: selectedExercises,
            });
        } else {
            await db.templates.add({
                name: templateName.trim(),
                exercises: selectedExercises,
                createdAt: new Date()
            });
        }

        onSave();
    };

    const getExerciseName = (exerciseId: string) => {
        return exercises.find(e => String(e.id) === exerciseId)?.name || 'Unknown';
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
            <div className="p-4 min-h-full">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">
                        {initialTemplate ? 'Edit Template' : (
                            <>
                                {step === 'name' && 'Name Your Template'}
                                {step === 'exercises' && 'Select Exercises'}
                                {step === 'sets' && 'Configure Sets'}
                            </>
                        )}
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Step 1: Name */}
                {step === 'name' && (
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder="e.g., Push Day, Upper Body"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-lg focus:border-blue-500 outline-none"
                            autoFocus
                        />
                        <button
                            onClick={() => setStep('exercises')}
                            disabled={!templateName.trim()}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl"
                        >
                            Next: Select Exercises
                        </button>
                    </div>
                )}

                {/* Step 2: Select Exercises */}
                {step === 'exercises' && (
                    <div className="space-y-4">
                        <p className="text-zinc-500 text-sm">
                            Tap exercises to add them ({selectedExercises.length} selected)
                        </p>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {exercises.map(ex => {
                                const isSelected = selectedExercises.some(e => e.exerciseId === String(ex.id));
                                return (
                                    <button
                                        key={ex.id}
                                        onClick={() => handleSelectExercise(String(ex.id))}
                                        className={`w-full p-4 rounded-xl text-left transition-colors flex justify-between items-center ${isSelected
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-zinc-900 hover:bg-zinc-800'
                                            }`}
                                    >
                                        <span className="font-bold">{ex.name}</span>
                                        <span className="text-sm opacity-70">{ex.muscleGroups?.join(', ') || 'No muscle groups'}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('name')}
                                className="flex-1 py-4 bg-zinc-800 text-zinc-400 font-bold rounded-xl"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep('sets')}
                                disabled={selectedExercises.length === 0}
                                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl"
                            >
                                Next: Configure Sets
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Configure Sets with Drag and Drop */}
                {step === 'sets' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                className="bg-transparent text-xl font-bold border-b border-zinc-800 focus:border-blue-500 outline-none w-full py-1"
                                placeholder="Template Name"
                            />
                        </div>

                        <p className="text-zinc-500 text-sm mb-2">Drag to reorder exercises</p>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={selectedExercises.map(e => e.instanceId || e.exerciseId)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-4">
                                    {selectedExercises.map((templateEx, exIndex) => (
                                        <SortableExerciseCard
                                            key={templateEx.instanceId || templateEx.exerciseId}
                                            templateEx={templateEx}
                                            exIndex={exIndex}
                                            exerciseName={getExerciseName(templateEx.exerciseId)}
                                            onAddSet={handleAddSet}
                                            onRemoveSet={handleRemoveSet}
                                            onUpdateSet={handleUpdateSet}
                                            onRemoveExercise={handleRemoveExercise}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                        {/* Add Exercise Button */}
                        <button
                            onClick={() => setStep('exercises')}
                            className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-blue-400 font-bold rounded-xl flex items-center justify-center gap-2 border border-dashed border-zinc-700"
                        >
                            <Plus size={20} /> Add Exercise
                        </button>

                        <div className="pt-4">
                            <button
                                onClick={handleSaveTemplate}
                                className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl"
                            >
                                Save Template
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
