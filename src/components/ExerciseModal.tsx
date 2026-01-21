import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getMuscleGroups, getEquipment } from '../utils/exerciseLists';

interface ExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { name: string; muscleGroups: string[]; equipment: string }) => void;
    initialData?: { name: string; muscleGroups: string[]; equipment: string };
    title: string;
    saveLabel?: string;
}

export const ExerciseModal: React.FC<ExerciseModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
    title,
    saveLabel = 'Save'
}) => {
    const [formData, setFormData] = useState({
        name: '',
        muscleGroups: [] as string[],
        equipment: 'Barbell'
    });

    // Reset or load data when modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData(initialData);
            } else {
                setFormData({ name: '', muscleGroups: [], equipment: 'Barbell' });
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const MUSCLE_GROUPS = getMuscleGroups();
    const EQUIPMENT = getEquipment();

    const toggleMuscleGroup = (mg: string) => {
        const current = formData.muscleGroups;
        if (current.includes(mg)) {
            setFormData({ ...formData, muscleGroups: current.filter(m => m !== mg) });
        } else {
            setFormData({ ...formData, muscleGroups: [...current, mg] });
        }
    };

    const handleSubmit = () => {
        if (!formData.name.trim()) return;
        onSave({
            ...formData,
            name: formData.name.trim(),
            muscleGroups: formData.muscleGroups.length > 0 ? formData.muscleGroups : ['Chest']
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 p-4 flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-sm border border-zinc-800 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Exercise Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Incline Dumbbell Press"
                            className="w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Muscle Groups</label>
                        <div className="flex flex-wrap gap-2">
                            {MUSCLE_GROUPS.map(mg => (
                                <button
                                    key={mg}
                                    type="button"
                                    onClick={() => toggleMuscleGroup(mg)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${formData.muscleGroups.includes(mg)
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                                        }`}
                                >
                                    {mg}
                                </button>
                            ))}
                        </div>
                        {formData.muscleGroups.length === 0 && (
                            <p className="text-xs text-zinc-500 mt-1.5">Select at least one muscle group</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Equipment</label>
                        <div className="relative">
                            <select
                                value={formData.equipment}
                                onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                                className="w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800 focus:border-blue-500 outline-none appearance-none"
                            >
                                {EQUIPMENT.map(eq => (
                                    <option key={eq} value={eq}>{eq}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-zinc-800 text-zinc-400 font-semibold hover:bg-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!formData.name.trim()}
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-lg shadow-blue-900/20"
                    >
                        {saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
