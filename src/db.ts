import Dexie, { type Table } from 'dexie';

export interface Exercise {
    id?: number;
    name: string;
    muscleGroup: string; // e.g., "Chest", "Back", "Legs"
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
}

export class WorkoutDatabase extends Dexie {
    exercises!: Table<Exercise>;
    workouts!: Table<Workout>;
    sets!: Table<WorkoutSet>;
    templates!: Table<WorkoutTemplate>;
    scheduledWorkouts!: Table<ScheduledWorkout>;

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
    }
}

export const db = new WorkoutDatabase();

