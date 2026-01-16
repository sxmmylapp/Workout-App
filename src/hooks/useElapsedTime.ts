import { useState, useEffect } from 'react';

export const useElapsedTime = (startTime?: Date) => {
    const [elapsedTime, setElapsedTime] = useState('0:00');

    useEffect(() => {
        if (!startTime) return;

        const updateElapsed = () => {
            const now = new Date();
            const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            if (hours > 0) {
                setElapsedTime(`${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setElapsedTime(`${minutes}:${String(seconds).padStart(2, '0')}`);
            }
        };

        updateElapsed(); // Initial update
        const interval = setInterval(updateElapsed, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    return elapsedTime;
};
