import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ChevronLeft, Edit2, Trash2, Copy } from 'lucide-react';
import { TemplateEditor } from '../components/TemplateEditor';

export const TemplateDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);

    const template = useLiveQuery(() =>
        id ? db.templates.get(Number(id)) : undefined
        , [id]);

    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Memoized exercise name lookup map - O(1) instead of O(n)
    const exerciseNameMap = useMemo(() =>
        new Map(exercises?.map(e => [String(e.id), e.name]) || [])
        , [exercises]);

    const getExerciseName = (exerciseId: string) => exerciseNameMap.get(exerciseId) || 'Unknown';

    const handleDelete = async () => {
        if (confirm('Delete this template?')) {
            await db.templates.delete(Number(id));
            navigate('/templates');
        }
    };

    const handleDuplicate = async () => {
        if (!template) return;
        if (confirm(`Duplicate "${template.name}"?`)) {
            await db.templates.add({
                name: `${template.name} (Copy)`,
                exercises: JSON.parse(JSON.stringify(template.exercises)), // Deep clone
                createdAt: new Date()
            });
            navigate('/templates');
        }
    };

    if (!template) {
        return <div className="p-4 text-zinc-500">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/templates')}
                    className="p-2 -ml-2 text-zinc-400 hover:text-white"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={handleDuplicate}
                        className="p-2 text-zinc-400 hover:text-blue-400"
                        title="Duplicate"
                    >
                        <Copy size={20} />
                    </button>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-zinc-400 hover:text-white"
                        title="Edit"
                    >
                        <Edit2 size={20} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-2 text-zinc-400 hover:text-red-500"
                        title="Delete"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </header>

            <div>
                <h1 className="text-3xl font-bold text-white mb-2">{template.name}</h1>
                <p className="text-zinc-500">
                    {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''} • {template.exercises.reduce((sum, e) => sum + e.sets.length, 0)} sets
                </p>
            </div>

            <div className="space-y-4">
                {template.exercises.map((exercise, index) => (
                    <div key={exercise.instanceId || index} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                        <h3 className="font-bold text-lg text-blue-400 mb-3">
                            {getExerciseName(exercise.exerciseId)}
                        </h3>
                        <div className="space-y-2">
                            {exercise.sets.map((set, setIndex) => (
                                <div key={setIndex} className="flex justify-between text-sm text-zinc-400 border-b border-zinc-800/50 last:border-0 pb-2 last:pb-0">
                                    <span className="font-mono text-zinc-600">Set {setIndex + 1}</span>
                                    <div className="flex gap-4">
                                        <span>{set.targetWeight > 0 ? `${set.targetWeight} lbs` : 'BW'}</span>
                                        <span>{set.targetReps} reps</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {isEditing && (
                <TemplateEditor
                    exercises={exercises || []}
                    initialTemplate={template}
                    onClose={() => setIsEditing(false)}
                    onSave={() => setIsEditing(false)}
                />
            )}
        </div>
    );
};
