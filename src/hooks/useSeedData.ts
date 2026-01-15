import { useEffect } from 'react';
import { db } from '../db';

const DEFAULT_EXERCISES = [
    { name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
    { name: 'Squat', muscleGroup: 'Legs', equipment: 'Barbell' },
    { name: 'Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
    { name: 'Overhead Press', muscleGroup: 'Shoulders', equipment: 'Barbell' },
    { name: 'Pull Up', muscleGroup: 'Back', equipment: 'Bodyweight' },
    { name: 'Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell' },
    { name: 'Dumbbell Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell' },
    { name: 'Tricep Extension', muscleGroup: 'Triceps', equipment: 'Cable' },
    { name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine' },
    { name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Machine' },
];

export function useSeedData() {
    useEffect(() => {
        const seed = async () => {
            const count = await db.exercises.count();
            if (count === 0) {
                await db.exercises.bulkAdd(DEFAULT_EXERCISES);
                console.log('Seeded default exercises');
            }

            // Cleanup: delete old scheduled workouts without exercises (legacy data)
            const allScheduled = await db.scheduledWorkouts.toArray();
            const invalidScheduled = allScheduled.filter(s => !s.exercises || s.exercises.length === 0);
            if (invalidScheduled.length > 0) {
                const idsToDelete = invalidScheduled.map(s => s.id!);
                await db.scheduledWorkouts.bulkDelete(idsToDelete);
                console.log(`Cleaned up ${invalidScheduled.length} invalid scheduled workouts`);
            }
        };
        seed();
    }, []);
}
