
import { db } from './src/db';

// Mock DB for testing logic (we can't easily mock Dexie here without a lot of setup, 
// so I'll write the logic as a pure function that operates on arrays first)

interface Exercise {
    id: number;
    name: string;
    muscleGroups: string[];
    equipment: string;
}

interface Set {
    id: number;
    exerciseId: string; // Stored as string in DB based on previous files
    weight: number;
    reps: number;
}

const mockExercises: Exercise[] = [
    { id: 1, name: 'Bench Press', muscleGroups: ['Chest'], equipment: 'Barbell' },
    { id: 2, name: 'Bench Press', muscleGroups: ['Chest'], equipment: 'Barbell' }, // Duplicate
    { id: 3, name: 'Squat', muscleGroups: ['Legs'], equipment: 'Barbell' },
    { id: 4, name: 'bench press ', muscleGroups: ['Chest'], equipment: 'Barbell' }, // Duplicate with space/case
];

const mockSets: Set[] = [
    { id: 101, exerciseId: '1', weight: 135, reps: 10 },
    { id: 102, exerciseId: '2', weight: 140, reps: 8 }, // Points to duplicate
    { id: 103, exerciseId: '4', weight: 145, reps: 5 }, // Points to duplicate
];

const deduplicate = (exercises: Exercise[], sets: Set[]) => {
    const groups = new Map<string, Exercise[]>();
    const remappings = new Map<string, string>(); // oldId -> newId
    const toDelete = new Set<number>();

    // 1. Group by normalized name
    exercises.forEach(ex => {
        const normalized = ex.name.trim().toLowerCase();
        if (!groups.has(normalized)) {
            groups.set(normalized, []);
        }
        groups.get(normalized)!.push(ex);
    });

    // 2. Identify duplicates
    groups.forEach((group, name) => {
        if (group.length > 1) {
            console.log(`Found ${group.length} duplicates for "${name}"`);

            // Keep the first one (lowest ID usually implies oldest, or we could pick based on other criteria)
            // In a real app, we might want to merge muscle groups or pick the "most complete" one.
            const [keep, ...remove] = group.sort((a, b) => a.id - b.id);

            console.log(`Keeping ID ${keep.id}, removing IDs ${remove.map(r => r.id).join(', ')}`);

            remove.forEach(r => {
                toDelete.add(r.id);
                remappings.set(String(r.id), String(keep.id));
            });
        }
    });

    // 3. Remap sets
    const updatedSets = sets.map(s => {
        if (remappings.has(s.exerciseId)) {
            console.log(`Remapping set ${s.id} from exercise ${s.exerciseId} to ${remappings.get(s.exerciseId)}`);
            return { ...s, exerciseId: remappings.get(s.exerciseId)! };
        }
        return s;
    });

    return {
        toDelete: Array.from(toDelete),
        updatedSets
    };
};

console.log('--- Running Deduplication Logic Test ---');
const result = deduplicate(mockExercises, mockSets);
console.log('Result:', JSON.stringify(result, null, 2));
