import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Dumbbell, History, Settings, Plus, CalendarDays } from 'lucide-react';
import clsx from 'clsx';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();

    const navItems = [
        { icon: History, label: 'History', path: '/history' },
        { icon: CalendarDays, label: 'Schedule', path: '/schedule' },
        { icon: Plus, label: 'Workout', path: '/', primary: true },
        { icon: Dumbbell, label: 'Exercises', path: '/exercises' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <div className="flex flex-col h-[100dvh] bg-black text-white">
            <main className="flex-1 overflow-y-auto p-4 pb-32">
                {children}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
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
