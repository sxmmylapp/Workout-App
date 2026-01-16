import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured, resetSupabaseClient } from '../lib/supabase';
import { Dumbbell, Mail, Lock, ArrowRight, UserPlus, Database, Settings } from 'lucide-react';

export const Login: React.FC = () => {
    const { signIn, signUp } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Supabase config state
    const [showConfig, setShowConfig] = useState(!isSupabaseConfigured());
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');

    useEffect(() => {
        const savedUrl = localStorage.getItem('supabaseUrl');
        const savedKey = localStorage.getItem('supabaseAnonKey');
        if (savedUrl) setSupabaseUrl(savedUrl);
        if (savedKey) setSupabaseKey(savedKey);
    }, []);

    const handleSaveConfig = () => {
        if (supabaseUrl.trim() && supabaseKey.trim()) {
            localStorage.setItem('supabaseUrl', supabaseUrl.trim());
            localStorage.setItem('supabaseAnonKey', supabaseKey.trim());
            resetSupabaseClient();
            setShowConfig(false);
            setMessage('Supabase configured! You can now sign in.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isSupabaseConfigured()) {
            setError('Please configure Supabase first');
            setShowConfig(true);
            return;
        }

        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await signUp(email, password);
                if (error) {
                    setError(error.message);
                } else {
                    setMessage('Check your email to confirm your account!');
                }
            } else {
                const { error } = await signIn(email, password);
                if (error) {
                    setError(error.message);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
            {/* Logo & Title */}
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
                    <Dumbbell size={32} className="text-white" />
                </div>
                <h1 className="text-3xl font-bold text-white">Workout App</h1>
                <p className="text-zinc-500 mt-2">Track your gains, anywhere</p>
            </div>

            {/* Supabase Config Section */}
            {showConfig && (
                <div className="w-full max-w-sm mb-6 bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                        <Database size={18} />
                        <h3 className="font-bold">Connect to Supabase</h3>
                    </div>
                    <input
                        type="text"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        placeholder="Supabase URL (https://xxx.supabase.co)"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm placeholder:text-zinc-600 focus:border-green-500 outline-none"
                    />
                    <input
                        type="password"
                        value={supabaseKey}
                        onChange={(e) => setSupabaseKey(e.target.value)}
                        placeholder="Anon Key"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-white text-sm placeholder:text-zinc-600 focus:border-green-500 outline-none"
                    />
                    <button
                        onClick={handleSaveConfig}
                        disabled={!supabaseUrl.trim() || !supabaseKey.trim()}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg"
                    >
                        Save & Connect
                    </button>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
                <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        required
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:border-blue-500 outline-none"
                    />
                </div>

                <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        minLength={6}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:border-blue-500 outline-none"
                    />
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-800 text-red-400 p-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="bg-green-900/30 border border-green-800 text-green-400 p-3 rounded-xl text-sm">
                        {message}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                    {loading ? (
                        'Loading...'
                    ) : isSignUp ? (
                        <>
                            <UserPlus size={20} />
                            Create Account
                        </>
                    ) : (
                        <>
                            Sign In
                            <ArrowRight size={20} />
                        </>
                    )}
                </button>
            </form>

            {/* Toggle Sign In / Sign Up */}
            <div className="mt-6 text-center space-y-2">
                <button
                    onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null);
                        setMessage(null);
                    }}
                    className="text-zinc-500 hover:text-white transition-colors"
                >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>

                {!showConfig && (
                    <button
                        onClick={() => setShowConfig(true)}
                        className="block mx-auto text-zinc-600 hover:text-zinc-400 text-sm flex items-center gap-1 justify-center"
                    >
                        <Settings size={14} />
                        Configure Supabase
                    </button>
                )}
            </div>
        </div>
    );
};
