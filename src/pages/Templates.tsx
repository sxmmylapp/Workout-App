import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { TemplateEditor } from '../components/TemplateEditor';
import { Plus } from 'lucide-react';

export const Templates: React.FC = () => {
    const navigate = useNavigate();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const templates = useLiveQuery(() => db.templates.orderBy('createdAt').reverse().toArray());
    const exercises = useLiveQuery(() => db.exercises.toArray());

    // Memoized exercise name lookup map - O(1) instead of O(n)
    const exerciseNameMap = useMemo(() =>
        new Map(exercises?.map(e => [String(e.id), e.name]) || [])
        , [exercises]);

    const getExerciseName = (exerciseId: string, exerciseName?: string) =>
        exerciseNameMap.get(exerciseId) || exerciseName || 'Unknown';




    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Templates</h1>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700"
                >
                    <Plus size={20} />
                </button>
            </div>

            {templates?.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-zinc-500 mb-4">No templates yet</p>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="text-blue-400 font-bold"
                    >
                        + Create your first template
                    </button>
                </div>
            )}

            <div className="space-y-3">
                {templates?.map(template => (
                    <div
                        key={template.id}
                        onClick={() => navigate(`/templates/${template.id}`)}
                        className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden cursor-pointer hover:border-zinc-700 transition-colors"
                    >
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-lg">{template.name}</h3>
                                    <p className="text-sm text-zinc-500">
                                        {template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''} • {template.exercises.reduce((sum, e) => sum + e.sets.length, 0)} sets
                                    </p>
                                </div>
                            </div>

                            <div className="text-sm text-zinc-400">
                                {template.exercises.map(e => getExerciseName(e.exerciseId, e.exerciseName)).join(', ')}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {isCreateModalOpen && (
                <TemplateEditor
                    exercises={exercises || []}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSave={() => setIsCreateModalOpen(false)}
                />
            )}
        </div>
    );
};


