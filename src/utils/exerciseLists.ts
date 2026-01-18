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
 * Normalize muscle groups to a clean array - handles corrupted data formats
 * Returns an array of muscle group strings, safe for iteration
 */
export const normalizeMuscleGroups = (muscleGroups: string[] | string | unknown): string[] => {
    if (!muscleGroups) return ['Other'];

    if (typeof muscleGroups === 'string') {
        if (muscleGroups.startsWith('[')) {
            try {
                const parsed = JSON.parse(muscleGroups);
                return Array.isArray(parsed) ? parsed : [muscleGroups];
            } catch {
                return [muscleGroups];
            }
        }
        return [muscleGroups];
    }
    if (Array.isArray(muscleGroups)) {
        return muscleGroups.flatMap(item => {
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

/**
 * Format muscle groups for display - returns a comma-separated string
 */
export const formatMuscleGroups = (muscleGroups: string[] | string | unknown): string => {
    return normalizeMuscleGroups(muscleGroups).join(', ') || 'Other';
};

export { DEFAULT_MUSCLE_GROUPS, DEFAULT_EQUIPMENT };
