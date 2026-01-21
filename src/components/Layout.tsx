import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dumbbell, History, Settings, Plus, CalendarDays, X, RefreshCw } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const { syncing, syncError, clearSyncError } = useAuth();

    const navItems = [
        { icon: History, label: 'History', path: '/history' },
        { icon: CalendarDays, label: 'Schedule', path: '/schedule' },
        { icon: Plus, label: 'Workout', path: '/', primary: true },
        { icon: Dumbbell, label: 'Exercises', path: '/exercises' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="flex flex-col h-[100dvh] bg-black text-white">
            {/* Syncing indicator */}
            {syncing && (
                <div className="bg-blue-900/80 text-blue-200 px-4 py-2 text-sm flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Syncing...</span>
                </div>
            )}

            {/* Sync error banner */}
            {syncError && (
                <div className="bg-red-900/80 text-red-200 px-4 py-2 text-sm flex items-center justify-between">
                    <span>Sync failed: {syncError}</span>
                    <button onClick={clearSyncError} className="p-1 hover:bg-red-800 rounded">
                        <X size={14} />
                    </button>
                </div>
            )}

            <main className="flex-1 overflow-y-auto p-4 pb-32">
                {children}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="flex justify-around items-center h-16">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        if (item.primary) {
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className="flex flex-col items-center justify-center -mt-8"
                                >
                                    <div className="bg-blue-600 rounded-full p-4 shadow-lg shadow-blue-900/50 text-white">
                                        <Icon size={28} />
                                    </div>
                                    <span className="text-xs mt-1 font-medium text-blue-500">{item.label}</span>
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    "flex flex-col items-center justify-center w-full h-full",
                                    isActive ? "text-blue-500" : "text-zinc-500"
                                )}
                            >
                                <Icon size={24} />
                                <span className="text-[10px] mt-1">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};
