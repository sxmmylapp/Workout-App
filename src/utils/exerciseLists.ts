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

export { DEFAULT_MUSCLE_GROUPS, DEFAULT_EQUIPMENT };
