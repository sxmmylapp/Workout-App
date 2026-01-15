import { db } from '../db';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

export interface SupabaseWorkout {
    id: string; // local_id from cloud
    date: string;
    name: string;
    duration?: number; // in seconds
    exercises: {
        name: string;
        sets: { setNumber: number; weight: number; reps: number; completed?: boolean }[];
    }[];
}

/**
 * Keeps only the N most recent completed workouts locally.
 * Deletes older workouts and their associated sets.
 */
const cleanupOldWorkouts = async (keepCount: number) => {
    const allWorkouts = await db.workouts
        .where('status')
        .equals('completed')
        .reverse()
        .sortBy('endTime');

    if (allWorkouts.length > keepCount) {
        const workoutsToDelete = allWorkouts.slice(keepCount);

        for (const workout of workoutsToDelete) {
            if (workout.id) {
                await db.sets.where('workoutId').equals(String(workout.id)).delete();
                await db.workouts.delete(workout.id);
            }
        }

        console.log(`Cleaned up ${workoutsToDelete.length} old workouts, kept ${keepCount} most recent`);
    }
};

/**
 * Sync all local exercises to Supabase.
 * Uses upsert to handle both new and existing exercises.
 */
export const syncExercises = async (): Promise<{ synced: number; failed: number }> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.log('Supabase not configured');
        return { synced: 0, failed: 0 };
    }

    const localExercises = await db.exercises.toArray();
    let synced = 0;
    let failed = 0;

    for (const exercise of localExercises) {
        try {
            const { error } = await supabase
                .from('exercises')
                .upsert({
                    local_id: String(exercise.id),
                    name: exercise.name,
                    muscle_group: exercise.muscleGroup,
                    equipment: exercise.equipment,
                }, { onConflict: 'local_id' });

            if (error) {
                console.error('Failed to sync exercise:', exercise.name, error);
                failed++;
            } else {
                synced++;
            }
        } catch (e) {
            console.error('Exception syncing exercise:', exercise.name, e);
            failed++;
        }
    }

    console.log(`Synced ${synced} exercises, ${failed} failed`);
    return { synced, failed };
};

/**
 * Get the Supabase exercise UUID for a local exercise ID.
 * Creates a mapping by syncing the exercise first if needed.
 */
const getSupabaseExerciseId = async (localExerciseId: string): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    // First, try to find the exercise in Supabase
    const { data, error: _findError } = await supabase
        .from('exercises')
        .select('id')
        .eq('local_id', localExerciseId)
        .single();

    if (data) {
        return data.id;
    }

    // If not found, sync the exercise first
    const localExercise = await db.exercises.get(Number(localExerciseId));
    if (!localExercise) {
        console.error('Local exercise not found:', localExerciseId);
        return null;
    }

    const { data: newData, error: insertError } = await supabase
        .from('exercises')
        .upsert({
            local_id: localExerciseId,
            name: localExercise.name,
            muscle_group: localExercise.muscleGroup,
            equipment: localExercise.equipment,
        }, { onConflict: 'local_id' })
        .select('id')
        .single();

    if (insertError || !newData) {
        console.error('Failed to create exercise in Supabase:', insertError);
        return null;
    }

    return newData.id;
};

/**
 * Sync a workout to Supabase
 */
export const syncToSupabase = async (workoutId: number): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.log('Supabase not configured');
        return false;
    }

    const workout = await db.workouts.get(workoutId);
    const sets = await db.sets.where('workoutId').equals(String(workoutId)).toArray();

    console.log(`Syncing workout ${workoutId}:`, { workout, setsCount: sets.length });

    if (!workout) {
        console.log('No workout found with ID:', workoutId);
        return false;
    }

    if (!sets.length) {
        console.log('No sets found for workout:', workoutId);
        return false;
    }

    try {
        // Upsert workout (insert or update if local_id exists)
        const { error: workoutError } = await supabase
            .from('workouts')
            .upsert({
                local_id: String(workout.id),
                name: workout.name,
                start_time: workout.startTime.toISOString(),
                end_time: workout.endTime?.toISOString() || null,
            }, { onConflict: 'local_id' });

        if (workoutError) {
            console.error('Failed to sync workout:', workoutError);
            return false;
        }

        // Delete existing sets for this workout (to handle re-sync)
        await supabase
            .from('workout_sets')
            .delete()
            .eq('workout_local_id', String(workout.id));

        // Build sets with exercise_id references
        const setsToInsert = [];
        for (const s of sets) {
            const exerciseId = await getSupabaseExerciseId(s.exerciseId);
            if (!exerciseId) {
                console.error('Could not get Supabase exercise ID for:', s.exerciseId);
                continue;
            }

            setsToInsert.push({
                workout_local_id: String(workout.id),
                exercise_id: exerciseId,
                set_number: s.setNumber,
                weight: s.weight,
                reps: s.reps,
                rpe: s.rpe || null,
                completed: s.completed,
                timestamp: s.timestamp.toISOString(),
            });
        }

        if (setsToInsert.length === 0) {
            console.log('No valid sets to insert');
            return false;
        }

        const { error: setsError } = await supabase
            .from('workout_sets')
            .insert(setsToInsert);

        if (setsError) {
            console.error('Failed to sync sets:', setsError);
            return false;
        }

        console.log('Synced to Supabase successfully');

        // Mark workout as synced
        await db.workouts.update(workoutId, { synced: true });
        console.log(`Workout ${workoutId} marked as synced`);

        // Clean up old workouts, keeping the last 5 locally
        await cleanupOldWorkouts(5);

        return true;
    } catch (e) {
        console.error('Sync failed', e);
        return false;
    }
};

/**
 * Fetch workout history from Supabase
 */
export const fetchHistoryFromSupabase = async (): Promise<SupabaseWorkout[]> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.log('Supabase not configured');
        return [];
    }

    try {
        // Fetch all workouts ordered by start_time desc
        const { data: workouts, error: workoutsError } = await supabase
            .from('workouts')
            .select('*')
            .order('start_time', { ascending: false });

        if (workoutsError) {
            console.error('Failed to fetch workouts:', workoutsError);
            return [];
        }

        if (!workouts || workouts.length === 0) {
            return [];
        }

        // Fetch all sets with joined exercise data
        const localIds = workouts.map(w => w.local_id);
        const { data: sets, error: setsError } = await supabase
            .from('workout_sets')
            .select(`
                *,
                exercises (
                    name,
                    muscle_group,
                    equipment
                )
            `)
            .in('workout_local_id', localIds);

        if (setsError) {
            console.error('Failed to fetch sets:', setsError);
            return [];
        }

        // Group sets by workout and exercise
        const result: SupabaseWorkout[] = workouts.map(w => {
            const workoutSets = (sets || []).filter(s => s.workout_local_id === w.local_id);

            // Group by exercise
            const exercisesMap: Record<string, { name: string; sets: { setNumber: number; weight: number; reps: number; completed?: boolean }[] }> = {};

            for (const set of workoutSets) {
                const exerciseName = set.exercises?.name || 'Unknown';
                if (!exercisesMap[exerciseName]) {
                    exercisesMap[exerciseName] = { name: exerciseName, sets: [] };
                }
                exercisesMap[exerciseName].sets.push({
                    setNumber: set.set_number,
                    weight: Number(set.weight),
                    reps: set.reps,
                    completed: set.completed ?? true, // Default to true for old data
                });
            }

            // Calculate duration if end_time exists
            let duration: number | undefined;
            if (w.start_time && w.end_time) {
                duration = Math.floor((new Date(w.end_time).getTime() - new Date(w.start_time).getTime()) / 1000);
            }

            return {
                id: w.local_id,
                date: w.start_time,
                name: w.name,
                duration,
                exercises: Object.values(exercisesMap),
            };
        });

        return result;
    } catch (e) {
        console.error('Failed to fetch history from Supabase', e);
        return [];
    }
};

/**
 * Fetch a single workout's details from cloud by its local_id
 */
export const fetchWorkoutDetailFromCloud = async (localId: string): Promise<SupabaseWorkout | null> => {
    const supabase = getSupabase();
    if (!supabase) {
        console.log('Supabase not configured');
        return null;
    }

    try {
        // Fetch the workout
        const { data: workout, error: workoutError } = await supabase
            .from('workouts')
            .select('*')
            .eq('local_id', localId)
            .single();

        if (workoutError || !workout) {
            console.error('Failed to fetch workout:', workoutError);
            return null;
        }

        // Fetch sets with exercise data
        const { data: sets, error: setsError } = await supabase
            .from('workout_sets')
            .select(`
                *,
                exercises (
                    name,
                    muscle_group,
                    equipment
                )
            `)
            .eq('workout_local_id', localId)
            .order('set_number', { ascending: true });

        if (setsError) {
            console.error('Failed to fetch sets:', setsError);
            return null;
        }

        // Group sets by exercise
        const exercisesMap: Record<string, { name: string; sets: { setNumber: number; weight: number; reps: number; completed?: boolean }[] }> = {};

        for (const set of (sets || [])) {
            const exerciseName = set.exercises?.name || 'Unknown';
            if (!exercisesMap[exerciseName]) {
                exercisesMap[exerciseName] = { name: exerciseName, sets: [] };
            }
            exercisesMap[exerciseName].sets.push({
                setNumber: set.set_number,
                weight: Number(set.weight),
                reps: set.reps,
                completed: set.completed ?? true,
            });
        }

        // Calculate duration
        let duration: number | undefined;
        if (workout.start_time && workout.end_time) {
            duration = Math.floor((new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime()) / 1000);
        }

        return {
            id: workout.local_id,
            date: workout.start_time,
            name: workout.name,
            duration,
            exercises: Object.values(exercisesMap),
        };
    } catch (e) {
        console.error('Failed to fetch workout detail from cloud', e);
        return null;
    }
};

/**
 * Test if the Supabase connection is working
 */
export const testConnection = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured()) {
        return { success: false, error: 'Supabase not configured' };
    }

    const supabase = getSupabase();
    if (!supabase) {
        return { success: false, error: 'Failed to create Supabase client' };
    }

    try {
        // Try a simple query to verify connection
        const { error } = await supabase.from('workouts').select('id').limit(1);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
};

/**
 * Sync all completed workouts that haven't been synced yet
 */
export const syncAllPendingWorkouts = async (forceAll: boolean = false): Promise<{ synced: number; failed: number }> => {
    if (!isSupabaseConfigured()) {
        return { synced: 0, failed: 0 };
    }

    // First, sync all exercises
    await syncExercises();

    const completedWorkouts = await db.workouts
        .where('status')
        .equals('completed')
        .toArray();

    const workoutsToSync = forceAll
        ? completedWorkouts
        : completedWorkouts.filter(w => w.synced !== true);

    console.log(`Found ${workoutsToSync.length} workouts to sync out of ${completedWorkouts.length} total (forceAll: ${forceAll})`);

    let synced = 0;
    let failed = 0;

    for (const workout of workoutsToSync) {
        if (workout.id) {
            if (forceAll) {
                await db.workouts.update(workout.id, { synced: false });
            }
            const success = await syncToSupabase(Number(workout.id));
            if (success) {
                synced++;
            } else {
                failed++;
            }
        }
    }

    return { synced, failed };
};
