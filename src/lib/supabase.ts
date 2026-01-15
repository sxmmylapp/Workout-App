import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the Supabase client instance.
 * Returns null if credentials are not configured.
 */
export const getSupabase = (): SupabaseClient | null => {
    const url = localStorage.getItem('supabaseUrl');
    const anonKey = localStorage.getItem('supabaseAnonKey');

    if (!url || !anonKey) {
        return null;
    }

    // Create a new instance if URL/key changed or doesn't exist
    if (!supabaseInstance) {
        supabaseInstance = createClient(url, anonKey);
    }

    return supabaseInstance;
};

/**
 * Reset the Supabase client (call when credentials change)
 */
export const resetSupabaseClient = () => {
    supabaseInstance = null;
};

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = (): boolean => {
    const url = localStorage.getItem('supabaseUrl');
    const anonKey = localStorage.getItem('supabaseAnonKey');
    return Boolean(url && anonKey);
};
