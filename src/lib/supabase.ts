import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase config - safe to expose, RLS protects data
const DEFAULT_SUPABASE_URL = 'https://cbkwesledxrbqnloglej.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNia3dlc2xlZHhyYnFubG9nbGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDI1NTEsImV4cCI6MjA4MzkxODU1MX0.f_-iAUz_yGtQl2Y2ZpuE6KMqm81DXC9nQpDhrP1SfiQ';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the Supabase client instance.
 * Uses hardcoded defaults - always returns a valid client.
 */
export const getSupabase = (): SupabaseClient => {
    if (!supabaseInstance) {
        supabaseInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
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
 * Check if Supabase is configured (always true now with defaults)
 */
export const isSupabaseConfigured = (): boolean => {
    return true;
};
