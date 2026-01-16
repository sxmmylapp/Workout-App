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
                    muscle_groups: exercise.muscleGroups,
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
            muscle_groups: localExercise.muscleGroups,
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
                    muscle_groups,
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
                    muscle_groups,
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
                const { error } = await supabase
                    .from('templates')
                    .update({
                        local_id: String(template.id), // Update local_id to match current device
                        exercises: template.exercises,
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
                const { error } = await supabase.from('templates').insert({
                    local_id: String(template.id),
                    user_id: user.id,
                    name: template.name,
                    exercises: template.exercises,
                    updated_at: new Date().toISOString()
                });
                if (error) throw error;
            }
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
            await db.templates.add({
                name: cloudTemplate.name,
                exercises: cloudTemplate.exercises as { exerciseId: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[],
                createdAt: new Date(cloudTemplate.created_at),
                lastUsed: cloudTemplate.updated_at ? new Date(cloudTemplate.updated_at) : undefined
            });
        } else {
            // Update existing template if cloud is newer
            const cloudUpdated = new Date(cloudTemplate.updated_at || cloudTemplate.created_at);
            const localUpdated = localTemplate.lastUsed || localTemplate.createdAt;

            if (cloudUpdated > localUpdated) {
                console.log('Updating local template from cloud:', cloudTemplate.name);
                await db.templates.update(localTemplate.id!, {
                    exercises: cloudTemplate.exercises as { exerciseId: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[],
                    lastUsed: cloudUpdated
                });
            }
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
                const { error } = await supabase
                    .from('scheduled_workouts')
                    .update({
                        local_id: String(workout.id),
                        notes: workout.notes,
                        exercises: workout.exercises,
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
                const { error } = await supabase.from('scheduled_workouts').insert({
                    local_id: String(workout.id),
                    user_id: user.id,
                    template_name: workout.templateName,
                    date: workout.date,
                    notes: workout.notes,
                    exercises: workout.exercises,
                    completed: workout.completed || false
                });
                if (error) throw error;
            }
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
            await db.scheduledWorkouts.add({
                templateId: 0,
                templateName: cloudWorkout.template_name,
                date: cloudWorkout.date,
                notes: cloudWorkout.notes,
                exercises: cloudWorkout.exercises as { exerciseId: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[],
                completed: cloudWorkout.completed
            });
        } else {
            // Update if cloud has different data
            if (JSON.stringify(cloudWorkout.exercises) !== JSON.stringify(localWorkout.exercises)) {
                console.log('Updating local scheduled workout from cloud:', cloudWorkout.template_name);
                await db.scheduledWorkouts.update(localWorkout.id!, {
                    exercises: cloudWorkout.exercises as { exerciseId: string; instanceId?: string; sets: { targetWeight: number; targetReps: number }[] }[],
                    notes: cloudWorkout.notes,
                    completed: cloudWorkout.completed
                });
            }
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
    const muscleGroups = JSON.parse(localStorage.getItem('customMuscleGroups') || 'null');
    const equipment = JSON.parse(localStorage.getItem('customEquipment') || 'null');
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
            localStorage.setItem('customMuscleGroups', JSON.stringify(data.muscle_groups));
        }
        if (data.equipment) {
            localStorage.setItem('customEquipment', JSON.stringify(data.equipment));
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
 * Process local deletions and sync to cloud
 */
const processDeletions = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const deletedItems = await db.deletedItems.toArray();
    if (deletedItems.length === 0) return;

    console.log(`Processing ${deletedItems.length} deletions...`);

    for (const item of deletedItems) {
        try {
            if (item.type === 'template' && item.name) {
                // Delete template by name
                const { error } = await supabase
                    .from('templates')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('name', item.name);

                if (error) throw error;
                console.log(`Deleted cloud template: ${item.name}`);
            } else if (item.type === 'scheduled_workout' && item.date && item.name) {
                // Delete scheduled workout by date and template name
                const { error } = await supabase
                    .from('scheduled_workouts')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('date', item.date)
                    .eq('template_name', item.name);

                if (error) throw error;
                console.log(`Deleted cloud scheduled workout: ${item.name} on ${item.date}`);
            }

            // Remove from local deleted items after successful cloud deletion
            await db.deletedItems.delete(item.id!);
        } catch (e) {
            console.error('Error processing deletion:', e);
        }
    }
};

/**
 * Full sync - upload and fetch all data
 */
export const fullCloudSync = async (): Promise<void> => {
    console.log('Starting full cloud sync...');

    // Process deletions first
    await processDeletions();

    // Sync user settings first
    await syncUserSettingsToSupabase();
    await fetchUserSettingsFromSupabase();

    // Sync exercises
    await syncExercises();

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
