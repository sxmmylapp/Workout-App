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

    // Helper to recursively parse JSON strings
    const parseDeep = (val: any): any => {
        if (typeof val === 'string') {
            const trimmed = val.trim();
            // Check if it looks like a JSON array
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return parseDeep(parsed);
                } catch {
                    // Try unescaping quotes (handle \" -> ")
                    try {
                        const unescaped = trimmed.replace(/\\"/g, '"');
                        const parsed = JSON.parse(unescaped);
                        return parseDeep(parsed);
                    } catch {
                        return val;
                    }
                }
            }
            // Handle double-escaped quotes if any (e.g. "[\"Chest\"]")
            // Also handle cases where the string itself is quoted like '"Chest"'
            const unquoted = val.replace(/^"|"$/g, '');
            if (unquoted !== val) {
                return parseDeep(unquoted);
            }
            return val;
        }
        if (Array.isArray(val)) {
            return val.flatMap(parseDeep);
        }
        return val;
    };

    const result = parseDeep(muscleGroups);

    // Ensure we have a flat array of strings
    if (Array.isArray(result)) {
        const flat = result.flat().filter(item => typeof item === 'string' && item.length > 0);
        return flat.length > 0 ? [...new Set(flat)] : ['Other']; // Deduplicate
    }

    return typeof result === 'string' ? [result] : ['Other'];
};

/**
 * One-time migration helper to clean up database
 */
export const fixCorruptedData = async (db: any) => {
    const exercises = await db.exercises.toArray();
    let fixedCount = 0;

    for (const ex of exercises) {
        const normalized = normalizeMuscleGroups(ex.muscleGroups);
        // Check if data actually changed (simple string comparison of sorted arrays)
        const currentStr = JSON.stringify(Array.isArray(ex.muscleGroups) ? ex.muscleGroups.sort() : ex.muscleGroups);
        const newStr = JSON.stringify(normalized.sort());

        if (currentStr !== newStr) {
            await db.exercises.update(ex.id, { muscleGroups: normalized });
            fixedCount++;
        }
    }

    if (fixedCount > 0) {
        console.log(`Fixed corrupted muscle groups for ${fixedCount} exercises.`);
    }
};

/**
 * Format muscle groups for display - returns a comma-separated string
 */
export const formatMuscleGroups = (muscleGroups: string[] | string | unknown): string => {
    return normalizeMuscleGroups(muscleGroups).join(', ') || 'Other';
};

/**
 * Deduplicate exercises by name (case-insensitive)
 * Merges sets to the kept exercise and deletes duplicates
 */
export const deduplicateExercises = async (db: any) => {
    const exercises = await db.exercises.toArray();
    const groups = new Map<string, any[]>();
    let deletedCount = 0;
    let remappedSetsCount = 0;

    // 1. Group by normalized name
    exercises.forEach((ex: any) => {
        const normalized = ex.name.trim().toLowerCase();
        if (!groups.has(normalized)) {
            groups.set(normalized, []);
        }
        groups.get(normalized)!.push(ex);
    });

    // 2. Process duplicates
    for (const [name, group] of groups) {
        if (group.length > 1) {
            console.log(`Found ${group.length} duplicates for "${name}"`);

            // Keep the one with the lowest ID (usually oldest)
            const [keep, ...remove] = group.sort((a, b) => a.id - b.id);

            for (const duplicate of remove) {
                // Find all sets pointing to this duplicate
                const sets = await db.sets.where('exerciseId').equals(String(duplicate.id)).toArray();

                if (sets.length > 0) {
                    console.log(`Remapping ${sets.length} sets from ${duplicate.name} (${duplicate.id}) to ${keep.name} (${keep.id})`);
                    // Update sets to point to the kept exercise
                    for (const set of sets) {
                        await db.sets.update(set.id, { exerciseId: String(keep.id) });
                    }
                    remappedSetsCount += sets.length;
                }

                // Delete the duplicate exercise
                await db.exercises.delete(duplicate.id);

                // Track deletion for sync
                await db.deletedItems.add({
                    type: 'exercise',
                    localId: duplicate.id,
                    name: duplicate.name,
                    deletedAt: new Date()
                });

                deletedCount++;
            }
        }
    }

    if (deletedCount > 0) {
        console.log(`Deduplication complete: Deleted ${deletedCount} exercises, remapped ${remappedSetsCount} sets.`);
    }
};

export { DEFAULT_MUSCLE_GROUPS, DEFAULT_EQUIPMENT };
