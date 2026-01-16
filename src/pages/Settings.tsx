import React, { useState, useEffect } from 'react';
import { Save, Wifi, RefreshCw, CheckCircle, XCircle, Database, Timer, Plus, X, List, RotateCcw } from 'lucide-react';
import { testConnection, syncAllPendingWorkouts } from '../utils/sync';
import { resetSupabaseClient } from '../lib/supabase';
import { getMuscleGroups, setMuscleGroups, getEquipment, setEquipment, DEFAULT_MUSCLE_GROUPS, DEFAULT_EQUIPMENT } from '../utils/exerciseLists';

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
    const [isExpanded, setIsExpanded] = useState(false);

    // Sync localItems when items prop changes (e.g., after parent loads from localStorage)
    useEffect(() => {
        setLocalItems(items);
    }, [items]);

    const handleAdd = () => {
        const trimmed = newItem.trim();
        if (trimmed && !localItems.includes(trimmed)) {
            const updated = [...localItems, trimmed];
            setLocalItems(updated);
            onSave(updated);
            setNewItem('');
        }
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
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');
    const [status, setStatus] = useState('');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testError, setTestError] = useState('');
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');
    const [syncResult, setSyncResult] = useState('');

    useEffect(() => {
        const savedUrl = localStorage.getItem('supabaseUrl');
        const savedKey = localStorage.getItem('supabaseAnonKey');
        if (savedUrl) setSupabaseUrl(savedUrl);
        if (savedKey) setSupabaseKey(savedKey);
    }, []);

    const saveCredentials = () => {
        localStorage.setItem('supabaseUrl', supabaseUrl);
        localStorage.setItem('supabaseAnonKey', supabaseKey);
        resetSupabaseClient(); // Reset client so it picks up new credentials
        setStatus('Saved!');
        setTestStatus('idle');
        setTimeout(() => setStatus(''), 2000);
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestError('');
        const result = await testConnection();
        if (result.success) {
            setTestStatus('success');
        } else {
            setTestStatus('error');
            setTestError(result.error || 'Unknown error');
        }
    };

    const handleSyncNow = async () => {
        setSyncStatus('syncing');
        setSyncResult('');
        const result = await syncAllPendingWorkouts();
        setSyncStatus('done');
        if (result.synced > 0 || result.failed > 0) {
            setSyncResult(`Synced ${result.synced}, Failed ${result.failed}`);
        } else {
            setSyncResult('Nothing to sync');
        }
        setTimeout(() => {
            setSyncStatus('idle');
            setSyncResult('');
        }, 3000);
    };

    const handleForceSyncAll = async () => {
        setSyncStatus('syncing');
        setSyncResult('');
        const result = await syncAllPendingWorkouts(true);
        setSyncStatus('done');
        if (result.synced > 0 || result.failed > 0) {
            setSyncResult(`Force synced ${result.synced}, Failed ${result.failed}`);
        } else {
            setSyncResult('No workouts found');
        }
        setTimeout(() => {
            setSyncStatus('idle');
            setSyncResult('');
        }, 3000);
    };

    const isConfigured = supabaseUrl && supabaseKey;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Settings</h1>

            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                    <Database size={20} className="text-green-500" />
                    <h3 className="font-bold text-lg">Supabase Cloud Sync</h3>
                </div>
                <p className="text-sm text-zinc-400">
                    Connect to your Supabase project to sync workouts to the cloud.
                </p>

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Project URL</label>
                        <input
                            type="text"
                            value={supabaseUrl}
                            onChange={(e) => setSupabaseUrl(e.target.value)}
                            placeholder="https://your-project.supabase.co"
                            className="w-full bg-zinc-800 p-3 rounded-lg text-sm border border-zinc-700 focus:border-green-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Anon Key</label>
                        <input
                            type="password"
                            value={supabaseKey}
                            onChange={(e) => setSupabaseKey(e.target.value)}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            className="w-full bg-zinc-800 p-3 rounded-lg text-sm border border-zinc-700 focus:border-green-500 outline-none font-mono"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={saveCredentials}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
                    >
                        <Save size={16} /> Save
                    </button>
                    <button
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing' || !isConfigured}
                        className="bg-zinc-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-zinc-600 disabled:opacity-50"
                    >
                        {testStatus === 'testing' ? (
                            <RefreshCw size={16} className="animate-spin" />
                        ) : testStatus === 'success' ? (
                            <CheckCircle size={16} className="text-green-500" />
                        ) : testStatus === 'error' ? (
                            <XCircle size={16} className="text-red-500" />
                        ) : (
                            <Wifi size={16} />
                        )}
                        Test Connection
                    </button>
                </div>

                {status && <span className="text-green-500 text-sm">{status}</span>}
                {testStatus === 'success' && <span className="text-green-500 text-sm block">✓ Connected to Supabase!</span>}
                {testStatus === 'error' && <span className="text-red-500 text-sm block">✗ {testError}</span>}
            </div>

            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
                <h3 className="font-bold text-lg">Sync</h3>
                <p className="text-sm text-zinc-400">
                    Workouts sync automatically when finished. Use these to manually sync.
                </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleSyncNow}
                        disabled={syncStatus === 'syncing' || !isConfigured}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                        {syncStatus === 'syncing' ? 'Syncing...' : 'Sync New'}
                    </button>
                    <button
                        onClick={() => handleForceSyncAll()}
                        disabled={syncStatus === 'syncing' || !isConfigured}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-yellow-700 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                        Force Sync All
                    </button>
                </div>
                <p className="text-xs text-zinc-500">
                    "Force Sync All" re-syncs everything, even previously synced workouts.
                </p>
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
        </div>
    );
};
