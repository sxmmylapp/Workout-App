import { useState, useEffect, useCallback } from 'react';

export const useRestTimer = () => {
    const [restTime, setRestTime] = useState(() => {
        const saved = localStorage.getItem('restTimerDefault');
        return saved !== null ? Number(saved) : 90;
    });

    const [restTimerEnabled, setRestTimerEnabled] = useState(() => {
        const saved = localStorage.getItem('restTimerEnabled');
        return saved !== null ? saved !== 'false' : true;
    });

    const [restTimeRemaining, setRestTimeRemaining] = useState<number | null>(null);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // Re-read localStorage when window gains focus (settings may have changed)
    useEffect(() => {
        const handleFocus = () => {
            const savedTime = localStorage.getItem('restTimerDefault');
            const savedEnabled = localStorage.getItem('restTimerEnabled');

            if (savedTime !== null) {
                setRestTime(Number(savedTime));
            }
            if (savedEnabled !== null) {
                setRestTimerEnabled(savedEnabled !== 'false');
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    // Also listen for storage events (changes from other tabs or Settings page)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'restTimerDefault' && e.newValue !== null) {
                setRestTime(Number(e.newValue));
            }
            if (e.key === 'restTimerEnabled' && e.newValue !== null) {
                setRestTimerEnabled(e.newValue !== 'false');
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const startRestTimer = useCallback(() => {
        if (!restTimerEnabled) return;
        setRestTimeRemaining(restTime);
        setIsTimerRunning(true);
    }, [restTimerEnabled, restTime]);

    const stopRestTimer = useCallback(() => {
        setIsTimerRunning(false);
        setRestTimeRemaining(null);
    }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!isTimerRunning || restTimeRemaining === null) return;

        if (restTimeRemaining <= 0) {
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
            setIsTimerRunning(false);
            setRestTimeRemaining(null);
            return;
        }

        const interval = setInterval(() => {
            setRestTimeRemaining(prev => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearInterval(interval);
    }, [isTimerRunning, restTimeRemaining]);

    return {
        restTime,
        setRestTime,
        restTimerEnabled,
        restTimeRemaining,
        isTimerRunning,
        startRestTimer,
        stopRestTimer,
        formatTime
    };
};
