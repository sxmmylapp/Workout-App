import React, { useState, useEffect } from 'react';

interface DebouncedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export const DebouncedNumberInput: React.FC<DebouncedNumberInputProps> = ({ value, onChange, className }) => {
    const [localValue, setLocalValue] = useState(String(value));

    // Sync local value when external value changes (e.g., from DB)
    useEffect(() => {
        setLocalValue(String(value));
    }, [value]);

    const handleBlur = () => {
        const numValue = Number(localValue) || 0;
        if (numValue !== value) {
            onChange(numValue);
        }
    };

    return (
        <input
            type="number"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            className={className}
        />
    );
};
