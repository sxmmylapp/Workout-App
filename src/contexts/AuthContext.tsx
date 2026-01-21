import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabase } from '../lib/supabase';
import { fullCloudSync } from '../utils/sync';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    syncing: boolean;
    syncError: string | null;
    clearSyncError: () => void;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(() => !!getSupabase());
    const [syncing, setSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    const clearSyncError = () => setSyncError(null);

    const performSync = async () => {
        setSyncing(true);
        setSyncError(null);
        try {
            await fullCloudSync();
        } catch (e) {
            console.error('Sync failed:', e);
            setSyncError(e instanceof Error ? e.message : 'Sync failed');
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        const supabase = getSupabase();
        if (!supabase) {
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            // Sync data from cloud on initial session restore
            if (session?.user) {
                performSync();
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);

            // Sync data from cloud on sign in
            if (event === 'SIGNED_IN' && session?.user) {
                performSync();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        const supabase = getSupabase();
        if (!supabase) return { error: new Error('Supabase not configured') };

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? new Error(error.message) : null };
    };

    const signUp = async (email: string, password: string) => {
        const supabase = getSupabase();
        if (!supabase) return { error: new Error('Supabase not configured') };

        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error ? new Error(error.message) : null };
    };

    const signOut = async () => {
        const supabase = getSupabase();
        if (!supabase) return;

        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, syncing, syncError, clearSyncError, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};
