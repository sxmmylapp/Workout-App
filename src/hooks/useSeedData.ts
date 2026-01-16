import { useEffect } from 'react';
import { db } from '../db';

const DEFAULT_EXERCISES = [
    { name: 'Bench Press', muscleGroups: ['Chest', 'Triceps', 'Shoulders'], equipment: 'Barbell' },
    { name: 'Squat', muscleGroups: ['Legs', 'Glutes', 'Core'], equipment: 'Barbell' },
    { name: 'Deadlift', muscleGroups: ['Back', 'Legs', 'Glutes', 'Core'], equipment: 'Barbell' },
    { name: 'Overhead Press', muscleGroups: ['Shoulders', 'Triceps'], equipment: 'Barbell' },
    { name: 'Pull Up', muscleGroups: ['Back', 'Biceps'], equipment: 'Bodyweight' },
    { name: 'Dumbbell Row', muscleGroups: ['Back', 'Biceps'], equipment: 'Dumbbell' },
    { name: 'Dumbbell Curl', muscleGroups: ['Biceps'], equipment: 'Dumbbell' },
    { name: 'Tricep Extension', muscleGroups: ['Triceps'], equipment: 'Cable' },
    { name: 'Leg Press', muscleGroups: ['Legs', 'Glutes'], equipment: 'Machine' },
    { name: 'Lat Pulldown', muscleGroups: ['Back', 'Biceps'], equipment: 'Machine' },
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
