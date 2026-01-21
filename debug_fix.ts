
const normalizeMuscleGroups = (muscleGroups: string[] | string | unknown): string[] => {
    if (!muscleGroups) return ['Other'];

    // Helper to recursively parse JSON strings
    const parseDeep = (val: any): any => {
        if (typeof val === 'string') {
            const trimmed = val.trim();
            // Check if it looks like a JSON array
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return parseDeep(parsed);
                } catch {
                    // Try unescaping quotes (handle \" -> ")
                    try {
                        const unescaped = trimmed.replace(/\\"/g, '"');
                        const parsed = JSON.parse(unescaped);
                        return parseDeep(parsed);
                    } catch {
                        return val;
                    }
                }
            }
            // Handle double-escaped quotes if any (e.g. "[\"Chest\"]")
            // Also handle cases where the string itself is quoted like '"Chest"'
            const unquoted = val.replace(/^"|"$/g, '');
            if (unquoted !== val) {
                return parseDeep(unquoted);
            }
            return val;
        }
        if (Array.isArray(val)) {
            return val.flatMap(parseDeep);
        }
        return val;
    };

    const result = parseDeep(muscleGroups);

    // Ensure we have a flat array of strings
    if (Array.isArray(result)) {
        const flat = result.flat().filter(item => typeof item === 'string' && item.length > 0);
        return flat.length > 0 ? [...new Set(flat)] : ['Other']; // Deduplicate
    }

    return typeof result === 'string' ? [result] : ['Other'];
};

const testCases = [
    // Case 1: Simple array
    ['Chest', 'Triceps'],

    // Case 2: Stringified array
    '["Chest", "Triceps"]',

    // Case 3: Nested stringified array (Bench Press hypothesis)
    ['["Chest","Triceps","Shoulders"]', 'Lats'],

    // Case 4: Double stringified
    '"[\\"Chest\\",\\"Triceps\\"]"',

    // Case 5: The "Squat" case (Escaped JSON inside array?)
    ['[\\"Legs\\",\\"Glutes\\",\\"Core\\"]'],

    // Case 8: Bench Press with escaped quotes
    ['[\\"Chest\\",\\"Triceps\\",\\"Shoulders\\"]', 'Lats'],
];

console.log('Running tests with FIX...');

testCases.forEach((input, index) => {
    try {
        const result = normalizeMuscleGroups(input);
        console.log(`\nTest Case ${index + 1}:`);
        console.log('Input:', JSON.stringify(input));
        console.log('Output:', JSON.stringify(result));
        console.log('Formatted:', result.join(', '));
    } catch (e) {
        console.error(`Test Case ${index + 1} Failed:`, e);
    }
});
