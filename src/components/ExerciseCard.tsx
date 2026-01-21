import React from 'react';
import { ChevronRight, CheckSquare, Square } from 'lucide-react';
import { formatMuscleGroups } from '../utils/exerciseLists';

interface ExerciseCardProps {
    exercise: {
        id?: number;
        name: string;
        muscleGroups: string[] | string | unknown;
        equipment: string;
    };
    isSelectMode: boolean;
    isSelected: boolean;
    onToggleSelect: (id: number) => void;
    onClick: () => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
    exercise,
    isSelectMode,
    isSelected,
    onToggleSelect,
    onClick
}) => {
    const handleCardClick = () => {
        if (isSelectMode && exercise.id) {
            onToggleSelect(exercise.id);
        } else {
            onClick();
        }
    };

    return (
        <div
            onClick={handleCardClick}
            className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden ${isSelected
                ? 'bg-blue-900/20 border-blue-500/50'
                : 'bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-700'
                }`}
        >
            {/* Selection Overlay/Indicator */}
            {isSelectMode && (
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isSelected ? 'text-blue-400' : 'text-zinc-600'
                    }`}>
                    {isSelected ? <CheckSquare size={22} /> : <Square size={22} />}
                </div>
            )}

            <div className={`flex justify-between items-center ${isSelectMode ? 'pl-10' : ''}`}>
                <div>
                    <h3 className="font-semibold text-zinc-100 mb-1 group-hover:text-white transition-colors">
                        {exercise.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-500 font-medium">
                            {formatMuscleGroups(exercise.muscleGroups)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider font-bold bg-zinc-800/80 text-zinc-400 px-2.5 py-1 rounded-md border border-zinc-700/50">
                        {exercise.equipment}
                    </span>
                    {!isSelectMode && (
                        <ChevronRight size={18} className="text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                    )}
                </div>
            </div>
        </div>
    );
};
