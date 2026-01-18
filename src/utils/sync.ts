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
                    muscle_group: exercise.muscleGroups,
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
 * Fetch exercises from Supabase and merge with local
 * Adds new exercises from cloud that don't exist locally
 */
export const fetchExercisesFromSupabase = async (): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    console.log('Fetching exercises from cloud...');

    const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or('deleted.is.null,deleted.eq.false')  // Filter out soft-deleted exercises
        .order('name', { ascending: true });

    if (error) {
        console.error('Exercise fetch error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No exercises found in cloud');
        return;
    }

    console.log('Fetched exercises from cloud:', data.length);

    // Get local exercises for comparison
    const localExercises = await db.exercises.toArray();
    const localByName = new Map(localExercises.map(e => [e.name.toLowerCase(), e]));

    let added = 0;
    let updated = 0;

    for (const cloudExercise of data) {
        const localExercise = localByName.get(cloudExercise.name?.toLowerCase());

        if (!localExercise) {
            // Add new exercise from cloud
            console.log('Adding cloud exercise locally:', cloudExercise.name);
            await db.exercises.add({
                name: cloudExercise.name,
                muscleGroups: Array.isArray(cloudExercise.muscle_group)
                    ? cloudExercise.muscle_group
                    : [cloudExercise.muscle_group || 'Other'],
                equipment: cloudExercise.equipment || 'Other'
            });
            added++;
        } else {
            // Update if cloud has different data (e.g., muscle groups changed)
            const cloudMuscleGroups = Array.isArray(cloudExercise.muscle_group)
                ? cloudExercise.muscle_group
                : [cloudExercise.muscle_group || 'Other'];

            if (JSON.stringify(localExercise.muscleGroups) !== JSON.stringify(cloudMuscleGroups) ||
                localExercise.equipment !== cloudExercise.equipment) {
                await db.exercises.update(localExercise.id!, {
                    muscleGroups: cloudMuscleGroups,
                    equipment: cloudExercise.equipment || localExercise.equipment
                });
                updated++;
            }
        }
    }

    console.log(`Fetched exercises: ${added} added, ${updated} updated`);
};

/**
 * Get the Supabase exercise UUID for a local exercise ID.
 * Creates a mapping by syncing the exercise first if needed.
 */
const getSupabaseExerciseId = async (localExerciseId: string): Promise<string | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;

    // First, try to find the exercise in Supabase
    const { data } = await supabase
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
            muscle_group: localExercise.muscleGroups,
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

// ============================================================
// TEMPLATE SYNC FUNCTIONS
// ============================================================

/**
 * Convert template exercises from local IDs to exercise names for cloud storage
 * This allows templates to work across devices where local IDs differ
 */
const convertExercisesToNamesForCloud = async (exercises: { exerciseId: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[]) => {
    const localExercises = await db.exercises.toArray();
    const idToName = new Map(localExercises.map(e => [String(e.id), e.name]));

    return exercises.map(ex => ({
        ...ex,
        exerciseName: idToName.get(ex.exerciseId) || 'Unknown Exercise'
    }));
};

/**
 * Convert template exercises from cloud (with names) to local IDs
 * Maps exercise names back to local IDs for this device
 */
const convertExercisesFromCloud = async (exercises: { exerciseId: string; exerciseName?: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[]) => {
    const localExercises = await db.exercises.toArray();
    const nameToId = new Map(localExercises.map(e => [e.name.toLowerCase(), String(e.id)]));

    return exercises.map(ex => {
        // If we have an exerciseName from cloud, use it to find the local ID
        if (ex.exerciseName) {
            const localId = nameToId.get(ex.exerciseName.toLowerCase());
            if (localId) {
                return { ...ex, exerciseId: localId };
            }
        }
        // Fall back to original exerciseId if no name match found
        return ex;
    });
};

export interface SupabaseTemplate {
    id: string;
    local_id: string;
    name: string;
    exercises: unknown; // JSONB
    created_at: string;
    updated_at: string;
}


/**
 * Sync all local templates to Supabase
 */
export const syncTemplatesToSupabase = async (): Promise<{ synced: number; failed: number }> => {
    const supabase = getSupabase();
    if (!supabase) return { synced: 0, failed: 0 };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log('No authenticated user for template sync');
        return { synced: 0, failed: 0 };
    }

    const templates = await db.templates.toArray();
    let synced = 0;
    let failed = 0;

    for (const template of templates) {
        try {
            // Check if template already exists in cloud by NAME (not local_id)
            const { data: existing } = await supabase
                .from('templates')
                .select('id')
                .eq('user_id', user.id)
                .eq('name', template.name);

            if (existing && existing.length > 0) {
                // Update the first match
                const firstId = existing[0].id;
                // Convert exercise IDs to names for cross-device compatibility
                const exercisesWithNames = await convertExercisesToNamesForCloud(template.exercises);
                const { error } = await supabase
                    .from('templates')
                    .update({
                        local_id: String(template.id), // Update local_id to match current device
                        exercises: exercisesWithNames,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', firstId);
                if (error) throw error;

                // Delete duplicates if any
                if (existing.length > 1) {
                    const duplicateIds = existing.slice(1).map(e => e.id);
                    await supabase.from('templates').delete().in('id', duplicateIds);
                    console.log(`Cleaned up ${duplicateIds.length} duplicate templates for "${template.name}"`);
                }
            } else {
                // Insert new
                // Convert exercise IDs to names for cross-device compatibility
                const exercisesWithNames = await convertExercisesToNamesForCloud(template.exercises);
                const { error } = await supabase.from('templates').insert({
                    local_id: String(template.id),
                    user_id: user.id,
                    name: template.name,
                    exercises: exercisesWithNames,
                    updated_at: new Date().toISOString()
                });
                if (error) throw error;
            }
            // Mark as synced
            await db.templates.update(template.id!, { synced: true });
            synced++;
        } catch (e) {
            console.error('Template sync error:', e);
            failed++;
        }
    }

    return { synced, failed };
};

/**
 * Fetch templates from Supabase and merge with local
 * Updates existing templates if cloud version is newer
 */
export const fetchTemplatesFromSupabase = async (): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log('No user for template fetch');
        return;
    }

    console.log('Fetching templates from cloud for user:', user.id);

    const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Template fetch error:', error);
        return;
    }

    console.log('Fetched templates from cloud:', data?.length || 0);

    if (!data || data.length === 0) return;

    // Get local templates for comparison
    const localTemplates = await db.templates.toArray();
    const localByName = new Map(localTemplates.map(t => [t.name.toLowerCase(), t]));

    for (const cloudTemplate of data) {
        const localTemplate = localByName.get(cloudTemplate.name.toLowerCase());

        if (!localTemplate) {
            // Add new template from cloud
            console.log('Adding cloud template locally:', cloudTemplate.name);
            // Convert exercise names from cloud to local IDs
            const cloudExercises = cloudTemplate.exercises as { exerciseId: string; exerciseName?: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[];
            const mappedExercises = await convertExercisesFromCloud(cloudExercises);
            await db.templates.add({
                name: cloudTemplate.name,
                exercises: mappedExercises,
                createdAt: new Date(cloudTemplate.created_at),
                lastUsed: cloudTemplate.updated_at ? new Date(cloudTemplate.updated_at) : undefined
            });
        } else {
            // Update existing template if cloud is newer
            const cloudUpdated = new Date(cloudTemplate.updated_at || cloudTemplate.created_at);
            const localUpdated = localTemplate.lastUsed || localTemplate.createdAt;

            if (cloudUpdated > localUpdated) {
                console.log('Updating local template from cloud:', cloudTemplate.name);
                // Convert exercise names from cloud to local IDs
                const cloudExercises = cloudTemplate.exercises as { exerciseId: string; exerciseName?: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[];
                const mappedExercises = await convertExercisesFromCloud(cloudExercises);
                await db.templates.update(localTemplate.id!, {
                    exercises: mappedExercises,
                    lastUsed: cloudUpdated
                });
            }
        }
    }

    // Remote Deletion Check
    // If we have a local template marked as synced, but it's not in the cloud data, delete it locally
    const cloudIds = new Set(data.map(t => t.local_id));
    const localSyncedTemplates = localTemplates.filter(t => t.synced);

    for (const template of localSyncedTemplates) {
        if (!cloudIds.has(String(template.id))) {
            console.log('Remote deletion detected for template:', template.name);
            await db.templates.delete(template.id!);
        }
    }
};

// ============================================================
// SCHEDULED WORKOUT SYNC FUNCTIONS
// ============================================================

export interface SupabaseScheduledWorkout {
    id: string;
    local_id: string;
    template_name: string;
    date: string;
    notes?: string;
    exercises: unknown;
    completed: boolean;
}

/**
 * Sync all local scheduled workouts to Supabase
 */
/**
 * Sync all local scheduled workouts to Supabase
 */
export const syncScheduledWorkoutsToSupabase = async (): Promise<{ synced: number; failed: number }> => {
    const supabase = getSupabase();
    if (!supabase) return { synced: 0, failed: 0 };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { synced: 0, failed: 0 };

    const scheduled = await db.scheduledWorkouts.toArray();
    let synced = 0;
    let failed = 0;

    for (const workout of scheduled) {
        try {
            // Check if exists in cloud by DATE and TEMPLATE NAME (not local_id)
            const { data: existing } = await supabase
                .from('scheduled_workouts')
                .select('id')
                .eq('user_id', user.id)
                .eq('date', workout.date)
                .eq('template_name', workout.templateName);

            if (existing && existing.length > 0) {
                // Update first match
                const firstId = existing[0].id;
                // Convert exercise IDs to names for cross-device compatibility
                const exercisesWithNames = await convertExercisesToNamesForCloud(workout.exercises);
                const { error } = await supabase
                    .from('scheduled_workouts')
                    .update({
                        local_id: String(workout.id),
                        notes: workout.notes,
                        exercises: exercisesWithNames,
                        completed: workout.completed || false
                    })
                    .eq('id', firstId);
                if (error) throw error;

                // Delete duplicates if any
                if (existing.length > 1) {
                    const duplicateIds = existing.slice(1).map(e => e.id);
                    await supabase.from('scheduled_workouts').delete().in('id', duplicateIds);
                    console.log(`Cleaned up ${duplicateIds.length} duplicate scheduled workouts for "${workout.templateName}" on ${workout.date}`);
                }
            } else {
                // Convert exercise IDs to names for cross-device compatibility
                const exercisesWithNames = await convertExercisesToNamesForCloud(workout.exercises);
                const { error } = await supabase.from('scheduled_workouts').insert({
                    local_id: String(workout.id),
                    user_id: user.id,
                    template_name: workout.templateName,
                    date: workout.date,
                    notes: workout.notes,
                    exercises: exercisesWithNames,
                    completed: workout.completed || false
                });
                if (error) throw error;
            }
            // Mark as synced
            await db.scheduledWorkouts.update(workout.id!, { synced: true });
            synced++;
        } catch (e) {
            console.error('Scheduled workout sync error:', e);
            failed++;
        }
    }

    return { synced, failed };
};

/**
 * Fetch scheduled workouts from Supabase and merge with local
 */
export const fetchScheduledWorkoutsFromSupabase = async (): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });

    if (error) {
        console.error('Scheduled workout fetch error:', error);
        return;
    }

    if (!data) return;

    // Get local scheduled workouts for comparison
    const localScheduled = await db.scheduledWorkouts.toArray();
    const localByDateName = new Map(localScheduled.map(s => [`${s.date}-${s.templateName.toLowerCase()}`, s]));

    for (const cloudWorkout of data) {
        const key = `${cloudWorkout.date}-${cloudWorkout.template_name.toLowerCase()}`;
        const localWorkout = localByDateName.get(key);

        if (!localWorkout) {
            // Add new scheduled workout from cloud
            console.log('Adding cloud scheduled workout locally:', cloudWorkout.template_name, cloudWorkout.date);
            // Convert exercise names from cloud to local IDs
            const cloudExercises = cloudWorkout.exercises as { exerciseId: string; exerciseName?: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[];
            const mappedExercises = await convertExercisesFromCloud(cloudExercises);
            await db.scheduledWorkouts.add({
                templateId: 0,
                templateName: cloudWorkout.template_name,
                date: cloudWorkout.date,
                notes: cloudWorkout.notes,
                exercises: mappedExercises,
                completed: cloudWorkout.completed
            });
        } else {
            // Update if cloud has different data
            if (JSON.stringify(cloudWorkout.exercises) !== JSON.stringify(localWorkout.exercises)) {
                console.log('Updating local scheduled workout from cloud:', cloudWorkout.template_name);
                // Convert exercise names from cloud to local IDs
                const cloudExercises = cloudWorkout.exercises as { exerciseId: string; exerciseName?: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[];
                const mappedExercises = await convertExercisesFromCloud(cloudExercises);
                await db.scheduledWorkouts.update(localWorkout.id!, {
                    exercises: mappedExercises,
                    notes: cloudWorkout.notes,
                    completed: cloudWorkout.completed
                });
            }
        }
    }

    // Remote Deletion Check for Scheduled Workouts
    const cloudIds = new Set(data.map(s => s.local_id));
    const localSyncedScheduled = localScheduled.filter(s => s.synced);

    for (const workout of localSyncedScheduled) {
        if (!cloudIds.has(String(workout.id))) {
            console.log('Remote deletion detected for scheduled workout:', workout.templateName, workout.date);
            await db.scheduledWorkouts.delete(workout.id!);
        }
    }
};

// ============================================================
// USER SETTINGS SYNC FUNCTIONS
// ============================================================

/**
 * Sync user settings (muscle groups, equipment, rest timer) to Supabase
 */
export const syncUserSettingsToSupabase = async (): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get settings from localStorage
    const muscleGroups = JSON.parse(localStorage.getItem('muscleGroups') || 'null');
    const equipment = JSON.parse(localStorage.getItem('equipment') || 'null');
    const restTimerEnabled = localStorage.getItem('restTimerEnabled');
    const restTimerDefault = localStorage.getItem('restTimerDefault');

    try {
        // Check if settings exist
        const { data: existing } = await supabase
            .from('user_settings')
            .select('id')
            .eq('user_id', user.id)
            .single();

        const settingsData = {
            user_id: user.id,
            muscle_groups: muscleGroups,
            equipment: equipment,
            rest_timer_enabled: restTimerEnabled === 'true',
            rest_timer_seconds: restTimerDefault ? Number(restTimerDefault) : 90,
            updated_at: new Date().toISOString()
        };

        if (existing) {
            await supabase.from('user_settings').update(settingsData).eq('id', existing.id);
        } else {
            await supabase.from('user_settings').insert(settingsData);
        }
        console.log('User settings synced to cloud');
    } catch (e) {
        console.error('User settings sync error:', e);
    }
};

/**
 * Fetch user settings from Supabase and apply locally
 */
export const fetchUserSettingsFromSupabase = async (): Promise<void> => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error || !data) {
            console.log('No user settings found in cloud');
            return;
        }

        console.log('Fetched user settings from cloud');

        // Apply settings to localStorage
        if (data.muscle_groups) {
            localStorage.setItem('muscleGroups', JSON.stringify(data.muscle_groups));
        }
        if (data.equipment) {
            localStorage.setItem('equipment', JSON.stringify(data.equipment));
        }
        if (data.rest_timer_enabled !== null) {
            localStorage.setItem('restTimerEnabled', String(data.rest_timer_enabled));
        }
        if (data.rest_timer_seconds !== null) {
            localStorage.setItem('restTimerDefault', String(data.rest_timer_seconds));
        }
    } catch (e) {
        console.error('User settings fetch error:', e);
    }
};

/**
 * Clean up local duplicates
 */
const cleanupLocalDuplicates = async () => {
    // Clean up template duplicates
    const templates = await db.templates.toArray();
    const uniqueTemplates = new Map<string, number>();
    const templateIdsToDelete: number[] = [];

    for (const t of templates) {
        const key = t.name.toLowerCase();
        if (uniqueTemplates.has(key)) {
            // Keep the one with the higher ID (likely newer) or just the first one
            // Actually, keep the one that matches cloud if possible, but here we just dedupe by name
            templateIdsToDelete.push(t.id!);
        } else {
            uniqueTemplates.set(key, t.id!);
        }
    }

    if (templateIdsToDelete.length > 0) {
        await db.templates.bulkDelete(templateIdsToDelete);
        console.log(`Cleaned up ${templateIdsToDelete.length} local duplicate templates`);
    }

    // Clean up scheduled workout duplicates
    const scheduled = await db.scheduledWorkouts.toArray();
    const uniqueScheduled = new Map<string, number>();
    const scheduledIdsToDelete: number[] = [];

    for (const s of scheduled) {
        const key = `${s.date}-${s.templateName.toLowerCase()}`;
        if (uniqueScheduled.has(key)) {
            scheduledIdsToDelete.push(s.id!);
        } else {
            uniqueScheduled.set(key, s.id!);
        }
    }

    if (scheduledIdsToDelete.length > 0) {
        await db.scheduledWorkouts.bulkDelete(scheduledIdsToDelete);
        console.log(`Cleaned up ${scheduledIdsToDelete.length} local duplicate scheduled workouts`);
    }
};

/**
 * Sync deletions to Supabase
 * Processes the deletedItems table and removes corresponding records from cloud
 */
export const syncDeletionsToSupabase = async (): Promise<{ synced: number; failed: number }> => {
    const supabase = getSupabase();
    if (!supabase) return { synced: 0, failed: 0 };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { synced: 0, failed: 0 };

    const deletedItems = await db.deletedItems.toArray();
    if (deletedItems.length === 0) return { synced: 0, failed: 0 };

    console.log(`Found ${deletedItems.length} deleted items to sync`);

    let synced = 0;
    let failed = 0;

    for (const item of deletedItems) {
        try {
            let error = null;

            if (item.type === 'template') {
                // For templates, we delete by local_id and user_id
                const { error: deleteError } = await supabase
                    .from('templates')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('local_id', String(item.localId));
                error = deleteError;
            } else if (item.type === 'scheduled_workout') {
                // For scheduled workouts, we delete by local_id and user_id
                const { error: deleteError } = await supabase
                    .from('scheduled_workouts')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('local_id', String(item.localId));
                error = deleteError;
            } else if (item.type === 'exercise') {
                // For exercises, try to delete, but soft-delete if referenced by workout_sets
                const { error: deleteError } = await supabase
                    .from('exercises')
                    .delete()
                    .eq('local_id', String(item.localId));

                if (deleteError) {
                    // Check if it's a foreign key constraint error (exercise has workout history)
                    if (deleteError.code === '23503') {
                        console.log(`Exercise ${item.localId} has workout history, soft-deleting instead...`);
                        // Soft delete by setting deleted = true
                        const { error: softDeleteError } = await supabase
                            .from('exercises')
                            .update({ deleted: true })
                            .eq('local_id', String(item.localId));

                        if (softDeleteError) {
                            console.error(`Failed to soft-delete exercise ${item.localId}:`, softDeleteError);
                            error = softDeleteError;
                        } else {
                            console.log(`Soft-deleted exercise ${item.localId}`);
                            // Success - mark as synced
                            await db.deletedItems.delete(item.id!);
                            synced++;
                            continue; // Skip to next item
                        }
                    } else {
                        error = deleteError;
                    }
                }
            }

            if (error) {
                console.error(`Failed to sync deletion for ${item.type} ${item.localId}:`, error);
                failed++;
            } else {
                // Successfully synced deletion, remove from deletedItems
                await db.deletedItems.delete(item.id!);
                synced++;
            }
        } catch (e) {
            console.error(`Exception syncing deletion for ${item.type} ${item.localId}:`, e);
            failed++;
        }
    }

    return { synced, failed };
};

/**
 * Full sync - upload and fetch all data
 */
export const fullCloudSync = async (): Promise<void> => {
    console.log('Starting full cloud sync...');

    // Process deletions first
    await syncDeletionsToSupabase();

    // Sync user settings first
    await syncUserSettingsToSupabase();
    await fetchUserSettingsFromSupabase();

    // Sync exercises
    await syncExercises();
    await fetchExercisesFromSupabase();

    // Sync templates
    await syncTemplatesToSupabase();
    await fetchTemplatesFromSupabase();

    // Sync scheduled workouts
    await syncScheduledWorkoutsToSupabase();
    await fetchScheduledWorkoutsFromSupabase();

    // Sync workout history
    await syncAllPendingWorkouts(false);

    // Clean up any duplicates that might have been created
    await cleanupLocalDuplicates();

    console.log('Full cloud sync complete');
};
