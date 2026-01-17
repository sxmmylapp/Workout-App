import Dexie, { type Table } from 'dexie';

export interface Exercise {
    id?: number;
    name: string;
    muscleGroups: string[]; // e.g., ["Chest", "Shoulders"] - supports multiple muscle groups
    equipment: string; // e.g., "Barbell", "Dumbbell", "Machine"
}

export interface Workout {
    id?: number;
    name: string;
    startTime: Date;
    endTime?: Date;
    status: 'active' | 'completed';
    synced?: boolean; // Whether this workout has been synced to Supabase
}

export interface WorkoutSet {
    id?: number;
    workoutId: string;
    exerciseId: string;
    instanceId: string; // Unique ID for each occurrence of an exercise in a workout (allows same exercise multiple times)
    setNumber: number;
    weight: number;
    reps: number;
    rpe?: number; // Rate of Perceived Exertion (1-10)
    completed: boolean;
    timestamp: Date;
}

// Template types
export interface TemplateSet {
    targetWeight: number;
    targetReps: number;
}

export interface TemplateExercise {
    exerciseId: string;
    instanceId?: string; // Unique ID for this instance of the exercise in the list
    sets: TemplateSet[];
}

export interface WorkoutTemplate {
    id?: number;
    name: string;
    exercises: TemplateExercise[];
    createdAt: Date;
    lastUsed?: Date;
    synced?: boolean;
}

// Scheduled workout for calendar
export interface ScheduledWorkout {
    id?: number;
    templateId: number;
    templateName: string; // Store name in case template is deleted
    date: string; // YYYY-MM-DD format
    notes?: string;
    exercises: TemplateExercise[]; // Copy of exercises (editable)
    completed?: boolean; // Whether this was started/completed
    synced?: boolean;
}

export class WorkoutDatabase extends Dexie {
    exercises!: Table<Exercise>;
    workouts!: Table<Workout>;
    sets!: Table<WorkoutSet>;
    templates!: Table<WorkoutTemplate>;
    scheduledWorkouts!: Table<ScheduledWorkout>;
    deletedItems!: Table<DeletedItem>;

    constructor() {
        super('WorkoutDB');

        // Version 1: Initial schema
        this.version(1).stores({
            exercises: '++id, name, muscleGroup',
            workouts: '++id, startTime, status',
            sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]'
        });

        // Version 2: Add synced field to workouts
        this.version(2).stores({
            exercises: '++id, name, muscleGroup',
            workouts: '++id, startTime, status, synced',
            sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]'
        });

        // Version 3: Add workout templates
        this.version(3).stores({
            exercises: '++id, name, muscleGroup',
            workouts: '++id, startTime, status, synced',
            sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]',
            templates: '++id, name, createdAt'
        });

        // Version 4: Add scheduled workouts
        this.version(4).stores({
            exercises: '++id, name, muscleGroup',
            workouts: '++id, startTime, status, synced',
            sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]',
            templates: '++id, name, createdAt',
            scheduledWorkouts: '++id, templateId, date'
        });

        // Version 5: Change muscleGroup to muscleGroups array (multiEntry index)
        this.version(5).stores({
            exercises: '++id, name, *muscleGroups',
            workouts: '++id, startTime, status, synced',
            sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]',
            templates: '++id, name, createdAt',
            scheduledWorkouts: '++id, templateId, date'
        }).upgrade(tx => {
            // Migrate exercises: convert muscleGroup string to muscleGroups array
            return tx.table('exercises').toCollection().modify(exercise => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const oldMuscleGroup = (exercise as any).muscleGroup;
                if (oldMuscleGroup && typeof oldMuscleGroup === 'string') {
                    exercise.muscleGroups = [oldMuscleGroup];
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    delete (exercise as any).muscleGroup;
                } else if (!exercise.muscleGroups) {
                    exercise.muscleGroups = [];
                }
            });
        });

        // Version 6: Add deleted items tracking
        this.version(6).stores({
            deletedItems: '++id, type, localId'
        });

        // Version 7: Add synced field to templates and scheduled workouts
        this.version(7).stores({
            exercises: '++id, name, *muscleGroups',
            workouts: '++id, startTime, status, synced',
            sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]',
            templates: '++id, name, createdAt, synced',
            scheduledWorkouts: '++id, templateId, date, synced',
            deletedItems: '++id, type, localId'
        });
    }
}

export interface DeletedItem {
    id?: number;
    type: 'template' | 'scheduled_workout' | 'exercise';
    localId: number;
    name?: string; // For templates and exercises
    date?: string; // For scheduled workouts
    deletedAt: Date;
}

export const db = new WorkoutDatabase();

/**
 * Cleanup function to fix corrupted muscle groups data
 * Some muscle groups may have been stored as stringified arrays like '["Chest","Back"]'
 * This function normalizes them to proper arrays
 */
export const cleanupMuscleGroups = async (): Promise<number> => {
    const exercises = await db.exercises.toArray();
    let fixed = 0;

    for (const exercise of exercises) {
        let needsUpdate = false;
        let normalizedMuscleGroups: string[] = [];

        if (typeof exercise.muscleGroups === 'string') {
            // It's a stringified array or single string
            try {
                const parsed = JSON.parse(exercise.muscleGroups);
                if (Array.isArray(parsed)) {
                    normalizedMuscleGroups = parsed;
                    needsUpdate = true;
                }
            } catch {
                // It's just a plain string, wrap in array
                normalizedMuscleGroups = [exercise.muscleGroups];
                needsUpdate = true;
            }
        } else if (Array.isArray(exercise.muscleGroups)) {
            // Check if any element is itself a stringified array
            normalizedMuscleGroups = exercise.muscleGroups.flatMap(mg => {
                if (typeof mg === 'string' && mg.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(mg);
                        if (Array.isArray(parsed)) {
                            needsUpdate = true;
                            return parsed;
                        }
                    } catch {
                        // Keep as-is
                    }
                }
                return mg;
            });
        }

        if (needsUpdate && exercise.id) {
            await db.exercises.update(exercise.id, { muscleGroups: normalizedMuscleGroups });
            fixed++;
            console.log(`Fixed muscle groups for "${exercise.name}":`, normalizedMuscleGroups);
        }
    }

    if (fixed > 0) {
        console.log(`Cleaned up muscle groups for ${fixed} exercises`);
    }

    return fixed;
};
