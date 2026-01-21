import React, { useState, useEffect, useRef } from 'react';

interface DebouncedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export const DebouncedNumberInput: React.FC<DebouncedNumberInputProps> = ({ value, onChange, className }) => {
    const [localValue, setLocalValue] = useState(String(value));
    const isEditing = useRef(false);

    // Sync local value when external value changes (e.g., from DB)
    // Only update if not currently editing to prevent loop
    useEffect(() => {
        if (!isEditing.current && String(value) !== localValue) {
            setLocalValue(String(value));
        }
    }, [value, localValue]);

    const handleFocus = () => {
        isEditing.current = true;
    };

    const handleBlur = () => {
        isEditing.current = false;
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
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={className}
        />
    );
};
