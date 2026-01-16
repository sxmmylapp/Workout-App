import React, { useState, useEffect } from 'react';
import { RefreshCw, Timer, Plus, X, List, RotateCcw, LogOut, User, Info } from 'lucide-react';
import { fullCloudSync } from '../utils/sync';
import { getMuscleGroups, setMuscleGroups, getEquipment, setEquipment, DEFAULT_MUSCLE_GROUPS, DEFAULT_EQUIPMENT } from '../utils/exerciseLists';
import { useAuth } from '../contexts/AuthContext';

// Rest Timer Settings Component
const RestTimerSettings: React.FC = () => {
    const [enabled, setEnabled] = useState(true);
    const [defaultTime, setDefaultTime] = useState(90);

    useEffect(() => {
        const savedEnabled = localStorage.getItem('restTimerEnabled');
        const savedTime = localStorage.getItem('restTimerDefault');
        if (savedEnabled !== null) setEnabled(savedEnabled === 'true');
        if (savedTime !== null) setDefaultTime(Number(savedTime));
    }, []);

    const handleToggle = () => {
        const newValue = !enabled;
        setEnabled(newValue);
        localStorage.setItem('restTimerEnabled', String(newValue));
    };

    const handleTimeChange = (value: number) => {
        setDefaultTime(value);
        localStorage.setItem('restTimerDefault', String(value));
    };

    return (
        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2">
                <Timer size={20} className="text-blue-500" />
                <h3 className="font-bold text-lg">Rest Timer</h3>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <p className="font-medium">Enable Rest Timer</p>
                    <p className="text-sm text-zinc-500">Auto-start timer after completing a set</p>
                </div>
                <button
                    onClick={handleToggle}
                    className={`w-12 h-7 rounded-full transition-colors relative ${enabled ? 'bg-blue-600' : 'bg-zinc-700'
                        }`}
                >
                    <div
                        className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${enabled ? 'left-6' : 'left-1'
                            }`}
                    />
                </button>
            </div>

            {enabled && (
                <div>
                    <div className="flex justify-between mb-2">
                        <p className="text-sm text-zinc-400">Default Rest Time</p>
                        <span className="text-sm font-bold">{defaultTime}s</span>
                    </div>
                    <input
                        type="range"
                        min={15}
                        max={180}
                        step={15}
                        value={defaultTime}
                        onChange={(e) => handleTimeChange(Number(e.target.value))}
                        className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-zinc-600 mt-1">
                        <span>15s</span>
                        <span>90s</span>
                        <span>180s</span>
                    </div>
                </div>
            )}
        </div>
    );
};

// List Editor Component for Muscle Groups and Equipment
interface ListEditorProps {
    title: string;
    items: string[];
    onSave: (items: string[]) => void;
    defaultItems: string[];
}

const ListEditor: React.FC<ListEditorProps> = ({ title, items, onSave, defaultItems }) => {
    const [localItems, setLocalItems] = useState<string[]>(items);
    const [newItem, setNewItem] = useState('');
    const [isExpanded, setIsExpanded] = useState(true);

    // Sync localItems when items prop changes (e.g., after parent loads from localStorage)
    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    const handleAdd = () => {
        const trimmed = newItem.trim();
        if (!trimmed) return;

        // Case-insensitive duplicate check
        const isDuplicate = localItems.some(
            item => item.toLowerCase() === trimmed.toLowerCase()
        );

        if (isDuplicate) {
            alert(`"${trimmed}" already exists.`);
            return;
        }

        const updated = [...localItems, trimmed];
        setLocalItems(updated);
        onSave(updated);
        setNewItem('');
    };

    const handleRemove = (item: string) => {
        const updated = localItems.filter(i => i !== item);
        setLocalItems(updated);
        onSave(updated);
    };

    const handleReset = () => {
        if (confirm(`Reset ${title} to defaults?`)) {
            setLocalItems(defaultItems);
            onSave(defaultItems);
        }
    };

    return (
        <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    <List size={18} className="text-purple-500" />
                    <span className="font-bold">{title}</span>
                    <span className="text-xs text-zinc-500">({localItems.length})</span>
                </div>
                <span className="text-zinc-500 text-sm">{isExpanded ? '−' : '+'}</span>
            </button>

            {isExpanded && (
                <div className="mt-4 space-y-3">
                    {/* Current items */}
                    <div className="flex flex-wrap gap-2">
                        {localItems.map(item => (
                            <div
                                key={item}
                                className="flex items-center gap-1 bg-zinc-800 px-3 py-1 rounded-full text-sm"
                            >
                                <span>{item}</span>
                                <button
                                    onClick={() => handleRemove(item)}
                                    className="text-zinc-500 hover:text-red-400 ml-1"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Add new item */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder={`Add ${title.toLowerCase().slice(0, -1)}...`}
                            className="flex-1 bg-zinc-800 px-3 py-2 rounded-lg text-sm border border-zinc-700 focus:border-purple-500 outline-none"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!newItem.trim()}
                            className="bg-purple-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                        >
                            <Plus size={18} />
                        </button>
                    </div>

                    {/* Reset button */}
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                    >
                        <RotateCcw size={12} />
                        Reset to defaults
                    </button>
                </div>
            )}
        </div>
    );
};

// Exercise Lists Settings Component
const ExerciseListsSettings: React.FC = () => {
    const [muscleGroups, setMuscleGroupsState] = useState<string[]>([]);
    const [equipment, setEquipmentState] = useState<string[]>([]);

    useEffect(() => {
        setMuscleGroupsState(getMuscleGroups());
        setEquipmentState(getEquipment());
    }, []);

    const handleSaveMuscleGroups = (items: string[]) => {
        setMuscleGroups(items);
        setMuscleGroupsState(items);
    };

    const handleSaveEquipment = (items: string[]) => {
        setEquipment(items);
        setEquipmentState(items);
    };

    return (
        <div className="space-y-3">
            <h3 className="font-bold text-lg">Exercise Categories</h3>
            <ListEditor
                title="Muscle Groups"
                items={muscleGroups}
                onSave={handleSaveMuscleGroups}
                defaultItems={DEFAULT_MUSCLE_GROUPS}
            />
            <ListEditor
                title="Equipment"
                items={equipment}
                onSave={handleSaveEquipment}
                defaultItems={DEFAULT_EQUIPMENT}
            />
        </div>
    );
};

export const Settings: React.FC = () => {
    const { user, signOut } = useAuth();
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');
    const [syncResult, setSyncResult] = useState('');

    const handleLogout = async () => {
        if (confirm('Sign out of your account?')) {
            await signOut();
        }
    };

    const handleSyncNow = async () => {
        setSyncStatus('syncing');
        setSyncResult('');
        try {
            await fullCloudSync();
            setSyncStatus('done');
            setSyncResult('Full sync complete!');
        } catch (e) {
            setSyncStatus('done');
            setSyncResult('Sync failed - check console');
            console.error('Sync error:', e);
        }
        setTimeout(() => {
            setSyncStatus('idle');
            setSyncResult('');
        }, 3000);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>

            {/* Account Section */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                    <User size={20} className="text-blue-500" />
                    <h3 className="font-bold text-lg">Account</h3>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">{user?.email}</p>
                        <p className="text-sm text-zinc-500">Signed in</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600/20 text-red-400 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-600/30"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>
            </div>

            {/* Cloud Sync Section */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                    <RefreshCw size={20} className="text-green-500" />
                    <h3 className="font-bold text-lg">Cloud Sync</h3>
                </div>
                <p className="text-sm text-zinc-400">
                    Data syncs automatically. Tap below to force a full sync of all your data.
                </p>
                <button
                    onClick={handleSyncNow}
                    disabled={syncStatus === 'syncing'}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                    {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </button>
                {syncResult && <span className="text-zinc-400 text-sm block">{syncResult}</span>}
            </div>

            {/* Rest Timer Settings */}
            <RestTimerSettings />

            {/* Exercise Lists Settings */}
            <ExerciseListsSettings />

            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <h3 className="font-bold text-lg mb-2">Data Management</h3>
                <button
                    className="text-red-500 text-sm hover:text-red-400"
                    onClick={() => {
                        if (confirm('Are you sure? This will wipe all local data.')) {
                            // db.delete() logic here if needed
                        }
                    }}
                >
                    Reset Local Database
                </button>
            </div>

            {/* Version Info */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                    <Info size={18} className="text-zinc-500" />
                    <h3 className="font-bold text-lg">App Info</h3>
                </div>
                <div className="space-y-1 text-sm text-zinc-400">
                    <p><span className="text-zinc-500">Version:</span> 1.0.1</p>
                    <p><span className="text-zinc-500">Build:</span> 2026-01-16</p>
                </div>
            </div>
        </div>
    );
};
