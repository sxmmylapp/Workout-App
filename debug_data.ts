
import { normalizeMuscleGroups } from './src/utils/exerciseLists';

const testCases = [
    // Case 1: Simple array
    ['Chest', 'Triceps'],

    // Case 2: Stringified array
    '["Chest", "Triceps"]',

    // Case 3: Nested stringified array (Bench Press hypothesis)
    ['["Chest","Triceps","Shoulders"]', 'Lats'],

    // Case 4: Double stringified
    '"[\\"Chest\\",\\"Triceps\\"]"',

    // Case 5: The "Squat" case
    ['["Legs","Glutes","Core"]'],

    // Case 6: Mixed quotes
    "['Chest', 'Triceps']",

    // Case 7: Corrupted JSON
    '["Chest", "Triceps"',
];

console.log('Running tests...');

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
