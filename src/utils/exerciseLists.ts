// Default lists for muscle groups and equipment
const DEFAULT_MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core', 'Glutes', 'Forearms'];
const DEFAULT_EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Bands', 'Other'];

export const getMuscleGroups = (): string[] => {
    const saved = localStorage.getItem('muscleGroups');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch {
            return DEFAULT_MUSCLE_GROUPS;
        }
    }
    return DEFAULT_MUSCLE_GROUPS;
};

export const setMuscleGroups = (groups: string[]) => {
    localStorage.setItem('muscleGroups', JSON.stringify(groups));
};

export const getEquipment = (): string[] => {
    const saved = localStorage.getItem('equipment');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch {
            return DEFAULT_EQUIPMENT;
        }
    }
    return DEFAULT_EQUIPMENT;
};

export const setEquipment = (equipment: string[]) => {
    localStorage.setItem('equipment', JSON.stringify(equipment));
};

export const resetToDefaults = () => {
    localStorage.removeItem('muscleGroups');
    localStorage.removeItem('equipment');
};

/**
 * Normalize muscle groups for display - handles corrupted data formats
 * Converts stringified arrays, nested arrays, etc. to a clean string
 */
export const formatMuscleGroups = (muscleGroups: string[] | string | unknown): string => {
    if (!muscleGroups) return 'Other';

    const normalize = (data: string[] | string | unknown): string[] => {
        if (typeof data === 'string') {
            if (data.startsWith('[')) {
                try {
                    const parsed = JSON.parse(data);
                    return Array.isArray(parsed) ? parsed : [data];
                } catch {
                    return [data];
                }
            }
            return [data];
        }
        if (Array.isArray(data)) {
            return data.flatMap(item => {
                if (typeof item === 'string' && item.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(item);
                        return Array.isArray(parsed) ? parsed : [item];
                    } catch {
                        return [item];
                    }
                }
                return [item];
            });
        }
        return ['Other'];
    };

    return normalize(muscleGroups).join(', ') || 'Other';
};

export { DEFAULT_MUSCLE_GROUPS, DEFAULT_EQUIPMENT };
